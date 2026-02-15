package service

import (
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"sync"
	"time"

	"github.com/V4T54L/mafia/internal/domain/entity"
	"github.com/V4T54L/mafia/internal/pkg/id"
)

const (
	// ReconnectTimeout is how long a player has to reconnect after disconnecting
	ReconnectTimeout = 60 * time.Second
	// RoomTTL is how long an empty room persists before deletion
	RoomTTL = 5 * time.Minute
)

// DisconnectedPlayer tracks a disconnected player awaiting reconnection
type DisconnectedPlayer struct {
	PlayerID  string
	RoomCode  string
	Timer     *time.Timer
	ExpiresAt time.Time
}

// RoomService manages game rooms
type RoomService struct {
	rooms        map[string]*entity.Room           // keyed by room code
	disconnected map[string]*DisconnectedPlayer    // keyed by player ID
	roomTTL      map[string]*time.Timer            // keyed by room code, TTL cleanup timers
	mu           sync.RWMutex
	logger       *slog.Logger

	// Callback when a disconnected player times out
	onReconnectTimeout func(roomCode, playerID string)
}

// NewRoomService creates a new room service
func NewRoomService(logger *slog.Logger) *RoomService {
	return &RoomService{
		rooms:        make(map[string]*entity.Room),
		disconnected: make(map[string]*DisconnectedPlayer),
		roomTTL:      make(map[string]*time.Timer),
		logger:       logger,
	}
}

// SetReconnectTimeoutHandler sets the callback for when a disconnected player times out
func (s *RoomService) SetReconnectTimeoutHandler(handler func(roomCode, playerID string)) {
	s.onReconnectTimeout = handler
}

// CreateRoom creates a new room and returns the room code
func (s *RoomService) CreateRoom(password string) (*entity.Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Generate unique room code
	var code string
	for {
		code = id.GenerateRoomCode()
		if _, exists := s.rooms[code]; !exists {
			break
		}
	}

	// Hash password if provided
	var passwordHash string
	if password != "" {
		passwordHash = hashPassword(password)
	}

	room := entity.NewRoom(code, passwordHash)
	s.rooms[code] = room

	s.logger.Info("room created", "code", code, "has_password", password != "")
	return room, nil
}

// GetRoom returns a room by code
func (s *RoomService) GetRoom(code string) (*entity.Room, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	room, ok := s.rooms[code]
	if !ok {
		return nil, entity.ErrRoomNotFound
	}
	return room, nil
}

// JoinRoom adds a player to a room
func (s *RoomService) JoinRoom(code, password, playerID, nickname string) (*entity.Room, error) {
	room, err := s.GetRoom(code)
	if err != nil {
		return nil, err
	}

	// Verify password
	if room.HasPassword() {
		if hashPassword(password) != room.PasswordHash {
			return nil, entity.ErrWrongPassword
		}
	}

	// Cancel any pending TTL timer
	s.cancelRoomTTL(code)

	// Create player and add to room
	player := entity.NewPlayer(playerID, nickname, false)
	if err := room.AddPlayer(player); err != nil {
		return nil, err
	}

	s.logger.Info("player joined room",
		"room", code,
		"player_id", playerID,
		"nickname", nickname,
		"player_count", room.PlayerCount(),
	)

	return room, nil
}

// LeaveRoom removes a player from a room
func (s *RoomService) LeaveRoom(code, playerID string) (*entity.Player, string, error) {
	room, err := s.GetRoom(code)
	if err != nil {
		return nil, "", err
	}

	player, newHostID := room.RemovePlayer(playerID)
	if player == nil {
		return nil, "", entity.ErrPlayerNotFound
	}

	s.logger.Info("player left room",
		"room", code,
		"player_id", playerID,
		"nickname", player.Nickname,
		"new_host", newHostID,
		"player_count", room.PlayerCount(),
	)

	// Start TTL timer for empty rooms
	if room.IsEmpty() {
		s.startRoomTTL(code)
	}

	return player, newHostID, nil
}

// SetReady sets a player's ready state
func (s *RoomService) SetReady(code, playerID string, ready bool) error {
	room, err := s.GetRoom(code)
	if err != nil {
		return err
	}

	return room.SetReady(playerID, ready)
}

// UpdateSettings updates game settings (host only)
func (s *RoomService) UpdateSettings(code, playerID string, settings entity.GameSettings) error {
	room, err := s.GetRoom(code)
	if err != nil {
		return err
	}

	player := room.GetPlayer(playerID)
	if player == nil {
		return entity.ErrPlayerNotFound
	}

	if !player.IsHost {
		return entity.ErrNotHost
	}

	room.UpdateSettings(settings)
	s.logger.Debug("settings updated", "room", code, "by", playerID)
	return nil
}

