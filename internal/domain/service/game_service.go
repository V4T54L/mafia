package service

import (
	"log/slog"
	"sync"
	"time"

	"github.com/V4T54L/mafia/internal/domain/entity"
)

// GameEventType represents types of game events
type GameEventType string

const (
	EventGameStarted    GameEventType = "game_started"
	EventRoleAssigned   GameEventType = "role_assigned"
	EventPhaseChanged   GameEventType = "phase_changed"
	EventTimerTick      GameEventType = "timer_tick"
	EventNightResult    GameEventType = "night_result"
	EventDayResult      GameEventType = "day_result"
	EventVoteUpdate     GameEventType = "vote_update"
	EventMafiaVote      GameEventType = "mafia_vote"
	EventGameOver       GameEventType = "game_over"
	EventVoiceRouting   GameEventType = "voice_routing"
)

// GameEvent is emitted when game state changes
type GameEvent struct {
	Type     GameEventType
	RoomCode string
	Data     any
	// For targeted events (e.g., role reveal to specific player)
	TargetPlayerID string
}

// GameEventHandler handles game events
type GameEventHandler func(event GameEvent)

// GameService manages active games
type GameService struct {
	games        map[string]*entity.Game // room code -> game
	roomService  *RoomService
	eventHandler GameEventHandler
	logger       *slog.Logger
	mu           sync.RWMutex

	// Timer management
	phaseTimers   map[string]*time.Timer
	timerCancels  map[string]chan struct{} // cancel channels for ticker goroutines
	timerMu       sync.Mutex
}

// NewGameService creates a new game service
func NewGameService(roomService *RoomService, logger *slog.Logger) *GameService {
	return &GameService{
		games:        make(map[string]*entity.Game),
		roomService:  roomService,
		logger:       logger,
		phaseTimers:  make(map[string]*time.Timer),
		timerCancels: make(map[string]chan struct{}),
	}
}

// SetEventHandler sets the handler for game events
func (s *GameService) SetEventHandler(handler GameEventHandler) {
	s.eventHandler = handler
}

// emitEvent sends an event to the handler
func (s *GameService) emitEvent(event GameEvent) {
	if s.eventHandler != nil {
		s.eventHandler(event)
	}
}

// StartGame starts a game in the specified room
func (s *GameService) StartGame(roomCode, hostPlayerID string) error {
	room, err := s.roomService.GetRoom(roomCode)
	if err != nil {
		return err
	}

	// Verify host
	host := room.GetHost()
	if host == nil || host.ID != hostPlayerID {
		return entity.ErrNotHost
	}

	// Create game
	game, err := entity.NewGame(room)
	if err != nil {
		return err
	}

	s.mu.Lock()
	s.games[roomCode] = game
	s.mu.Unlock()

	s.logger.Info("game started",
		"room", roomCode,
		"players", room.PlayerCount(),
	)

	// Emit game started event
	s.emitEvent(GameEvent{
		Type:     EventGameStarted,
		RoomCode: roomCode,
	})

	// Send role assignments to each player
	for _, playerID := range room.PlayerOrder {
		roleData := game.GetRoleRevealData(playerID)
		s.emitEvent(GameEvent{
			Type:           EventRoleAssigned,
			RoomCode:       roomCode,
			TargetPlayerID: playerID,
			Data:           roleData,
		})
	}

	// Start role reveal phase timer (5 seconds)
	s.schedulePhaseTransition(roomCode, 5*time.Second, func() {
		s.transitionToNight(roomCode)
	})

	return nil
}

// GetGame returns a game by room code
func (s *GameService) GetGame(roomCode string) *entity.Game {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.games[roomCode]
}

