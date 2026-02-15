package sfu

import (
	"sync"

	"github.com/pion/webrtc/v4"
)

// Participant represents a voice chat participant
type Participant struct {
	ID           string
	RoomCode     string
	PeerConn     *webrtc.PeerConnection
	AudioTrack   *webrtc.TrackLocalStaticRTP
	AudioSender  *webrtc.RTPSender
	CanSpeak     bool
	CanHear      []string // list of participant IDs this participant can hear
	IsSpeaking   bool
	mu           sync.RWMutex
}

// NewParticipant creates a new participant
func NewParticipant(id, roomCode string) *Participant {
	return &Participant{
		ID:       id,
		RoomCode: roomCode,
		CanSpeak: true,
		CanHear:  make([]string, 0),
	}
}

// SetPeerConnection sets the WebRTC peer connection
func (p *Participant) SetPeerConnection(pc *webrtc.PeerConnection) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.PeerConn = pc
}

// SetAudioTrack sets the local audio track
func (p *Participant) SetAudioTrack(track *webrtc.TrackLocalStaticRTP) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.AudioTrack = track
}

// SetSpeakingState updates the speaking indicator
func (p *Participant) SetSpeakingState(speaking bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.IsSpeaking = speaking
}

// SetCanSpeak updates whether participant can transmit audio
func (p *Participant) SetCanSpeak(canSpeak bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.CanSpeak = canSpeak
}

// SetCanHear updates the list of participants this one can hear
func (p *Participant) SetCanHear(ids []string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.CanHear = ids
}

// GetCanHear returns the list of participant IDs this participant can hear
func (p *Participant) GetCanHear() []string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	result := make([]string, len(p.CanHear))
	copy(result, p.CanHear)
	return result
}

// CanHearParticipant checks if this participant can hear another
func (p *Participant) CanHearParticipant(id string) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	for _, hearID := range p.CanHear {
		if hearID == id {
			return true
		}
	}
	return false
}

// Close closes the peer connection
func (p *Participant) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.PeerConn != nil {
		return p.PeerConn.Close()
	}
	return nil
}
