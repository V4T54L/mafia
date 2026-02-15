package sfu

import (
	"log/slog"
	"sync"
)

// VoiceRoom manages voice participants for a game room
type VoiceRoom struct {
	Code         string
	participants map[string]*Participant
	router       *Router
	logger       *slog.Logger
	mu           sync.RWMutex
}

// NewVoiceRoom creates a new voice room
func NewVoiceRoom(code string, logger *slog.Logger) *VoiceRoom {
	room := &VoiceRoom{
		Code:         code,
		participants: make(map[string]*Participant),
		logger:       logger,
	}
	room.router = NewRouter(room)
	return room
}

// AddParticipant adds a participant to the room
func (r *VoiceRoom) AddParticipant(participant *Participant) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.participants[participant.ID] = participant
	r.logger.Debug("participant added to voice room",
		"room", r.Code,
		"participant", participant.ID,
	)
}

// RemoveParticipant removes a participant from the room
func (r *VoiceRoom) RemoveParticipant(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.participants[playerID]; ok {
		p.Close()
		delete(r.participants, playerID)
		r.logger.Debug("participant removed from voice room",
			"room", r.Code,
			"participant", playerID,
		)
	}
}

// GetParticipant returns a participant by ID
func (r *VoiceRoom) GetParticipant(playerID string) *Participant {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.participants[playerID]
}

// GetParticipants returns all participants
func (r *VoiceRoom) GetParticipants() []*Participant {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*Participant, 0, len(r.participants))
	for _, p := range r.participants {
		result = append(result, p)
	}
	return result
}

// GetParticipantIDs returns all participant IDs
func (r *VoiceRoom) GetParticipantIDs() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]string, 0, len(r.participants))
	for id := range r.participants {
		result = append(result, id)
	}
	return result
}

// GetRouter returns the voice router
func (r *VoiceRoom) GetRouter() *Router {
	return r.router
}

// GetSpeakingStates returns a map of player ID to speaking state
func (r *VoiceRoom) GetSpeakingStates() map[string]bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make(map[string]bool)
	for id, p := range r.participants {
		result[id] = p.IsSpeaking
	}
	return result
}

// SetSpeakingState updates a participant's speaking state
func (r *VoiceRoom) SetSpeakingState(playerID string, speaking bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.participants[playerID]; ok {
		p.SetSpeakingState(speaking)
	}
}

// ParticipantCount returns the number of participants
func (r *VoiceRoom) ParticipantCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.participants)
}

// Close closes all participant connections and cleans up
func (r *VoiceRoom) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, p := range r.participants {
		p.Close()
	}
	r.participants = make(map[string]*Participant)
	r.logger.Debug("voice room closed", "room", r.Code)
}