// transitionToNight moves the game to night phase
func (s *GameService) transitionToNight(roomCode string) {
	game := s.GetGame(roomCode)
	if game == nil {
		return
	}

	duration := time.Duration(game.Room.Settings.NightTimer) * time.Second
	game.StartNight(duration)
	game.Round++

	s.logger.Info("night phase started",
		"room", roomCode,
		"round", game.Round,
	)

	s.emitEvent(GameEvent{
		Type:     EventPhaseChanged,
		RoomCode: roomCode,
		Data: map[string]any{
			"phase": "night",
			"round": game.Round,
			"timer": game.Room.Settings.NightTimer,
		},
	})

	// Start night timer
	s.startPhaseTimer(roomCode, duration, func() {
		s.resolveNight(roomCode)
	})
}

// SubmitNightAction handles a player's night action
func (s *GameService) SubmitNightAction(roomCode, playerID, targetID string) error {
	game := s.GetGame(roomCode)
	if game == nil {
		return entity.ErrGameNotStarted
	}

	// Get player role before submitting (to check if mafia)
	role := game.GetPlayerRole(playerID)

	err := game.SubmitNightAction(playerID, targetID)
	if err != nil {
		return err
	}

	s.logger.Debug("night action submitted",
		"room", roomCode,
		"player", playerID,
		"target", targetID,
	)

	// If mafia voted, notify other mafia teammates
	if role == entity.RoleMafia || role == entity.RoleGodfather {
		// Get target nickname
		targetNickname := ""
		if player := game.Room.GetPlayer(targetID); player != nil {
			targetNickname = player.Nickname
		}
		// Get voter nickname
		voterNickname := ""
		if player := game.Room.GetPlayer(playerID); player != nil {
			voterNickname = player.Nickname
		}

		// Notify all mafia teammates (including the voter, for confirmation)
		mafiaTeammates := game.GetMafiaTeammates(playerID)
		mafiaTeammates = append(mafiaTeammates, playerID) // include self
		for _, teammateID := range mafiaTeammates {
			s.emitEvent(GameEvent{
				Type:           EventMafiaVote,
				RoomCode:       roomCode,
				TargetPlayerID: teammateID,
				Data: map[string]any{
					"voter_id":        playerID,
					"voter_nickname":  voterNickname,
					"target_id":       targetID,
					"target_nickname": targetNickname,
					"votes":           game.GetMafiaVotes(),
				},
			})
		}
	}

	// Check if all actions are complete
	if game.AllNightActionsComplete() {
		s.cancelPhaseTimer(roomCode)
		s.resolveNight(roomCode)
	}

	return nil
}

// resolveNight processes night actions and moves to day (or game over)
func (s *GameService) resolveNight(roomCode string) {
	game := s.GetGame(roomCode)
	if game == nil {
		return
	}

	result := game.ResolveNight()

	s.logger.Info("night resolved",
		"room", roomCode,
		"killed", result.KilledNickname,
		"saved", result.WasSaved,
	)

	// Send night result to all players
	s.emitEvent(GameEvent{
		Type:     EventNightResult,
		RoomCode: roomCode,
		Data: map[string]any{
			"killed":          result.KilledID,
			"killed_nickname": result.KilledNickname,
			"was_saved":       result.WasSaved,
		},
	})

	// Send detective result only to detective
	if result.DetectiveResult != nil {
		for playerID, role := range game.Roles {
			if role == entity.RoleDetective {
				s.emitEvent(GameEvent{
					Type:           EventNightResult,
					RoomCode:       roomCode,
					TargetPlayerID: playerID,
					Data: map[string]any{
						"investigation": map[string]any{
							"target_id":       result.DetectiveResult.TargetID,
							"target_nickname": result.DetectiveResult.TargetNickname,
							"is_mafia":        result.DetectiveResult.IsMafia,
						},
					},
				})
				break
			}
		}
	}

	// Check win condition
	if ended, winner := game.CheckWinCondition(); ended {
		s.endGame(roomCode, winner)
		return
	}

	// Transition to day after showing result (3 seconds)
	s.schedulePhaseTransition(roomCode, 3*time.Second, func() {
		s.transitionToDay(roomCode)
	})
}

