package ws

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/V4T54L/mafia/internal/adapter/sfu"
	"github.com/V4T54L/mafia/internal/domain/entity"
	"github.com/V4T54L/mafia/internal/domain/service"
	"github.com/pion/webrtc/v4"
)

// Router handles WebSocket message routing
type Router struct {
	hub         *Hub
	roomService *service.RoomService
	gameService *service.GameService
	sfu         *sfu.SFU
	logger      *slog.Logger
}

// NewRouter creates a new message router
func NewRouter(hub *Hub, roomService *service.RoomService, gameService *service.GameService, sfuInstance *sfu.SFU, logger *slog.Logger) *Router {
	r := &Router{
		hub:         hub,
		roomService: roomService,
		gameService: gameService,
		sfu:         sfuInstance,
		logger:      logger,
	}

	// Set up game event handler
	gameService.SetEventHandler(r.handleGameEvent)

	// Set up reconnect timeout handler
	roomService.SetReconnectTimeoutHandler(r.handleReconnectTimeout)

	return r
}

// HandleMessage routes an incoming message to the appropriate handler
func (r *Router) HandleMessage(client *Client, msg *Message) {
	switch msg.Type {
	case MsgTypeCreateRoom:
		r.handleCreateRoom(client, msg)
	case MsgTypeJoinRoom:
		r.handleJoinRoom(client, msg)
	case MsgTypeLeaveRoom:
		r.handleLeaveRoom(client)
	case MsgTypeReconnect:
		r.handleReconnect(client)
	case MsgTypeReady:
		r.handleReady(client, msg)
	case MsgTypeUpdateSettings:
		r.handleUpdateSettings(client, msg)
	case MsgTypeStartGame:
		r.handleStartGame(client)
	case MsgTypeNightAction:
		r.handleNightAction(client, msg)
	case MsgTypeDayVote:
		r.handleDayVote(client, msg)
	case MsgTypeGhostChat:
		r.handleGhostChat(client, msg)
	// Voice handlers
	case MsgTypeVoiceJoin:
		r.handleVoiceJoin(client)
	case MsgTypeVoiceLeave:
		r.handleVoiceLeave(client)
	case MsgTypeVoiceOffer:
		r.handleVoiceOffer(client, msg)
	case MsgTypeVoiceCandidate:
		r.handleVoiceCandidate(client, msg)
	case MsgTypeSpeakingState:
		r.handleSpeakingState(client, msg)
	default:
		client.SendError("unknown_message", "Unknown message type: "+msg.Type)
	}
}

// HandleDisconnect handles client disconnection
func (r *Router) HandleDisconnect(client *Client) {
	if client.RoomCode == "" {
		return
	}

	// Leave voice chat
	if r.sfu != nil {
		r.sfu.LeaveVoice(client.RoomCode, client.PlayerID)
		// Notify others
		r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypeVoiceLeft, VoiceLeftPayload{
			PlayerID: client.PlayerID,
		}), nil)
	}

	// Check if player can reconnect (active game)
	// If so, mark as disconnected instead of removing
	if r.roomService.MarkPlayerDisconnected(client.RoomCode, client.PlayerID) {
		// Player marked as disconnected, awaiting reconnect
		r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypePlayerDisconnected, map[string]any{
			"player_id": client.PlayerID,
		}), nil)
		r.logger.Info("player disconnected during game, awaiting reconnect",
			"room", client.RoomCode,
			"player_id", client.PlayerID,
		)
		return
	}

	// Not in active game or reconnect not possible - remove player
	player, newHostID, err := r.roomService.LeaveRoom(client.RoomCode, client.PlayerID)
	if err != nil {
		r.logger.Warn("error removing player on disconnect",
			"error", err,
			"player_id", client.PlayerID,
			"room", client.RoomCode,
		)
		return
	}

	// Broadcast player left to remaining players
	r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypePlayerLeft, PlayerLeftPayload{
		PlayerID: player.ID,
		NewHost:  newHostID,
	}), nil)
}

