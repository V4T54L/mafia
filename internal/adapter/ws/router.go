package ws

import (
	"encoding/json"
	"log/slog"

	"github.com/V4T54L/mafia/internal/domain/entity"
	"github.com/V4T54L/mafia/internal/domain/service"
)

// Router handles WebSocket message routing
type Router struct {
	hub         *Hub
	roomService *service.RoomService
	gameService *service.GameService
	logger      *slog.Logger
}

// NewRouter creates a new message router
func NewRouter(hub *Hub, roomService *service.RoomService, gameService *service.GameService, logger *slog.Logger) *Router {
	r := &Router{
		hub:         hub,
		roomService: roomService,
		gameService: gameService,
		logger:      logger,
	}

	// Set up game event handler
	gameService.SetEventHandler(r.handleGameEvent)

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
	default:
		client.SendError("unknown_message", "Unknown message type: "+msg.Type)
	}
}

// HandleDisconnect handles client disconnection
func (r *Router) HandleDisconnect(client *Client) {
	if client.RoomCode == "" {
		return
	}

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
		ID:       dto.ID,
		Nickname: dto.Nickname,
		IsHost:   dto.IsHost,
		IsReady:  dto.IsReady,
		Status:   dto.Status,
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

// handleGameEvent processes events from the game service
func (r *Router) handleGameEvent(event service.GameEvent) {
	switch event.Type {
	case service.EventGameStarted:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeGameStarting, nil), nil)

	case service.EventRoleAssigned:
		// Send to specific player
		client := r.hub.GetClient(event.TargetPlayerID)
		if client != nil {
			client.Send(MustMessage(EventTypeRoleAssigned, event.Data))
		}

	case service.EventPhaseChanged:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypePhaseChanged, event.Data), nil)

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

	case service.EventDayResult:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeDayResult, event.Data), nil)

	case service.EventGameOver:
		r.hub.BroadcastToRoom(event.RoomCode, MustMessage(EventTypeGameOver, event.Data), nil)
	}
}
