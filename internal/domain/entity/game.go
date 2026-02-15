package entity

import (
	"errors"
	"math/rand"
	"sync"
	"time"
)

// GamePhase represents the current phase of the game
type GamePhase string

const (
	PhaseRoleReveal  GamePhase = "role_reveal"
	PhaseNight       GamePhase = "night"
	PhaseNightResult GamePhase = "night_result"
	PhaseDay         GamePhase = "day"
	PhaseDayResult   GamePhase = "day_result"
	PhaseGameOver    GamePhase = "game_over"
)

// Game errors
var (
	ErrGameNotStarted    = errors.New("game not started")
	ErrInvalidPhase      = errors.New("invalid phase for this action")
	ErrPlayerDead        = errors.New("player is dead")
	ErrInvalidTarget     = errors.New("invalid target")
	ErrAlreadyActed      = errors.New("player already acted this phase")
	ErrCannotTargetSelf  = errors.New("cannot target self")
	ErrMafiaTargetMafia  = errors.New("mafia cannot target mafia")
)

// NightActions holds the actions taken during the night
type NightActions struct {
	MafiaTarget     string            // player ID targeted by mafia
	MafiaVotes      map[string]string // mafia player ID -> target ID
	DoctorTarget    string            // player ID protected by doctor
	DetectiveTarget string            // player ID investigated by detective
}

// DayVotes holds the votes during the day phase
type DayVotes struct {
	Votes     map[string]string    // voter ID -> target ID (empty = skip)
	VotedTime map[string]time.Time // when each vote was cast
	Submitted map[string]bool      // voter ID -> true if vote is finalized
}

// NightResult contains the outcome of the night phase
type NightResult struct {
	KilledID        string // empty if saved
	KilledNickname  string
	WasSaved        bool
	DetectiveResult *DetectiveResult
}

// DetectiveResult contains investigation result (only sent to detective)
type DetectiveResult struct {
	TargetID       string
	TargetNickname string
	IsMafia        bool
}

// DayResult contains the outcome of voting
type DayResult struct {
	EliminatedID       string
	EliminatedNickname string
	EliminatedRole     Role
	VoteCounts         map[string]int // target ID -> vote count
	NoMajority         bool
}

// Game represents an active game instance
type Game struct {
	Room         *Room
	Phase        GamePhase
	Round        int // current round (night 1, day 1 = round 1)
	PhaseEndTime time.Time

	// Role assignments
	Roles map[string]Role // player ID -> role

	// Night phase
	NightActions *NightActions

	// Day phase
	DayVotes *DayVotes

	// Results
	LastNightResult *NightResult
	LastDayResult   *DayResult
	Winner          Team

	mu sync.RWMutex
}

// NewGame creates a new game from a room
func NewGame(room *Room) (*Game, error) {
	if room.PlayerCount() < MinPlayers {
		return nil, ErrNotEnoughPlayers
	}

	if !room.AllReady() {
		return nil, ErrNotAllReady
	}

	g := &Game{
		Room:  room,
		Phase: PhaseRoleReveal,
		Round: 1,
		Roles: make(map[string]Role),
	}

	// Assign roles
	if err := g.assignRoles(); err != nil {
		return nil, err
	}

	room.State = RoomStatePlaying

	return g, nil
}

// assignRoles randomly assigns roles to players based on settings
func (g *Game) assignRoles() error {
	g.mu.Lock()
	defer g.mu.Unlock()

	settings := g.Room.Settings
	playerIDs := make([]string, 0, len(g.Room.Players))
	for _, id := range g.Room.PlayerOrder {
		if _, ok := g.Room.Players[id]; ok {
			playerIDs = append(playerIDs, id)
		}
	}

	// Build role pool
	roles := make([]Role, 0)
	for i := 0; i < settings.Mafia; i++ {
		roles = append(roles, RoleMafia)
	}
	for i := 0; i < settings.Godfather; i++ {
		roles = append(roles, RoleGodfather)
	}
	for i := 0; i < settings.Doctor; i++ {
		roles = append(roles, RoleDoctor)
	}
	for i := 0; i < settings.Detective; i++ {
		roles = append(roles, RoleDetective)
	}
	// Fill remaining with villagers
	villagerCount := len(playerIDs) - len(roles)
	for i := 0; i < villagerCount; i++ {
		roles = append(roles, RoleVillager)
	}

	// Shuffle roles
	rand.Shuffle(len(roles), func(i, j int) {
		roles[i], roles[j] = roles[j], roles[i]
	})

	// Assign to players
	for i, playerID := range playerIDs {
		g.Roles[playerID] = roles[i]
		g.Room.Players[playerID].Role = roles[i]
	}

	return nil
}

