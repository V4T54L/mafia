package ws

import (
	"log/slog"
	"net/http"

	"github.com/V4T54L/mafia/internal/pkg/id"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development
		// TODO: Restrict in production
		return true
	},
}

// Handler handles WebSocket connections
type Handler struct {
	hub       *Hub
	logger    *slog.Logger
	onMessage func(*Client, *Message)
}

// NewHandler creates a new WebSocket handler
func NewHandler(hub *Hub, logger *slog.Logger, onMessage func(*Client, *Message)) *Handler {
	return &Handler{
		hub:       hub,
		logger:    logger,
		onMessage: onMessage,
	}
}

// ServeHTTP handles WebSocket upgrade requests
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error("websocket upgrade failed", "error", err)
		return
	}

	// Generate a unique player ID
	playerID := id.Generate()

	client := NewClient(h.hub, conn, playerID, h.logger, h.onMessage)
	h.hub.Register(client)

	// Send connected event
	client.Send(MustMessage(EventTypeConnected, ConnectedPayload{
		PlayerID: playerID,
	}))

	// Start client pumps
	go client.WritePump()
	go client.ReadPump()
}