func (r *Router) handleCreateRoom(client *Client, msg *Message) {
	var payload CreateRoomPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid create room payload")
		return
	}

	if payload.Nickname == "" {
		client.SendError("invalid_nickname", "Nickname is required")
		return
	}

	// Create room
	room, err := r.roomService.CreateRoom(payload.Password)
	if err != nil {
		client.SendError("create_failed", "Failed to create room")
		return
	}

	// Join the creator to the room
	_, err = r.roomService.JoinRoom(room.Code, payload.Password, client.PlayerID, payload.Nickname)
	if err != nil {
		client.SendError("join_failed", "Failed to join room: "+err.Error())
		return
	}

	// Add client to hub's room
	r.hub.JoinRoom(client, room.Code)

	// Send success response
	client.Send(MustMessage(EventTypeRoomCreated, RoomCreatedPayload{
		RoomCode: room.Code,
		PlayerID: client.PlayerID,
	}))

	// Send full room state
	r.sendRoomState(client, room)

	r.logger.Info("room created and joined",
		"room", room.Code,
		"player_id", client.PlayerID,
		"nickname", payload.Nickname,
	)
}

func (r *Router) handleJoinRoom(client *Client, msg *Message) {
	var payload JoinRoomPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid join room payload")
		return
	}

	if payload.Nickname == "" {
		client.SendError("invalid_nickname", "Nickname is required")
		return
	}

	if payload.RoomCode == "" {
		client.SendError("invalid_room_code", "Room code is required")
		return
	}

	// Join room
	room, err := r.roomService.JoinRoom(payload.RoomCode, payload.Password, client.PlayerID, payload.Nickname)
	if err != nil {
		switch err {
		case entity.ErrRoomNotFound:
			client.SendError("room_not_found", "Room not found")
		case entity.ErrWrongPassword:
			client.SendError("wrong_password", "Wrong password")
		case entity.ErrRoomFull:
			client.SendError("room_full", "Room is full")
		case entity.ErrNicknameInUse:
			client.SendError("nickname_in_use", "Nickname already in use")
		case entity.ErrGameAlreadyStarted:
			client.SendError("game_started", "Game has already started")
		default:
			client.SendError("join_failed", "Failed to join room")
		}
		return
	}

	// Add client to hub's room
	r.hub.JoinRoom(client, room.Code)

	// Send success response to joining player
	client.Send(MustMessage(EventTypeRoomJoined, RoomJoinedPayload{
		RoomCode: room.Code,
		PlayerID: client.PlayerID,
		Players:  toPlayerDTOs(room.GetPlayersDTO()),
		Settings: toSettingsPayload(room.Settings),
	}))

	// Broadcast new player to others in room
	player := room.GetPlayer(client.PlayerID)
	r.hub.BroadcastToRoom(room.Code, MustMessage(EventTypePlayerJoined, PlayerJoinedPayload{
		Player: toPlayerDTO(player.ToDTO()),
	}), client) // exclude the joining player

	r.logger.Info("player joined room",
		"room", room.Code,
		"player_id", client.PlayerID,
		"nickname", payload.Nickname,
	)
}

func (r *Router) handleLeaveRoom(client *Client) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	roomCode := client.RoomCode

	player, newHostID, err := r.roomService.LeaveRoom(roomCode, client.PlayerID)
	if err != nil {
		client.SendError("leave_failed", "Failed to leave room")
		return
	}

	// Remove from hub's room
	r.hub.LeaveRoom(client)

	// Broadcast player left to remaining players
	r.hub.BroadcastToRoom(roomCode, MustMessage(EventTypePlayerLeft, PlayerLeftPayload{
		PlayerID: player.ID,
		NewHost:  newHostID,
	}), nil)

	r.logger.Info("player left room",
		"room", roomCode,
		"player_id", client.PlayerID,
	)
}

func (r *Router) handleReconnect(client *Client) {
	// Check if player can reconnect
	dp, ok := r.roomService.CanReconnect(client.PlayerID)
	if !ok {
		client.SendError("reconnect_failed", "No active session to reconnect to")
		return
	}

	// Perform reconnection
	room, err := r.roomService.ReconnectPlayer(client.PlayerID)
	if err != nil {
		client.SendError("reconnect_failed", "Failed to reconnect: "+err.Error())
		return
	}

	// Add client back to hub's room
	r.hub.JoinRoom(client, room.Code)

	// Get game state for the player
	game := r.gameService.GetGame(room.Code)
	if game == nil {
		client.SendError("reconnect_failed", "Game no longer exists")
		return
	}

	// Send room state to reconnecting player
	r.sendRoomState(client, room)

	// Send game state to reconnecting player
	player := room.GetPlayer(client.PlayerID)
	role := game.Roles[client.PlayerID]
	client.Send(MustMessage(EventTypeRoleAssigned, RoleAssignedPayload{
		Role:      string(role),
		Team:      string(role.GetTeam()),
		Teammates: game.GetMafiaTeammates(client.PlayerID),
	}))

	// Send current phase info
	client.Send(MustMessage(EventTypePhaseChanged, PhaseChangedPayload{
		Phase: string(game.Phase),
		Timer: int(time.Until(game.PhaseEndTime).Seconds()),
	}))

	// Broadcast reconnection to other players
	r.hub.BroadcastToRoom(room.Code, MustMessage(EventTypePlayerReconnected, map[string]any{
		"player_id": client.PlayerID,
		"nickname":  player.Nickname,
	}), client)

	r.logger.Info("player reconnected",
		"room", dp.RoomCode,
		"player_id", client.PlayerID,
	)
}