// StartNight transitions to night phase
func (g *Game) StartNight(duration time.Duration) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.Phase = PhaseNight
	g.PhaseEndTime = time.Now().Add(duration)
	g.NightActions = &NightActions{
		MafiaVotes: make(map[string]string),
	}
}

// SubmitNightAction records a player's night action
func (g *Game) SubmitNightAction(playerID, targetID string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.Phase != PhaseNight {
		return ErrInvalidPhase
	}

	player := g.Room.GetPlayer(playerID)
	if player == nil {
		return ErrPlayerNotFound
	}
	if player.Status != PlayerStatusAlive {
		return ErrPlayerDead
	}

	role := g.Roles[playerID]
	if !role.CanActAtNight() {
		return ErrInvalidPhase
	}

	// Validate target
	if targetID != "" {
		target := g.Room.GetPlayer(targetID)
		if target == nil {
			return ErrInvalidTarget
		}
		if target.Status != PlayerStatusAlive {
			return ErrInvalidTarget
		}

		// Role-specific validation
		switch role {
		case RoleMafia, RoleGodfather:
			// Can't target fellow mafia
			if g.Roles[targetID].GetTeam() == TeamMafia {
				return ErrMafiaTargetMafia
			}
		case RoleDoctor:
			// Doctor can protect anyone including self
		case RoleDetective:
			// Can't investigate self
			if targetID == playerID {
				return ErrCannotTargetSelf
			}
		}
	}

	// Record action
	switch role {
	case RoleMafia, RoleGodfather:
		g.NightActions.MafiaVotes[playerID] = targetID
		// Resolve mafia target (majority or godfather decides)
		g.resolveMafiaTarget()
	case RoleDoctor:
		g.NightActions.DoctorTarget = targetID
	case RoleDetective:
		g.NightActions.DetectiveTarget = targetID
	}

	return nil
}

// resolveMafiaTarget determines the final mafia target
func (g *Game) resolveMafiaTarget() {
	// Count votes for each target
	voteCounts := make(map[string]int)
	var godfatherVote string

	for mafiaID, targetID := range g.NightActions.MafiaVotes {
		if targetID == "" {
			continue
		}
		voteCounts[targetID]++
		if g.Roles[mafiaID] == RoleGodfather {
			godfatherVote = targetID
		}
	}

	// Godfather's vote wins if present
	if godfatherVote != "" {
		g.NightActions.MafiaTarget = godfatherVote
		return
	}

	// Otherwise, pick majority (or first if tie)
	maxVotes := 0
	for target, count := range voteCounts {
		if count > maxVotes {
			maxVotes = count
			g.NightActions.MafiaTarget = target
		}
	}
}