// DeleteRoom removes a room
func (s *RoomService) DeleteRoom(code string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Cancel TTL timer if exists
	if timer, ok := s.roomTTL[code]; ok {
		timer.Stop()
		delete(s.roomTTL, code)
	}

	delete(s.rooms, code)
	s.logger.Info("room deleted", "code", code)
}

// startRoomTTL starts a cleanup timer for an empty room
func (s *RoomService) startRoomTTL(code string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Cancel existing timer if any
	if timer, ok := s.roomTTL[code]; ok {
		timer.Stop()
	}

	s.logger.Info("room TTL started", "code", code, "ttl", RoomTTL)

	s.roomTTL[code] = time.AfterFunc(RoomTTL, func() {
		s.mu.Lock()
		room, exists := s.rooms[code]
		if exists && room.IsEmpty() {
			delete(s.rooms, code)
			delete(s.roomTTL, code)
			s.logger.Info("room expired and deleted", "code", code)
		} else {
			// Room has players now, just clean up timer reference
			delete(s.roomTTL, code)
		}
		s.mu.Unlock()
	})
}

// cancelRoomTTL cancels a pending room cleanup timer
func (s *RoomService) cancelRoomTTL(code string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if timer, ok := s.roomTTL[code]; ok {
		timer.Stop()
		delete(s.roomTTL, code)
		s.logger.Debug("room TTL cancelled", "code", code)
	}
}

// RoomCount returns the number of active rooms
func (s *RoomService) RoomCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.rooms)
}

// MarkPlayerDisconnected marks a player as disconnected and starts the reconnection timer
// Returns true if the player was marked as disconnected (game in progress)
// Returns false if the player should be removed immediately (lobby phase)
func (s *RoomService) MarkPlayerDisconnected(code, playerID string) bool {
	room, err := s.GetRoom(code)
	if err != nil {
		return false
	}

	player := room.GetPlayer(playerID)
	if player == nil {
		return false
	}

	// Only allow reconnection during active games
	if room.State != entity.RoomStatePlaying {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Mark player as disconnected
	player.IsConnected = false

	// Start reconnection timer
	timer := time.AfterFunc(ReconnectTimeout, func() {
		s.handleReconnectTimeout(code, playerID)
	})

	s.disconnected[playerID] = &DisconnectedPlayer{
		PlayerID:  playerID,
		RoomCode:  code,
		Timer:     timer,
		ExpiresAt: time.Now().Add(ReconnectTimeout),
	}

	s.logger.Info("player disconnected, awaiting reconnect",
		"room", code,
		"player_id", playerID,
		"timeout", ReconnectTimeout,
	)

	return true
}

// handleReconnectTimeout handles when a disconnected player's timer expires
func (s *RoomService) handleReconnectTimeout(code, playerID string) {
	s.mu.Lock()
	dp, ok := s.disconnected[playerID]
	if !ok {
		s.mu.Unlock()
		return
	}
	delete(s.disconnected, playerID)
	s.mu.Unlock()

	s.logger.Info("reconnection timeout expired",
		"room", code,
		"player_id", playerID,
	)

	// Call the timeout handler if set
	if s.onReconnectTimeout != nil {
		s.onReconnectTimeout(dp.RoomCode, dp.PlayerID)
	}
}

// CanReconnect checks if a player can reconnect to a room
func (s *RoomService) CanReconnect(playerID string) (*DisconnectedPlayer, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	dp, ok := s.disconnected[playerID]
	if !ok {
		return nil, false
	}

	// Check if not expired
	if time.Now().After(dp.ExpiresAt) {
		return nil, false
	}

	return dp, true
}

// ReconnectPlayer restores a disconnected player's connection
func (s *RoomService) ReconnectPlayer(playerID string) (*entity.Room, error) {
	s.mu.Lock()
	dp, ok := s.disconnected[playerID]
	if !ok {
		s.mu.Unlock()
		return nil, entity.ErrPlayerNotFound
	}

	// Stop the timer
	dp.Timer.Stop()
	delete(s.disconnected, playerID)
	s.mu.Unlock()

	// Get the room
	room, err := s.GetRoom(dp.RoomCode)
	if err != nil {
		return nil, err
	}

	// Mark player as connected
	player := room.GetPlayer(playerID)
	if player == nil {
		return nil, entity.ErrPlayerNotFound
	}
	player.IsConnected = true

	s.logger.Info("player reconnected",
		"room", dp.RoomCode,
		"player_id", playerID,
	)

	return room, nil
}

// CancelReconnectTimer cancels a pending reconnection timer (e.g., when player is removed)
func (s *RoomService) CancelReconnectTimer(playerID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if dp, ok := s.disconnected[playerID]; ok {
		dp.Timer.Stop()
		delete(s.disconnected, playerID)
	}
}

// hashPassword creates a simple hash of the password
// Note: For MVP, using simple SHA256. In production, use bcrypt.
func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}