// handleReconnectTimeout is called when a disconnected player's timer expires
func (r *Router) handleReconnectTimeout(roomCode, playerID string) {
	// Get the room
	room, err := r.roomService.GetRoom(roomCode)
	if err != nil {
		return
	}

	// Remove the player from the room
	player, newHostID, err := r.roomService.LeaveRoom(roomCode, playerID)
	if err != nil {
		r.logger.Warn("error removing timed-out player",
			"error", err,
			"player_id", playerID,
			"room", roomCode,
		)
		return
	}

	// Broadcast player left
	r.hub.BroadcastToRoom(roomCode, MustMessage(EventTypePlayerLeft, PlayerLeftPayload{
		PlayerID: player.ID,
		NewHost:  newHostID,
	}), nil)

	// Check if game should end due to player leaving
	game := r.gameService.GetGame(roomCode)
	if game != nil {
		gameOver, winner := game.CheckWinCondition()
		if gameOver {
			game.EndGame(winner)
			r.hub.BroadcastToRoom(roomCode, MustMessage(EventTypeGameOver, GameOverPayload{
				Winner:  string(winner),
				Players: toPlayerDTOs(room.GetPlayersDTO()),
				Roles:   getRoleStrings(game.Roles),
			}), nil)
		}
	}

	r.logger.Info("disconnected player removed after timeout",
		"room", roomCode,
		"player_id", playerID,
	)
}

// getRoleStrings converts role map to string map
func getRoleStrings(roles map[string]entity.Role) map[string]string {
	result := make(map[string]string)
	for id, role := range roles {
		result[id] = string(role)
	}
	return result
}

func (r *Router) handleReady(client *Client, msg *Message) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	var payload ReadyPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid ready payload")
		return
	}

	err := r.roomService.SetReady(client.RoomCode, client.PlayerID, payload.Ready)
	if err != nil {
		client.SendError("ready_failed", "Failed to set ready state")
		return
	}

	// Broadcast ready state change
	r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypePlayerReady, map[string]any{
		"player_id": client.PlayerID,
		"ready":     payload.Ready,
	}), nil)
}

func (r *Router) handleUpdateSettings(client *Client, msg *Message) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	var payload SettingsPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid settings payload")
		return
	}

	settings := entity.GameSettings{
		Villagers:  payload.Villagers,
		Mafia:      payload.Mafia,
		Godfather:  payload.Godfather,
		Doctor:     payload.Doctor,
		Detective:  payload.Detective,
		NightTimer: payload.NightTimer,
	}

	err := r.roomService.UpdateSettings(client.RoomCode, client.PlayerID, settings)
	if err != nil {
		if err == entity.ErrNotHost {
			client.SendError("not_host", "Only host can update settings")
		} else {
			client.SendError("settings_failed", "Failed to update settings")
		}
		return
	}

	// Broadcast settings change
	r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypeSettingsUpdated, payload), nil)
}

func (r *Router) sendRoomState(client *Client, room *entity.Room) {
	client.Send(MustMessage(EventTypeRoomState, map[string]any{
		"room_code": room.Code,
		"players":   toPlayerDTOs(room.GetPlayersDTO()),
		"settings":  toSettingsPayload(room.Settings),
		"state":     string(room.State),
	}))
}

// Helper converters
func toPlayerDTOs(dtos []entity.PlayerDTO) []PlayerDTO {
	result := make([]PlayerDTO, len(dtos))
	for i, dto := range dtos {
		result[i] = toPlayerDTO(dto)
	}
	return result
}

func toPlayerDTO(dto entity.PlayerDTO) PlayerDTO {
	return PlayerDTO{
		ID:          dto.ID,
		Nickname:    dto.Nickname,
		IsHost:      dto.IsHost,
		IsReady:     dto.IsReady,
		IsConnected: dto.IsConnected,
		Status:      dto.Status,
	}
}

