package service

import (
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"sync"

	"github.com/V4T54L/mafia/internal/domain/entity"
	"github.com/V4T54L/mafia/internal/pkg/id"
)

// RoomService manages game rooms
type RoomService struct {
	rooms  map[string]*entity.Room // keyed by room code
	mu     sync.RWMutex
	logger *slog.Logger
}

// NewRoomService creates a new room service
func NewRoomService(logger *slog.Logger) *RoomService {
	return &RoomService{
		rooms:  make(map[string]*entity.Room),
		logger: logger,
	}
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

	// Clean up empty rooms
	if room.IsEmpty() {
		s.DeleteRoom(code)
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

	delete(s.rooms, code)
	s.logger.Info("room deleted", "code", code)
}

// RoomCount returns the number of active rooms
func (s *RoomService) RoomCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.rooms)
}

// hashPassword creates a simple hash of the password
// Note: For MVP, using simple SHA256. In production, use bcrypt.
func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}
