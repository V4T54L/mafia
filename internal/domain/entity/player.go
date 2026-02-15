package entity

// PlayerStatus represents the player's alive/dead state
type PlayerStatus string

const (
	PlayerStatusAlive PlayerStatus = "alive"
	PlayerStatusDead  PlayerStatus = "dead"
)

// Player represents a player in the game
type Player struct {
	ID          string
	Nickname    string
	IsHost      bool
	IsReady     bool
	IsConnected bool
	Status      PlayerStatus
	Role        Role // assigned when game starts
}

// NewPlayer creates a new player
func NewPlayer(id, nickname string, isHost bool) *Player {
	return &Player{
		ID:          id,
		Nickname:    nickname,
		IsHost:      isHost,
		IsReady:     false,
		IsConnected: true,
		Status:      PlayerStatusAlive,
	}
}

// ToDTO converts player to a DTO for sending to clients
func (p *Player) ToDTO() PlayerDTO {
	return PlayerDTO{
		ID:          p.ID,
		Nickname:    p.Nickname,
		IsHost:      p.IsHost,
		IsReady:     p.IsReady,
		IsConnected: p.IsConnected,
		Status:      string(p.Status),
	}
}

// PlayerDTO is the player data sent to clients
type PlayerDTO struct {
	ID          string `json:"id"`
	Nickname    string `json:"nickname"`
	IsHost      bool   `json:"is_host"`
	IsReady     bool   `json:"is_ready"`
	IsConnected bool   `json:"is_connected"`
	Status      string `json:"status"`
}
