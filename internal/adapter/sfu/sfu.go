package sfu

import (
	"fmt"
	"log/slog"
	"sync"

	"github.com/pion/webrtc/v4"
)

// SFU manages WebRTC connections and audio routing
type SFU struct {
	config   *Config
	rooms    map[string]*VoiceRoom
	api      *webrtc.API
	logger   *slog.Logger
	mu       sync.RWMutex
}

// New creates a new SFU instance
func New(config *Config, logger *slog.Logger) (*SFU, error) {
	// Create media engine
	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		return nil, fmt.Errorf("failed to register codecs: %w", err)
	}

	// Create setting engine with UDP port range
	settingEngine := webrtc.SettingEngine{}
	settingEngine.SetEphemeralUDPPortRange(uint16(config.UDPPortMin), uint16(config.UDPPortMax))

	// Create WebRTC API
	api := webrtc.NewAPI(
		webrtc.WithMediaEngine(mediaEngine),
		webrtc.WithSettingEngine(settingEngine),
	)

	sfu := &SFU{
		config: config,
		rooms:  make(map[string]*VoiceRoom),
		api:    api,
		logger: logger,
	}

	logger.Info("SFU initialized",
		"udp_port_range", fmt.Sprintf("%d-%d", config.UDPPortMin, config.UDPPortMax),
		"stun_server", config.STUNServer,
	)

	return sfu, nil
}

// GetOrCreateRoom gets or creates a voice room
func (s *SFU) GetOrCreateRoom(roomCode string) *VoiceRoom {
	s.mu.Lock()
	defer s.mu.Unlock()

	if room, ok := s.rooms[roomCode]; ok {
		return room
	}

	room := NewVoiceRoom(roomCode, s.logger)
	s.rooms[roomCode] = room
	s.logger.Info("voice room created", "room", roomCode)
	return room
}

// GetRoom returns a voice room if it exists
func (s *SFU) GetRoom(roomCode string) *VoiceRoom {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rooms[roomCode]
}

// RemoveRoom removes a voice room
func (s *SFU) RemoveRoom(roomCode string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if room, ok := s.rooms[roomCode]; ok {
		room.Close()
		delete(s.rooms, roomCode)
		s.logger.Info("voice room removed", "room", roomCode)
	}
}

// CreatePeerConnection creates a new WebRTC peer connection
func (s *SFU) CreatePeerConnection() (*webrtc.PeerConnection, error) {
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{s.config.STUNServer},
			},
		},
	}

	return s.api.NewPeerConnection(config)
}

// JoinVoice creates a participant and peer connection for a player
func (s *SFU) JoinVoice(roomCode, playerID string) (*Participant, error) {
	room := s.GetOrCreateRoom(roomCode)

	// Check if already joined
	existing := room.GetParticipant(playerID)
	if existing != nil {
		return existing, nil
	}

	// Create peer connection
	pc, err := s.CreatePeerConnection()
	if err != nil {
		return nil, fmt.Errorf("failed to create peer connection: %w", err)
	}

	// Create participant
	participant := NewParticipant(playerID, roomCode)
	participant.SetPeerConnection(pc)

	// Add to room
	room.AddParticipant(participant)

	s.logger.Debug("player joined voice",
		"room", roomCode,
		"player", playerID,
	)

	return participant, nil
}

// LeaveVoice removes a player from voice chat
func (s *SFU) LeaveVoice(roomCode, playerID string) {
	room := s.GetRoom(roomCode)
	if room == nil {
		return
	}

	room.RemoveParticipant(playerID)

	// Clean up empty rooms
	if room.ParticipantCount() == 0 {
		s.RemoveRoom(roomCode)
	}

	s.logger.Debug("player left voice",
		"room", roomCode,
		"player", playerID,
	)
}

// HandleOffer processes an SDP offer from a client
func (s *SFU) HandleOffer(roomCode, playerID string, offer webrtc.SessionDescription) (*webrtc.SessionDescription, error) {
	room := s.GetRoom(roomCode)
	if room == nil {
		return nil, fmt.Errorf("room not found: %s", roomCode)
	}

	participant := room.GetParticipant(playerID)
	if participant == nil {
		return nil, fmt.Errorf("participant not found: %s", playerID)
	}

	pc := participant.PeerConn
	if pc == nil {
		return nil, fmt.Errorf("peer connection not found for: %s", playerID)
	}

	// Set remote description (offer)
	if err := pc.SetRemoteDescription(offer); err != nil {
		return nil, fmt.Errorf("failed to set remote description: %w", err)
	}

	// Create answer
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create answer: %w", err)
	}

	// Set local description (answer)
	if err := pc.SetLocalDescription(answer); err != nil {
		return nil, fmt.Errorf("failed to set local description: %w", err)
	}

	return pc.LocalDescription(), nil
}

// AddICECandidate adds an ICE candidate to a peer connection
func (s *SFU) AddICECandidate(roomCode, playerID string, candidate webrtc.ICECandidateInit) error {
	room := s.GetRoom(roomCode)
	if room == nil {
		return fmt.Errorf("room not found: %s", roomCode)
	}

	participant := room.GetParticipant(playerID)
	if participant == nil {
		return fmt.Errorf("participant not found: %s", playerID)
	}

	pc := participant.PeerConn
	if pc == nil {
		return fmt.Errorf("peer connection not found for: %s", playerID)
	}

	return pc.AddICECandidate(candidate)
}

// SetSpeakingState updates speaking indicator for a player
func (s *SFU) SetSpeakingState(roomCode, playerID string, speaking bool) {
	room := s.GetRoom(roomCode)
	if room != nil {
		room.SetSpeakingState(playerID, speaking)
	}
}

// GetSpeakingStates returns speaking states for all players in a room
func (s *SFU) GetSpeakingStates(roomCode string) map[string]bool {
	room := s.GetRoom(roomCode)
	if room == nil {
		return nil
	}
	return room.GetSpeakingStates()
}

// ApplyVoiceRouting applies voice routing rules to a room
func (s *SFU) ApplyVoiceRouting(roomCode string, state VoiceRoutingState) {
	room := s.GetRoom(roomCode)
	if room == nil {
		return
	}
	room.GetRouter().ApplyRouting(state)
}

// Close shuts down the SFU
func (s *SFU) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, room := range s.rooms {
		room.Close()
	}
	s.rooms = make(map[string]*VoiceRoom)
	s.logger.Info("SFU shut down")
}