// transitionToDay moves the game to day phase
func (s *GameService) transitionToDay(roomCode string) {
	game := s.GetGame(roomCode)
	if game == nil {
		return
	}

	// Day phase is 2x night timer for discussion + voting
	duration := time.Duration(game.Room.Settings.NightTimer*2) * time.Second
	game.StartDay(duration)

	s.logger.Info("day phase started",
		"room", roomCode,
		"round", game.Round,
	)

	s.emitEvent(GameEvent{
		Type:     EventPhaseChanged,
		RoomCode: roomCode,
		Data: map[string]any{
			"phase": "day",
			"round": game.Round,
			"timer": game.Room.Settings.NightTimer * 2,
		},
	})

	// Start day timer (no ticker - voting doesn't need countdown display)
	s.startDayTimer(roomCode, duration, func() {
		s.resolveDay(roomCode)
	})
}

// SubmitDayVote handles a player's vote
func (s *GameService) SubmitDayVote(roomCode, voterID, targetID string) error {
	game := s.GetGame(roomCode)
	if game == nil {
		return entity.ErrGameNotStarted
	}

	err := game.SubmitDayVote(voterID, targetID)
	if err != nil {
		return err
	}

	s.logger.Debug("vote submitted",
		"room", roomCode,
		"voter", voterID,
		"target", targetID,
	)

	// Broadcast vote update with detailed vote information
	votes, submitted := game.GetVoteDetails()
	s.emitEvent(GameEvent{
		Type:     EventVoteUpdate,
		RoomCode: roomCode,
		Data: map[string]any{
			"votes":     votes,     // voter ID -> target ID
			"submitted": submitted, // list of voter IDs who have finalized
		},
	})

	// Check if all votes are in
	if game.AllDayVotesComplete() {
		s.cancelPhaseTimer(roomCode)
		s.resolveDay(roomCode)
	}

	return nil
}

// resolveDay processes votes and moves to night (or game over)
func (s *GameService) resolveDay(roomCode string) {
	game := s.GetGame(roomCode)
	if game == nil {
		return
	}

	result := game.ResolveDay()

	s.logger.Info("day resolved",
		"room", roomCode,
		"eliminated", result.EliminatedNickname,
		"no_majority", result.NoMajority,
	)

	// Send day result
	var eliminatedRole string
	if result.EliminatedRole != "" {
		eliminatedRole = string(result.EliminatedRole)
	}

	s.emitEvent(GameEvent{
		Type:     EventDayResult,
		RoomCode: roomCode,
		Data: map[string]any{
			"eliminated":          result.EliminatedID,
			"eliminated_nickname": result.EliminatedNickname,
			"eliminated_role":     eliminatedRole,
			"votes":               result.VoteCounts,
			"no_majority":         result.NoMajority,
		},
	})

	// Check win condition
	if ended, winner := game.CheckWinCondition(); ended {
		s.endGame(roomCode, winner)
		return
	}

	// Transition to night after showing result (3 seconds)
	s.schedulePhaseTransition(roomCode, 3*time.Second, func() {
		s.transitionToNight(roomCode)
	})
}

// endGame finishes the game and announces winner
func (s *GameService) endGame(roomCode string, winner entity.Team) {
	game := s.GetGame(roomCode)
	if game == nil {
		return
	}

	game.EndGame(winner)

	s.logger.Info("game ended",
		"room", roomCode,
		"winner", winner,
	)

	// Build player list with roles revealed
	players := make([]map[string]any, 0)
	for _, playerID := range game.Room.PlayerOrder {
		if player := game.Room.GetPlayer(playerID); player != nil {
			players = append(players, map[string]any{
				"id":       player.ID,
				"nickname": player.Nickname,
				"role":     string(game.Roles[playerID]),
				"status":   string(player.Status),
			})
		}
	}

	s.emitEvent(GameEvent{
		Type:     EventGameOver,
		RoomCode: roomCode,
		Data: map[string]any{
			"winner":  string(winner),
			"players": players,
		},
	})

	// Cleanup
	s.cancelPhaseTimer(roomCode)
	s.mu.Lock()
	delete(s.games, roomCode)
	s.mu.Unlock()
}