// ResolveNight processes night actions and returns the result
func (g *Game) ResolveNight() *NightResult {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.Phase = PhaseNightResult
	result := &NightResult{}

	// Night 1 has no kills - Mafia only identifies each other
	// Check if this is Night 1 by seeing if no day phase has occurred yet
	isFirstNight := g.LastDayResult == nil

	// Check if mafia target was saved
	mafiaTarget := g.NightActions.MafiaTarget
	doctorTarget := g.NightActions.DoctorTarget

	// Only process kill if not first night
	if mafiaTarget != "" && !isFirstNight {
		if mafiaTarget == doctorTarget {
			result.WasSaved = true
		} else {
			// Player dies
			if player := g.Room.GetPlayer(mafiaTarget); player != nil {
				player.Status = PlayerStatusDead
				result.KilledID = mafiaTarget
				result.KilledNickname = player.Nickname
			}
		}
	}

	// Detective investigation
	if g.NightActions.DetectiveTarget != "" {
		targetID := g.NightActions.DetectiveTarget
		if target := g.Room.GetPlayer(targetID); target != nil {
			targetRole := g.Roles[targetID]
			// Godfather appears as town
			isMafia := targetRole == RoleMafia
			result.DetectiveResult = &DetectiveResult{
				TargetID:       targetID,
				TargetNickname: target.Nickname,
				IsMafia:        isMafia,
			}
		}
	}

	g.LastNightResult = result
	return result
}

// StartDay transitions to day phase
func (g *Game) StartDay(duration time.Duration) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.Phase = PhaseDay
	g.PhaseEndTime = time.Now().Add(duration)
	g.DayVotes = &DayVotes{
		Votes:     make(map[string]string),
		VotedTime: make(map[string]time.Time),
		Submitted: make(map[string]bool),
	}
}

// SubmitDayVote records a player's vote
func (g *Game) SubmitDayVote(voterID, targetID string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.Phase != PhaseDay {
		return ErrInvalidPhase
	}

	voter := g.Room.GetPlayer(voterID)
	if voter == nil {
		return ErrPlayerNotFound
	}
	if voter.Status != PlayerStatusAlive {
		return ErrPlayerDead
	}

	// Validate target (empty = skip vote)
	if targetID != "" {
		target := g.Room.GetPlayer(targetID)
		if target == nil {
			return ErrInvalidTarget
		}
		if target.Status != PlayerStatusAlive {
			return ErrInvalidTarget
		}
		if targetID == voterID {
			return ErrCannotTargetSelf
		}
	}

	g.DayVotes.Votes[voterID] = targetID
	g.DayVotes.VotedTime[voterID] = time.Now()
	g.DayVotes.Submitted[voterID] = true

	return nil
}

// ResolveDay processes votes and returns the result
func (g *Game) ResolveDay() *DayResult {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.Phase = PhaseDayResult
	result := &DayResult{
		VoteCounts: make(map[string]int),
	}

	// Count votes
	for _, targetID := range g.DayVotes.Votes {
		if targetID != "" {
			result.VoteCounts[targetID]++
		}
	}

	// Find majority
	alivePlayers := g.getAlivePlayerCount()
	majorityNeeded := (alivePlayers / 2) + 1

	var maxVotes int
	var topTarget string
	for targetID, votes := range result.VoteCounts {
		if votes > maxVotes {
			maxVotes = votes
			topTarget = targetID
		}
	}

	if maxVotes >= majorityNeeded {
		// Elimination
		if player := g.Room.GetPlayer(topTarget); player != nil {
			player.Status = PlayerStatusDead
			result.EliminatedID = topTarget
			result.EliminatedNickname = player.Nickname
			result.EliminatedRole = g.Roles[topTarget]
		}
	} else {
		result.NoMajority = true
	}

	g.LastDayResult = result
	return result
}

// CheckWinCondition checks if the game has ended
func (g *Game) CheckWinCondition() (bool, Team) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	var townAlive, mafiaAlive int

	for playerID, player := range g.Room.Players {
		if player.Status != PlayerStatusAlive {
			continue
		}
		role := g.Roles[playerID]
		if role.GetTeam() == TeamMafia {
			mafiaAlive++
		} else {
			townAlive++
		}
	}

	// Mafia wins if they equal or outnumber town
	if mafiaAlive >= townAlive {
		return true, TeamMafia
	}

	// Town wins if all mafia are dead
	if mafiaAlive == 0 {
		return true, TeamTown
	}

	return false, ""
}

// EndGame marks the game as over
func (g *Game) EndGame(winner Team) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.Phase = PhaseGameOver
	g.Winner = winner
	g.Room.State = RoomStateEnded
}