func toSettingsPayload(s entity.GameSettings) SettingsPayload {
	return SettingsPayload{
		Villagers:  s.Villagers,
		Mafia:      s.Mafia,
		Godfather:  s.Godfather,
		Doctor:     s.Doctor,
		Detective:  s.Detective,
		NightTimer: s.NightTimer,
	}
}

// Game handlers

func (r *Router) handleStartGame(client *Client) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	err := r.gameService.StartGame(client.RoomCode, client.PlayerID)
	if err != nil {
		switch err {
		case entity.ErrNotHost:
			client.SendError("not_host", "Only host can start the game")
		case entity.ErrNotEnoughPlayers:
			client.SendError("not_enough_players", "Not enough players")
		case entity.ErrNotAllReady:
			client.SendError("not_all_ready", "Not all players are ready")
		default:
			client.SendError("start_failed", "Failed to start game: "+err.Error())
		}
		return
	}

	r.logger.Info("game started", "room", client.RoomCode, "host", client.PlayerID)
}

func (r *Router) handleNightAction(client *Client, msg *Message) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	var payload NightActionPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid night action payload")
		return
	}

	err := r.gameService.SubmitNightAction(client.RoomCode, client.PlayerID, payload.TargetID)
	if err != nil {
		switch err {
		case entity.ErrInvalidPhase:
			client.SendError("invalid_phase", "Cannot perform night action now")
		case entity.ErrPlayerDead:
			client.SendError("player_dead", "Dead players cannot act")
		case entity.ErrInvalidTarget:
			client.SendError("invalid_target", "Invalid target")
		case entity.ErrMafiaTargetMafia:
			client.SendError("invalid_target", "Cannot target fellow mafia")
		case entity.ErrCannotTargetSelf:
			client.SendError("invalid_target", "Cannot target yourself")
		default:
			client.SendError("action_failed", "Failed to submit action")
		}
		return
	}
}

func (r *Router) handleDayVote(client *Client, msg *Message) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	var payload DayVotePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid vote payload")
		return
	}

	err := r.gameService.SubmitDayVote(client.RoomCode, client.PlayerID, payload.TargetID)
	if err != nil {
		switch err {
		case entity.ErrInvalidPhase:
			client.SendError("invalid_phase", "Cannot vote now")
		case entity.ErrPlayerDead:
			client.SendError("player_dead", "Dead players cannot vote")
		case entity.ErrInvalidTarget:
			client.SendError("invalid_target", "Invalid target")
		case entity.ErrCannotTargetSelf:
			client.SendError("invalid_target", "Cannot vote for yourself")
		default:
			client.SendError("vote_failed", "Failed to submit vote")
		}
		return
	}
}

func (r *Router) handleGhostChat(client *Client, msg *Message) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	var payload GhostChatPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid ghost chat payload")
		return
	}

	// Validate message
	if payload.Message == "" || len(payload.Message) > 500 {
		client.SendError("invalid_message", "Message must be 1-500 characters")
		return
	}

	// Get game and verify player is dead
	game := r.gameService.GetGame(client.RoomCode)
	if game == nil {
		client.SendError("game_not_found", "Game not found")
		return
	}

	player := game.Room.GetPlayer(client.PlayerID)
	if player == nil {
		client.SendError("player_not_found", "Player not found")
		return
	}

	if player.Status != entity.PlayerStatusDead {
		client.SendError("not_dead", "Only dead players can use ghost chat")
		return
	}

	// Get all dead player IDs
	var deadPlayerIDs []string
	for _, p := range game.Room.Players {
		if p.Status == entity.PlayerStatusDead {
			deadPlayerIDs = append(deadPlayerIDs, p.ID)
		}
	}

	// Broadcast to all dead players
	broadcastPayload := GhostChatBroadcastPayload{
		FromID:       client.PlayerID,
		FromNickname: player.Nickname,
		Message:      payload.Message,
		Timestamp:    time.Now().UnixMilli(),
	}

	r.hub.BroadcastToPlayers(client.RoomCode, deadPlayerIDs, MustMessage(EventTypeGhostChatBroadcast, broadcastPayload))

	r.logger.Debug("ghost chat sent",
		"room", client.RoomCode,
		"from", client.PlayerID,
		"message_len", len(payload.Message),
	)
}

// --- Voice handlers ---

