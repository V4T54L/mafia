package ws

import "encoding/json"

// Message types (client -> server)
const (
	// Room actions
	MsgTypeCreateRoom = "create_room"
	MsgTypeJoinRoom   = "join_room"
	MsgTypeLeaveRoom  = "leave_room"

	// Lobby actions
	MsgTypeReady          = "ready"
	MsgTypeUpdateSettings = "update_settings"
	MsgTypeStartGame      = "start_game"

	// Game actions
	MsgTypeNightAction = "night_action"
	MsgTypeDayVote     = "day_vote"
	MsgTypeGhostChat   = "ghost_chat"

	// Voice actions
	MsgTypeVoiceJoin      = "voice_join"
	MsgTypeVoiceLeave     = "voice_leave"
	MsgTypeVoiceOffer     = "voice_offer"
	MsgTypeVoiceAnswer    = "voice_answer"
	MsgTypeVoiceCandidate = "voice_candidate"
	MsgTypeSpeakingState  = "speaking_state"
)

// Event types (server -> client)
const (
	// Connection events
	EventTypeConnected = "connected"
	EventTypeError     = "error"

	// Room events
	EventTypeRoomCreated  = "room_created"
	EventTypeRoomJoined   = "room_joined"
	EventTypePlayerJoined = "player_joined"
	EventTypePlayerLeft   = "player_left"

	// Lobby events
	EventTypePlayerReady     = "player_ready"
	EventTypeSettingsUpdated = "settings_updated"
	EventTypeGameStarting    = "game_starting"

	// Game events
	EventTypeRoleAssigned = "role_assigned"
	EventTypePhaseChanged = "phase_changed"
	EventTypeTimerTick    = "timer_tick"
	EventTypeNightResult  = "night_result"
	EventTypeDayResult    = "day_result"
	EventTypeGameOver        = "game_over"
	EventTypeGhostChatBroadcast = "ghost_chat_broadcast"

	// State sync
	EventTypeRoomState = "room_state"
	EventTypeGameState = "game_state"

	// Voice events
	EventTypeVoiceJoined    = "voice_joined"
	EventTypeVoiceLeft      = "voice_left"
	EventTypeVoiceOffer     = "voice_offer"
	EventTypeVoiceAnswer    = "voice_answer"
	EventTypeVoiceCandidate = "voice_candidate"
	EventTypeSpeakingState  = "speaking_state"
	EventTypeVoiceRouting   = "voice_routing"
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

// GhostChatPayload is sent by dead players to chat
type GhostChatPayload struct {
	Message string `json:"message"`
}

// GhostChatBroadcastPayload is sent to dead players
type GhostChatBroadcastPayload struct {
	FromID       string `json:"from_id"`
	FromNickname string `json:"from_nickname"`
	Message      string `json:"message"`
	Timestamp    int64  `json:"timestamp"`
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
	Winner  string            `json:"winner"` // "town" or "mafia"
	Players []PlayerDTO       `json:"players"`
	Roles   map[string]string `json:"roles"` // player ID -> role
}

// --- Voice payload types ---

// VoiceOfferPayload is sent by client with SDP offer
type VoiceOfferPayload struct {
	SDP string `json:"sdp"`
}

// VoiceAnswerPayload is sent by server with SDP answer
type VoiceAnswerPayload struct {
	SDP string `json:"sdp"`
}

// VoiceCandidatePayload is sent for ICE candidates
type VoiceCandidatePayload struct {
	Candidate        string `json:"candidate"`
	SDPMid           string `json:"sdp_mid"`
	SDPMLineIndex    uint16 `json:"sdp_mline_index"`
	UsernameFragment string `json:"username_fragment,omitempty"`
}

// SpeakingStatePayload is sent when speaking state changes
type SpeakingStatePayload struct {
	PlayerID string `json:"player_id"`
	Speaking bool   `json:"speaking"`
}

// VoiceRoutingPayload is sent when voice permissions change
type VoiceRoutingPayload struct {
	Phase    string                     `json:"phase"`
	Players  []VoiceRoutingPlayerState  `json:"players"`
}

// VoiceRoutingPlayerState represents a player's voice permissions
type VoiceRoutingPlayerState struct {
	PlayerID string   `json:"player_id"`
	CanSpeak bool     `json:"can_speak"`
	CanHear  []string `json:"can_hear"` // player IDs this player can hear
}

// VoiceJoinedPayload is sent when a player joins voice
type VoiceJoinedPayload struct {
	PlayerID string `json:"player_id"`
}

// VoiceLeftPayload is sent when a player leaves voice
type VoiceLeftPayload struct {
	PlayerID string `json:"player_id"`
}
