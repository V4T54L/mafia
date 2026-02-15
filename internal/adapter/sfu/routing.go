package sfu

// GamePhase represents the current game phase for voice routing
type GamePhase string

const (
	PhaseLobby    GamePhase = "lobby"
	PhaseNight    GamePhase = "night"
	PhaseDay      GamePhase = "day"
	PhaseGameOver GamePhase = "game_over"
)

// Team represents player team
type Team string

const (
	TeamTown  Team = "town"
	TeamMafia Team = "mafia"
)

// PlayerVoiceState holds a player's voice routing state
type PlayerVoiceState struct {
	ID       string
	Team     Team
	IsAlive  bool
	CanSpeak bool
	CanHear  []string // IDs of players this one can hear
}

// VoiceRoutingState represents the full voice routing configuration
type VoiceRoutingState struct {
	Phase   GamePhase
	Players []PlayerVoiceState
}

// CalculateRouting determines voice permissions based on game phase
// Returns a map of playerID -> PlayerVoiceState
func CalculateRouting(phase GamePhase, players []PlayerInfo) map[string]PlayerVoiceState {
	result := make(map[string]PlayerVoiceState)

	// Separate players by team and status
	var aliveTown, aliveMafia, deadPlayers []string
	allAlive := make([]string, 0)

	for _, p := range players {
		if p.IsAlive {
			allAlive = append(allAlive, p.ID)
			if p.Team == TeamMafia {
				aliveMafia = append(aliveMafia, p.ID)
			} else {
				aliveTown = append(aliveTown, p.ID)
			}
		} else {
			deadPlayers = append(deadPlayers, p.ID)
		}
	}

	allPlayers := make([]string, 0, len(players))
	for _, p := range players {
		allPlayers = append(allPlayers, p.ID)
	}

	for _, p := range players {
		state := PlayerVoiceState{
			ID:      p.ID,
			Team:    p.Team,
			IsAlive: p.IsAlive,
		}

		switch phase {
		case PhaseLobby:
			// Everyone can speak and hear everyone
			state.CanSpeak = true
			state.CanHear = allPlayers

		case PhaseNight:
			if !p.IsAlive {
				// Dead: muted, can't hear anyone
				state.CanSpeak = false
				state.CanHear = []string{}
			} else if p.Team == TeamMafia {
				// Alive Mafia: speak + hear only other mafia
				state.CanSpeak = true
				state.CanHear = aliveMafia
			} else {
				// Alive Town: muted, hear nothing
				state.CanSpeak = false
				state.CanHear = []string{}
			}

		case PhaseDay:
			if !p.IsAlive {
				// Dead: muted, can hear alive players
				state.CanSpeak = false
				state.CanHear = allAlive
			} else {
				// Alive: speak + hear all alive
				state.CanSpeak = true
				state.CanHear = allAlive
			}

		case PhaseGameOver:
			// Everyone can speak and hear everyone
			state.CanSpeak = true
			state.CanHear = allPlayers
		}

		result[p.ID] = state
	}

	return result
}

// PlayerInfo holds basic player info for routing calculation
type PlayerInfo struct {
	ID      string
	Team    Team
	IsAlive bool
}

// Router handles voice routing for a room
type Router struct {
	room *VoiceRoom
}

// NewRouter creates a new voice router
func NewRouter(room *VoiceRoom) *Router {
	return &Router{room: room}
}

// ApplyRouting applies voice routing based on game state
func (r *Router) ApplyRouting(state VoiceRoutingState) {
	routing := CalculateRouting(state.Phase, convertToPlayerInfo(state.Players))

	for playerID, voiceState := range routing {
		participant := r.room.GetParticipant(playerID)
		if participant == nil {
			continue
		}

		participant.SetCanSpeak(voiceState.CanSpeak)
		participant.SetCanHear(voiceState.CanHear)
	}
}

// SetCanSpeak sets speaking permission for a player
func (r *Router) SetCanSpeak(playerID string, canSpeak bool) {
	participant := r.room.GetParticipant(playerID)
	if participant != nil {
		participant.SetCanSpeak(canSpeak)
	}
}

// SubscribeToOnly sets which players a participant can hear
func (r *Router) SubscribeToOnly(playerID string, targetIDs []string) {
	participant := r.room.GetParticipant(playerID)
	if participant != nil {
		participant.SetCanHear(targetIDs)
	}
}

func convertToPlayerInfo(players []PlayerVoiceState) []PlayerInfo {
	result := make([]PlayerInfo, len(players))
	for i, p := range players {
		result[i] = PlayerInfo{
			ID:      p.ID,
			Team:    p.Team,
			IsAlive: p.IsAlive,
		}
	}
	return result
}