func (r *Router) handleVoiceJoin(client *Client) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	if r.sfu == nil {
		client.SendError("voice_unavailable", "Voice chat is not available")
		return
	}

	participant, err := r.sfu.JoinVoice(client.RoomCode, client.PlayerID)
	if err != nil {
		client.SendError("voice_join_failed", "Failed to join voice: "+err.Error())
		return
	}

	// Set up ICE candidate handler
	if participant.PeerConn != nil {
		participant.PeerConn.OnICECandidate(func(candidate *webrtc.ICECandidate) {
			if candidate == nil {
				return
			}
			candidateJSON := candidate.ToJSON()
			usernameFrag := ""
			if candidateJSON.UsernameFragment != nil {
				usernameFrag = *candidateJSON.UsernameFragment
			}
			client.Send(MustMessage(EventTypeVoiceCandidate, VoiceCandidatePayload{
				Candidate:        candidateJSON.Candidate,
				SDPMid:           *candidateJSON.SDPMid,
				SDPMLineIndex:    *candidateJSON.SDPMLineIndex,
				UsernameFragment: usernameFrag,
			}))
		})

		// Handle incoming audio tracks
		participant.PeerConn.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
			r.logger.Debug("received audio track",
				"player", client.PlayerID,
				"track", track.ID(),
			)
		})
	}

	// Notify others in room
	r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypeVoiceJoined, VoiceJoinedPayload{
		PlayerID: client.PlayerID,
	}), client)

	r.logger.Info("player joined voice",
		"room", client.RoomCode,
		"player", client.PlayerID,
	)
}

func (r *Router) handleVoiceLeave(client *Client) {
	if client.RoomCode == "" {
		return
	}

	if r.sfu != nil {
		r.sfu.LeaveVoice(client.RoomCode, client.PlayerID)
	}

	// Notify others in room
	r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypeVoiceLeft, VoiceLeftPayload{
		PlayerID: client.PlayerID,
	}), client)

	r.logger.Info("player left voice",
		"room", client.RoomCode,
		"player", client.PlayerID,
	)
}

func (r *Router) handleVoiceOffer(client *Client, msg *Message) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	if r.sfu == nil {
		client.SendError("voice_unavailable", "Voice chat is not available")
		return
	}

	var payload VoiceOfferPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid voice offer payload")
		return
	}

	offer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  payload.SDP,
	}

	answer, err := r.sfu.HandleOffer(client.RoomCode, client.PlayerID, offer)
	if err != nil {
		client.SendError("voice_offer_failed", "Failed to process offer: "+err.Error())
		return
	}

	client.Send(MustMessage(EventTypeVoiceAnswer, VoiceAnswerPayload{
		SDP: answer.SDP,
	}))

	r.logger.Debug("voice offer/answer complete",
		"room", client.RoomCode,
		"player", client.PlayerID,
	)
}

func (r *Router) handleVoiceCandidate(client *Client, msg *Message) {
	if client.RoomCode == "" {
		client.SendError("not_in_room", "Not in a room")
		return
	}

	if r.sfu == nil {
		client.SendError("voice_unavailable", "Voice chat is not available")
		return
	}

	var payload VoiceCandidatePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		client.SendError("invalid_payload", "Invalid voice candidate payload")
		return
	}

	usernameFrag := payload.UsernameFragment
	candidate := webrtc.ICECandidateInit{
		Candidate:        payload.Candidate,
		SDPMid:           &payload.SDPMid,
		SDPMLineIndex:    &payload.SDPMLineIndex,
		UsernameFragment: &usernameFrag,
	}

	if err := r.sfu.AddICECandidate(client.RoomCode, client.PlayerID, candidate); err != nil {
		r.logger.Warn("failed to add ICE candidate",
			"error", err,
			"player", client.PlayerID,
		)
	}
}

func (r *Router) handleSpeakingState(client *Client, msg *Message) {
	if client.RoomCode == "" {
		return
	}

	var payload SpeakingStatePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	// Update SFU state
	if r.sfu != nil {
		r.sfu.SetSpeakingState(client.RoomCode, client.PlayerID, payload.Speaking)
	}

	// Broadcast to others in room
	r.hub.BroadcastToRoom(client.RoomCode, MustMessage(EventTypeSpeakingState, SpeakingStatePayload{
		PlayerID: client.PlayerID,
		Speaking: payload.Speaking,
	}), nil)
}