// Timer management

func (s *GameService) schedulePhaseTransition(roomCode string, delay time.Duration, callback func()) {
	s.timerMu.Lock()
	defer s.timerMu.Unlock()

	// Cancel existing timer if any
	if timer, ok := s.phaseTimers[roomCode]; ok {
		timer.Stop()
	}

	s.phaseTimers[roomCode] = time.AfterFunc(delay, callback)
}

func (s *GameService) startPhaseTimer(roomCode string, duration time.Duration, onExpire func()) {
	s.timerMu.Lock()
	defer s.timerMu.Unlock()

	// Cancel existing timer and ticker goroutine
	if timer, ok := s.phaseTimers[roomCode]; ok {
		timer.Stop()
	}
	if cancel, ok := s.timerCancels[roomCode]; ok {
		close(cancel)
	}

	// Create new cancel channel for this ticker
	cancel := make(chan struct{})
	s.timerCancels[roomCode] = cancel

	// Start countdown timer that ticks every second
	endTime := time.Now().Add(duration)
	ticker := time.NewTicker(1 * time.Second)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-cancel:
				return
			case <-ticker.C:
				remaining := int(time.Until(endTime).Seconds())
				if remaining <= 0 {
					s.timerMu.Lock()
					delete(s.phaseTimers, roomCode)
					delete(s.timerCancels, roomCode)
					s.timerMu.Unlock()
					onExpire()
					return
				}

				// Emit timer tick
				s.emitEvent(GameEvent{
					Type:     EventTimerTick,
					RoomCode: roomCode,
					Data: map[string]any{
						"remaining": remaining,
					},
				})
			}
		}
	}()

	// Store a dummy timer to track active phase
	s.phaseTimers[roomCode] = time.AfterFunc(duration, func() {})
}

func (s *GameService) cancelPhaseTimer(roomCode string) {
	s.timerMu.Lock()
	defer s.timerMu.Unlock()

	if timer, ok := s.phaseTimers[roomCode]; ok {
		timer.Stop()
		delete(s.phaseTimers, roomCode)
	}

	// Close cancel channel to stop any running ticker goroutine
	if cancel, ok := s.timerCancels[roomCode]; ok {
		close(cancel)
		delete(s.timerCancels, roomCode)
	}
}

// startDayTimer creates a simple timeout for day phase (no ticker)
// Day phase doesn't need countdown display - just waits for votes or timeout
func (s *GameService) startDayTimer(roomCode string, duration time.Duration, onExpire func()) {
	s.timerMu.Lock()
	defer s.timerMu.Unlock()

	// Cancel existing timer and ticker goroutine
	if timer, ok := s.phaseTimers[roomCode]; ok {
		timer.Stop()
	}
	if cancel, ok := s.timerCancels[roomCode]; ok {
		close(cancel)
		delete(s.timerCancels, roomCode)
	}

	// Simple timeout - no ticker, no timer_tick events
	s.phaseTimers[roomCode] = time.AfterFunc(duration, onExpire)
}

// GetGameState returns the current game state for a player
func (s *GameService) GetGameState(roomCode, playerID string) map[string]any {
	game := s.GetGame(roomCode)
	if game == nil {
		return nil
	}

	state := map[string]any{
		"phase": string(game.Phase),
		"round": game.Round,
	}

	// Add role info
	if role, ok := game.Roles[playerID]; ok {
		state["my_role"] = string(role)
		state["my_team"] = string(role.GetTeam())

		// Mafia sees teammates
		if role.GetTeam() == entity.TeamMafia {
			state["teammates"] = game.GetMafiaTeammates(playerID)
		}
	}

	// Add alive players
	state["alive_players"] = game.GetAlivePlayers()

	// Phase-specific data
	switch game.Phase {
	case entity.PhaseDay:
		state["votes"] = game.GetVoteCounts()
	}

	return state
}
