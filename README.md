# mafia
A remote social deduction game with no moderator and no mercy.

## Features

- Real-time multiplayer gameplay via WebSocket
- Role-based night/day phases (Mafia, Godfather, Doctor, Detective, Villager)
- WebRTC voice chat with game-controlled audio routing
- Mobile-friendly React frontend

## Tech Stack

**Backend:** Go (Chi router, Gorilla WebSocket, Pion WebRTC)
**Frontend:** React 19, TypeScript, Vite, Zustand, Framer Motion

## Voice Chat

The game includes built-in voice chat using WebRTC with an embedded Pion-based SFU. Voice permissions are automatically controlled based on game phase:

| Phase     | Alive Town           | Alive Mafia              | Dead               |
|-----------|---------------------|--------------------------|-------------------|
| Lobby     | speak + hear all    | speak + hear all         | n/a               |
| Night     | muted, hear nothing | speak + hear Mafia only  | muted             |
| Day       | speak + hear alive  | speak + hear alive       | muted, hear alive |
| Game Over | speak + hear all    | speak + hear all         | speak + hear all  |

## Project Structure

```
cmd/server/           - Application entry point
internal/
  adapter/
    http/             - HTTP server and routing
    ws/               - WebSocket hub, client, router
    sfu/              - WebRTC SFU for voice chat
  domain/
    entity/           - Game, Room, Player entities
    service/          - RoomService, GameService
  pkg/
    config/           - Configuration
    logger/           - Logging
web/src/              - React frontend
  components/         - UI components (VoiceControls, etc.)
  contexts/           - WebSocketContext, VoiceContext
  stores/             - Zustand game state
  pages/              - Landing, Join, Lobby, Game
```

## Running Locally

```bash
# Backend
go run cmd/server/main.go

# Frontend (development)
cd web && npm install && npm run dev
```

## Port Requirements

- `8080` - HTTP + WebSocket
- `5000-5100/udp` - WebRTC media (configurable via `SFU_UDP_PORT_MIN`, `SFU_UDP_PORT_MAX`)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | HTTP server port |
| `HOST` | 0.0.0.0 | Server bind address |
| `STATIC_DIR` | ./web/dist | Frontend static files |
| `ENV` | development | Environment (development/production) |
| `SFU_UDP_PORT_MIN` | 5000 | WebRTC UDP port range start |
| `SFU_UDP_PORT_MAX` | 5100 | WebRTC UDP port range end |
| `SFU_STUN_SERVER` | stun:stun.l.google.com:19302 | STUN server for NAT traversal |