// GetAlivePlayerCount returns the number of alive players
func (g *Game) getAlivePlayerCount() int {
	count := 0
	for _, player := range g.Room.Players {
		if player.Status == PlayerStatusAlive {
			count++
		}
	}
	return count
}

// GetAlivePlayers returns list of alive player IDs
func (g *Game) GetAlivePlayers() []string {
	g.mu.RLock()
	defer g.mu.RUnlock()

	alive := make([]string, 0)
	for _, id := range g.Room.PlayerOrder {
		if p, ok := g.Room.Players[id]; ok && p.Status == PlayerStatusAlive {
			alive = append(alive, id)
		}
	}
	return alive
}

// GetMafiaTeammates returns the IDs of other mafia members (for a mafia player)
func (g *Game) GetMafiaTeammates(playerID string) []string {
	g.mu.RLock()
	defer g.mu.RUnlock()

	teammates := make([]string, 0)
	for id, role := range g.Roles {
		if id != playerID && role.GetTeam() == TeamMafia {
			teammates = append(teammates, id)
		}
	}
	return teammates
}

// AllNightActionsComplete checks if all night actors have submitted
func (g *Game) AllNightActionsComplete() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	for playerID, player := range g.Room.Players {
		if player.Status != PlayerStatusAlive {
			continue
		}
		role := g.Roles[playerID]
		if !role.CanActAtNight() {
			continue
		}

		switch role {
		case RoleMafia, RoleGodfather:
			if _, ok := g.NightActions.MafiaVotes[playerID]; !ok {
				return false
			}
		case RoleDoctor:
			if g.NightActions.DoctorTarget == "" {
				return false
			}
		case RoleDetective:
			if g.NightActions.DetectiveTarget == "" {
				return false
			}
		}
	}
	return true
}

// AllDayVotesComplete checks if all alive players have voted
func (g *Game) AllDayVotesComplete() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	for _, player := range g.Room.Players {
		if player.Status != PlayerStatusAlive {
			continue
		}
		if _, ok := g.DayVotes.Votes[player.ID]; !ok {
			return false
		}
	}
	return true
}

// GetVoteCounts returns current vote tallies (for live display)
func (g *Game) GetVoteCounts() map[string]int {
	g.mu.RLock()
	defer g.mu.RUnlock()

	counts := make(map[string]int)
	if g.DayVotes == nil {
		return counts
	}
	for _, targetID := range g.DayVotes.Votes {
		if targetID != "" {
			counts[targetID]++
		}
	}
	return counts
}

// GetVoteDetails returns detailed vote information (who voted for whom)
func (g *Game) GetVoteDetails() (map[string]string, []string) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	votes := make(map[string]string)
	submitted := make([]string, 0)

	if g.DayVotes == nil {
		return votes, submitted
	}

	// Copy votes map
	for voterID, targetID := range g.DayVotes.Votes {
		votes[voterID] = targetID
	}

	// Get submitted voters
	for voterID, isSubmitted := range g.DayVotes.Submitted {
		if isSubmitted {
			submitted = append(submitted, voterID)
		}
	}

	return votes, submitted
}

// GetRoleRevealData returns data for each player's role reveal
func (g *Game) GetRoleRevealData(playerID string) map[string]any {
	g.mu.RLock()
	defer g.mu.RUnlock()

	role := g.Roles[playerID]
	data := map[string]interface{}{
		"role": string(role),
		"team": string(role.GetTeam()),
	}

	// Mafia members see their teammates
	if role.GetTeam() == TeamMafia {
		teammates := make([]map[string]string, 0)
		for id, r := range g.Roles {
			if id != playerID && r.GetTeam() == TeamMafia {
				if p := g.Room.GetPlayer(id); p != nil {
					teammates = append(teammates, map[string]string{
						"id":       id,
						"nickname": p.Nickname,
						"role":     string(r),
					})
				}
			}
		}
		data["teammates"] = teammates
	}

	return data
}