// handleGameEvent processes events from the game service
func (r *Router) handleGameEvent(event service.GameEvent) {
	switch event.Type {
	case service.EventGameStarted:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeGameStarting, nil), nil)

	case service.EventRoleAssigned:
		// Send to specific player
		r.logger.Info("sending role assignment",
			"target_player_id", event.TargetPlayerID,
			"room", event.RoomCode,
		)
		client := r.hub.GetClient(event.TargetPlayerID)
		if client != nil {
			r.logger.Info("found client for role assignment", "player_id", event.TargetPlayerID)
			client.Send(MustMessage(EventTypeRoleAssigned, event.Data))
		} else {
			r.logger.Error("client not found for role assignment", "player_id", event.TargetPlayerID)
		}

	case service.EventPhaseChanged:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypePhaseChanged, event.Data), nil)
		// Apply voice routing on phase change
		r.applyVoiceRouting(event.RoomCode, event.Data)

	case service.EventTimerTick:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeTimerTick, event.Data), nil)

	case service.EventNightResult:
		if event.TargetPlayerID != "" {
			// Send to specific player (detective investigation)
			client := r.hub.GetClient(event.TargetPlayerID)
			if client != nil {
				client.Send(MustMessage(EventTypeNightResult, event.Data))
			}
		} else {
			// Broadcast to all
			r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeNightResult, event.Data), nil)
		}

	case service.EventVoteUpdate:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage("vote_update", event.Data), nil)

	case service.EventMafiaVote:
		// Send mafia vote update to specific mafia teammate
		client := r.hub.GetClient(event.TargetPlayerID)
		if client != nil {
			client.Send(MustMessage("mafia_vote", event.Data))
		}

	case service.EventDayResult:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeDayResult, event.Data), nil)

	case service.EventGameOver:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeGameOver, event.Data), nil)
		// Apply game over voice routing (everyone can talk)
		r.applyVoiceRouting(event.RoomCode, map[string]any{"phase": "game_over"})

	case service.EventVoiceRouting:
		// Broadcast voice routing to clients
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeVoiceRouting, event.Data), nil)
	}
}

// applyVoiceRouting applies voice routing rules based on game phase
func (r *Router) applyVoiceRouting(roomCode string, phaseData any) {
	if r.sfu == nil {
		return
	}

	// Get game state
	game := r.gameService.GetGame(roomCode)
	if game == nil {
		return
	}

	// Build voice routing state
	var phase sfu.GamePhase
	if data, ok := phaseData.(map[string]any); ok {
		if p, ok := data["phase"].(string); ok {
			switch p {
			case "night":
				phase = sfu.PhaseNight
			case "day":
				phase = sfu.PhaseDay
			case "game_over":
				phase = sfu.PhaseGameOver
			default:
				phase = sfu.PhaseLobby
			}
		}
	}

	// Build player voice states
	var players []sfu.PlayerVoiceState
	for playerID, role := range game.Roles {
		player := game.Room.GetPlayer(playerID)
		if player == nil {
			continue
		}

		team := sfu.TeamTown
		if role.GetTeam() == entity.TeamMafia {
			team = sfu.TeamMafia
		}

		players = append(players, sfu.PlayerVoiceState{
			ID:      playerID,
			Team:    team,
			IsAlive: player.Status == entity.PlayerStatusAlive,
		})
	}

	// Apply routing
	state := sfu.VoiceRoutingState{
		Phase:   phase,
		Players: players,
	}
	r.sfu.ApplyVoiceRouting(roomCode, state)

	// Build and broadcast voice routing to clients
	routing := sfu.CalculateRouting(phase, convertToPlayerInfo(players))
	var clientRouting []VoiceRoutingPlayerState
	for _, ps := range routing {
		clientRouting = append(clientRouting, VoiceRoutingPlayerState{
			PlayerID: ps.ID,
			CanSpeak: ps.CanSpeak,
			CanHear:  ps.CanHear,
		})
	}

	r.hub.BroadcastToRoom(roomCode, MustMessage(EventTypeVoiceRouting, VoiceRoutingPayload{
		Phase:   string(phase),
		Players: clientRouting,
	}), nil)
}

func convertToPlayerInfo(players []sfu.PlayerVoiceState) []sfu.PlayerInfo {
	result := make([]sfu.PlayerInfo, len(players))
	for i, p := range players {
		result[i] = sfu.PlayerInfo{
			ID:      p.ID,
			Team:    p.Team,
			IsAlive: p.IsAlive,
		}
	}
	return result
}
