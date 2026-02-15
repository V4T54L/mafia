package ws

import (
	"log/slog"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 4096
)

// Client represents a single WebSocket connection
type Client struct {
	hub *Hub

	// The websocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// Player identification
	PlayerID string

	// Current room (empty if not in a room)
	RoomCode string

	// Logger
	logger *slog.Logger

	// Message handler callback
	onMessage func(*Client, *Message)

	// Disconnect handler callback
	onDisconnect func(*Client)
}

// NewClient creates a new Client
func NewClient(hub *Hub, conn *websocket.Conn, playerID string, logger *slog.Logger, onMessage func(*Client, *Message), onDisconnect func(*Client)) *Client {
	return &Client{
		hub:          hub,
		conn:         conn,
		send:         make(chan []byte, 256),
		PlayerID:     playerID,
		logger:       logger,
		onMessage:    onMessage,
		onDisconnect: onDisconnect,
	}
}

// ReadPump pumps messages from the websocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		if c.onDisconnect != nil {
			c.onDisconnect(c)
		}
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.Warn("websocket read error", "error", err, "player_id", c.PlayerID)
			}
			break
		}

		msg, err := ParseMessage(data)
		if err != nil {
			c.logger.Warn("failed to parse message", "error", err, "player_id", c.PlayerID)
			c.SendError("invalid_message", "Failed to parse message")
			continue
		}

		c.logger.Debug("received message", "type", msg.Type, "player_id", c.PlayerID)

		if c.onMessage != nil {
			c.onMessage(c, msg)
		}
	}
}

// WritePump pumps messages from the hub to the websocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Send sends a message to this client
func (c *Client) Send(msg *Message) {
	select {
	case c.send <- msg.Bytes():
	default:
		c.logger.Warn("client send buffer full", "player_id", c.PlayerID)
	}
}

// SendError sends an error message to this client
func (c *Client) SendError(code, message string) {
	msg := MustMessage(EventTypeError, ErrorPayload{
		Code:    code,
		Message: message,
	})
	c.Send(msg)
}
