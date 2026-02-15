package ws

import "encoding/json"

// Message types (client -> server)
const (
	// Room actions
	MsgTypeCreateRoom = "create_room"
	MsgTypeJoinRoom   = "join_room"
	MsgTypeLeaveRoom  = "leave_room"

	// Lobby actions
	MsgTypeReady        = "ready"
	MsgTypeUpdateSettings = "update_settings"
	MsgTypeStartGame    = "start_game"

	// Game actions
	MsgTypeNightAction = "night_action"
	MsgTypeDayVote     = "day_vote"
)

// Event types (server -> client)
const (
	// Connection events
	EventTypeConnected = "connected"
	EventTypeError     = "error"

	// Room events
	EventTypeRoomCreated = "room_created"
	EventTypeRoomJoined  = "room_joined"
	EventTypePlayerJoined = "player_joined"
	EventTypePlayerLeft   = "player_left"

	// Lobby events
	EventTypePlayerReady    = "player_ready"
	EventTypeSettingsUpdated = "settings_updated"
	EventTypeGameStarting   = "game_starting"

	// Game events
	EventTypeRoleAssigned  = "role_assigned"
	EventTypePhaseChanged  = "phase_changed"
	EventTypeTimerTick     = "timer_tick"
	EventTypeNightResult   = "night_result"
	EventTypeDayResult     = "day_result"
	EventTypeGameOver      = "game_over"

	// State sync
	EventTypeRoomState = "room_state"
	EventTypeGameState = "game_state"
)

// Message is the envelope for all WebSocket messages
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// ParseMessage parses a raw JSON message
func ParseMessage(data []byte) (*Message, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

// NewMessage creates a new message with a typed payload
func NewMessage(msgType string, payload any) (*Message, error) {
	var raw json.RawMessage
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		raw = data
	}
	return &Message{Type: msgType, Payload: raw}, nil
}

// MustMessage creates a message, panics on error (use for static payloads)
func MustMessage(msgType string, payload any) *Message {
	msg, err := NewMessage(msgType, payload)
	if err != nil {
		panic(err)
	}
	return msg
}

// Bytes serializes the message to JSON
func (m *Message) Bytes() []byte {
	data, _ := json.Marshal(m)
	return data
}

// --- Payload types ---

// CreateRoomPayload is sent by client to create a room
type CreateRoomPayload struct {
	Password string `json:"password,omitempty"`
	Nickname string `json:"nickname"`
}

// JoinRoomPayload is sent by client to join a room
type JoinRoomPayload struct {
	RoomCode string `json:"room_code"`
	Password string `json:"password,omitempty"`
	Nickname string `json:"nickname"`
}

// ReadyPayload is sent by client to toggle ready state
type ReadyPayload struct {
	Ready bool `json:"ready"`
}

// SettingsPayload is sent by host to update game settings
type SettingsPayload struct {
	Villagers  int `json:"villagers"`
	Mafia      int `json:"mafia"`
	Godfather  int `json:"godfather"`
	Doctor     int `json:"doctor"`
	Detective  int `json:"detective"`
	NightTimer int `json:"night_timer"`
}

// NightActionPayload is sent by player during night
type NightActionPayload struct {
	TargetID string `json:"target_id"`
}

// DayVotePayload is sent by player during day
type DayVotePayload struct {
	TargetID string `json:"target_id,omitempty"` // empty = skip vote
}

// --- Event payloads (server -> client) ---

// ConnectedPayload is sent when client connects
type ConnectedPayload struct {
	PlayerID string `json:"player_id"`
}

// ErrorPayload is sent when an error occurs
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// RoomCreatedPayload is sent when room is created
type RoomCreatedPayload struct {
	RoomCode string `json:"room_code"`
	PlayerID string `json:"player_id"`
}

// RoomJoinedPayload is sent when player joins room
type RoomJoinedPayload struct {
	RoomCode string      `json:"room_code"`
	PlayerID string      `json:"player_id"`
	Players  []PlayerDTO `json:"players"`
	Settings SettingsPayload `json:"settings"`
}

// PlayerDTO is a player representation for clients
type PlayerDTO struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	IsHost   bool   `json:"is_host"`
	IsReady  bool   `json:"is_ready"`
	Status   string `json:"status"` // "alive", "dead"
}

// PlayerJoinedPayload is sent when another player joins
type PlayerJoinedPayload struct {
	Player PlayerDTO `json:"player"`
}

// PlayerLeftPayload is sent when a player leaves
type PlayerLeftPayload struct {
	PlayerID string `json:"player_id"`
	NewHost  string `json:"new_host,omitempty"` // if host left
}

// PhaseChangedPayload is sent when game phase changes
type PhaseChangedPayload struct {
	Phase     string `json:"phase"`
	Timer     int    `json:"timer,omitempty"`
	ExtraData any    `json:"extra_data,omitempty"`
}

// RoleAssignedPayload is sent to each player with their role
type RoleAssignedPayload struct {
	Role      string   `json:"role"`
	Team      string   `json:"team"`
	Teammates []string `json:"teammates,omitempty"` // for mafia
}

// NightResultPayload is sent after night phase
type NightResultPayload struct {
	Killed          string `json:"killed,omitempty"` // player ID or empty if saved
	InvestigationResult *struct {
		TargetID string `json:"target_id"`
		IsMafia  bool   `json:"is_mafia"`
	} `json:"investigation_result,omitempty"` // only for detective
}

// DayResultPayload is sent after day voting
type DayResultPayload struct {
	Eliminated string         `json:"eliminated,omitempty"` // player ID or empty if no majority
	Votes      map[string]int `json:"votes"`                // player ID -> vote count
}

// GameOverPayload is sent when game ends
type GameOverPayload struct {
	Winner  string      `json:"winner"` // "town" or "mafia"
	Players []PlayerDTO `json:"players"`
	Roles   map[string]string `json:"roles"` // player ID -> role
}
