package ws

import (
	"log/slog"
	"sync"
)

// Hub manages all WebSocket clients and message routing
type Hub struct {
	// All connected clients
	clients map[*Client]bool

	// Clients grouped by room
	rooms map[string]map[*Client]bool

	// Channel for client registration
	register chan *Client

	// Channel for client unregistration
	unregister chan *Client

	// Channel for broadcasting to a room
	broadcast chan *RoomMessage

	// Logger
	logger *slog.Logger

	// Mutex for room operations
	mu sync.RWMutex
}

// RoomMessage is a message destined for a specific room
type RoomMessage struct {
	RoomCode string
	Message  *Message
	Exclude  *Client // optional: exclude this client from broadcast
}

// NewHub creates a new Hub
func NewHub(logger *slog.Logger) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *RoomMessage, 256),
		logger:     logger,
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			h.logger.Debug("client registered", "player_id", client.PlayerID)

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				h.removeClientFromRoom(client)
				delete(h.clients, client)
				close(client.send)
				h.logger.Debug("client unregistered", "player_id", client.PlayerID)
			}

		case roomMsg := <-h.broadcast:
			h.broadcastToRoom(roomMsg)
		}
	}
}

// Register registers a client with the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister unregisters a client from the hub
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// JoinRoom adds a client to a room
func (h *Hub) JoinRoom(client *Client, roomCode string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Leave current room if any
	if client.RoomCode != "" {
		h.leaveRoomLocked(client)
	}

	// Join new room
	if _, ok := h.rooms[roomCode]; !ok {
		h.rooms[roomCode] = make(map[*Client]bool)
	}
	h.rooms[roomCode][client] = true
	client.RoomCode = roomCode

	h.logger.Debug("client joined room", "player_id", client.PlayerID, "room", roomCode)
}

// LeaveRoom removes a client from their current room
func (h *Hub) LeaveRoom(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.leaveRoomLocked(client)
}

func (h *Hub) leaveRoomLocked(client *Client) {
	if client.RoomCode == "" {
		return
	}

	if room, ok := h.rooms[client.RoomCode]; ok {
		delete(room, client)
		if len(room) == 0 {
			delete(h.rooms, client.RoomCode)
			h.logger.Debug("room deleted (empty)", "room", client.RoomCode)
		}
	}

	h.logger.Debug("client left room", "player_id", client.PlayerID, "room", client.RoomCode)
	client.RoomCode = ""
}

func (h *Hub) removeClientFromRoom(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.leaveRoomLocked(client)
}

// BroadcastToRoom sends a message to all clients in a room
func (h *Hub) BroadcastToRoom(roomCode string, msg *Message, exclude *Client) {
	h.broadcast <- &RoomMessage{
		RoomCode: roomCode,
		Message:  msg,
		Exclude:  exclude,
	}
}

func (h *Hub) broadcastToRoom(roomMsg *RoomMessage) {
	h.mu.RLock()
	room, ok := h.rooms[roomMsg.RoomCode]
	h.mu.RUnlock()

	if !ok {
		return
	}

	data := roomMsg.Message.Bytes()
	for client := range room {
		if client == roomMsg.Exclude {
			continue
		}
		select {
		case client.send <- data:
		default:
			// Client's send buffer is full, close connection
			h.logger.Warn("client send buffer full, closing", "player_id", client.PlayerID)
			go h.Unregister(client)
		}
	}
}

// SendToClient sends a message to a specific client
func (h *Hub) SendToClient(client *Client, msg *Message) {
	select {
	case client.send <- msg.Bytes():
	default:
		h.logger.Warn("client send buffer full", "player_id", client.PlayerID)
	}
}

// GetRoomClients returns all clients in a room
func (h *Hub) GetRoomClients(roomCode string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	room, ok := h.rooms[roomCode]
	if !ok {
		return nil
	}

	clients := make([]*Client, 0, len(room))
	for client := range room {
		clients = append(clients, client)
	}
	return clients
}

// RoomExists checks if a room exists
func (h *Hub) RoomExists(roomCode string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.rooms[roomCode]
	return ok
}

// RoomSize returns the number of clients in a room
func (h *Hub) RoomSize(roomCode string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if room, ok := h.rooms[roomCode]; ok {
		return len(room)
	}
	return 0
}

// GetClient returns a client by player ID
func (h *Hub) GetClient(playerID string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.PlayerID == playerID {
			return client
		}
	}
	return nil
}

// BroadcastToPlayers sends a message to specific players in a room
func (h *Hub) BroadcastToPlayers(roomCode string, playerIDs []string, msg *Message) {
	h.mu.RLock()
	room, ok := h.rooms[roomCode]
	h.mu.RUnlock()

	if !ok {
		return
	}

	// Create a set of target player IDs for O(1) lookup
	targetSet := make(map[string]bool, len(playerIDs))
	for _, id := range playerIDs {
		targetSet[id] = true
	}

	data := msg.Bytes()
	for client := range room {
		if targetSet[client.PlayerID] {
			select {
			case client.send <- data:
			default:
				h.logger.Warn("client send buffer full", "player_id", client.PlayerID)
			}
		}
	}
}
