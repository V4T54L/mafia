package entity

// Role represents a player's role in the game
type Role string

const (
	RoleVillager  Role = "villager"
	RoleMafia     Role = "mafia"
	RoleGodfather Role = "godfather"
	RoleDoctor    Role = "doctor"
	RoleDetective Role = "detective"
)

// Team represents which team a role belongs to
type Team string

const (
	TeamTown  Team = "town"
	TeamMafia Team = "mafia"
)

// GetTeam returns the team for a role
func (r Role) GetTeam() Team {
	switch r {
	case RoleMafia, RoleGodfather:
		return TeamMafia
	default:
		return TeamTown
	}
}

// CanActAtNight returns true if this role has a night action
func (r Role) CanActAtNight() bool {
	switch r {
	case RoleMafia, RoleGodfather, RoleDoctor, RoleDetective:
		return true
	default:
		return false
	}
}
