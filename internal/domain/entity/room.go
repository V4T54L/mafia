package entity

import (
	"errors"
	"sync"
)

// RoomState represents the current state of the room
type RoomState string

const (
	RoomStateWaiting RoomState = "waiting" // in lobby
	RoomStatePlaying RoomState = "playing" // game in progress
	RoomStateEnded   RoomState = "ended"   // game finished
)

// Room errors
var (
	ErrRoomFull          = errors.New("room is full")
	ErrRoomNotFound      = errors.New("room not found")
	ErrWrongPassword     = errors.New("wrong password")
	ErrPlayerNotFound    = errors.New("player not found")
	ErrGameAlreadyStarted = errors.New("game already started")
	ErrNotEnoughPlayers  = errors.New("not enough players")
	ErrNotAllReady       = errors.New("not all players are ready")
	ErrNotHost           = errors.New("only host can do this")
	ErrNicknameInUse     = errors.New("nickname already in use")
)

const (
	MinPlayers = 6
	MaxPlayers = 12
)

// GameSettings contains the game configuration
type GameSettings struct {
	Villagers  int `json:"villagers"`
	Mafia      int `json:"mafia"`
	Godfather  int `json:"godfather"`
	Doctor     int `json:"doctor"`
	Detective  int `json:"detective"`
	NightTimer int `json:"night_timer"`
}

// DefaultSettings returns the default game settings
func DefaultSettings() GameSettings {
	return GameSettings{
		Villagers:  3,
		Mafia:      2,
		Godfather:  0,
		Doctor:     1,
		Detective:  1,
		NightTimer: 60,
	}
}

// TotalPlayers returns the total number of players needed
func (s GameSettings) TotalPlayers() int {
	return s.Villagers + s.Mafia + s.Godfather + s.Doctor + s.Detective
}

// Room represents a game room
type Room struct {
	Code         string
	PasswordHash string // empty if no password
	State        RoomState
	Settings     GameSettings
	Players      map[string]*Player // keyed by player ID
	PlayerOrder  []string           // ordered list of player IDs

	mu sync.RWMutex
}

// NewRoom creates a new room
func NewRoom(code, passwordHash string) *Room {
	return &Room{
		Code:         code,
		PasswordHash: passwordHash,
		State:        RoomStateWaiting,
		Settings:     DefaultSettings(),
		Players:      make(map[string]*Player),
		PlayerOrder:  make([]string, 0),
	}
}

// AddPlayer adds a player to the room
func (r *Room) AddPlayer(player *Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.Players) >= MaxPlayers {
		return ErrRoomFull
	}

	if r.State != RoomStateWaiting {
		return ErrGameAlreadyStarted
	}

	// Check nickname uniqueness
	for _, p := range r.Players {
		if p.Nickname == player.Nickname {
			return ErrNicknameInUse
		}
	}

	// First player becomes host
	if len(r.Players) == 0 {
		player.IsHost = true
	}

	r.Players[player.ID] = player
	r.PlayerOrder = append(r.PlayerOrder, player.ID)
	return nil
}

// RemovePlayer removes a player from the room
func (r *Room) RemovePlayer(playerID string) (*Player, string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	player, ok := r.Players[playerID]
	if !ok {
		return nil, ""
	}

	delete(r.Players, playerID)

	// Remove from order
	for i, id := range r.PlayerOrder {
		if id == playerID {
			r.PlayerOrder = append(r.PlayerOrder[:i], r.PlayerOrder[i+1:]...)
			break
		}
	}

	// Transfer host if needed
	var newHostID string
	if player.IsHost && len(r.Players) > 0 {
		// Assign host to first remaining player
		newHostID = r.PlayerOrder[0]
		r.Players[newHostID].IsHost = true
	}

	return player, newHostID
}

// GetPlayer returns a player by ID
func (r *Room) GetPlayer(playerID string) *Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Players[playerID]
}

// GetHost returns the host player
func (r *Room) GetHost() *Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.Players {
		if p.IsHost {
			return p
		}
	}
	return nil
}

// SetReady sets a player's ready state
func (r *Room) SetReady(playerID string, ready bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	player, ok := r.Players[playerID]
	if !ok {
		return ErrPlayerNotFound
	}

	player.IsReady = ready
	return nil
}

// AllReady returns true if all players are ready
func (r *Room) AllReady() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.Players) < MinPlayers {
		return false
	}

	for _, p := range r.Players {
		if !p.IsReady {
			return false
		}
	}
	return true
}

// UpdateSettings updates the game settings
func (r *Room) UpdateSettings(settings GameSettings) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Settings = settings
}

// PlayerCount returns the number of players
func (r *Room) PlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players)
}

// IsEmpty returns true if the room has no players
func (r *Room) IsEmpty() bool {
	return r.PlayerCount() == 0
}

// GetPlayersDTO returns all players as DTOs
func (r *Room) GetPlayersDTO() []PlayerDTO {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]PlayerDTO, 0, len(r.Players))
	for _, id := range r.PlayerOrder {
		if p, ok := r.Players[id]; ok {
			players = append(players, p.ToDTO())
		}
	}
	return players
}

// HasPassword returns true if the room has a password
func (r *Room) HasPassword() bool {
	return r.PasswordHash != ""
}
