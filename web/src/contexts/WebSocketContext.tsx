import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useGameStore } from '../stores/gameStore'

// Message types
export interface WSMessage {
  type: string
  payload?: unknown
}

// Connection states
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

// Get WebSocket URL based on current location
function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws`
}

interface WebSocketContextValue {
  send: (type: string, payload?: unknown) => boolean
  once: (type: string, handler: (payload: unknown) => void) => void
  connectionState: ConnectionState
  isConnected: boolean
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const reconnectTimeoutRef = useRef<number | null>(null)
  const messageHandlersRef = useRef<Map<string, (payload: unknown) => void>>(new Map())

  const {
    setPlayerId,
    setRoomCode,
    setPlayers,
    setSettings,
    setIsHost,
    setConnected,
    addPlayer,
    removePlayer,
    updatePlayerReady,
    updatePlayerStatus,
    setPhase,
    setRound,
    setMyRole,
    setPhaseTimer,
    setVoteCounts,
    setNightResult,
    setDayResult,
    setWinner,
  } = useGameStore()

  // Send a message through WebSocket
  const send = useCallback((type: string, payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WSMessage = { type, payload }
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    console.warn('WebSocket not connected, cannot send:', type)
    return false
  }, [])

  // Register a one-time message handler
  const once = useCallback((type: string, handler: (payload: unknown) => void) => {
    messageHandlersRef.current.set(type, (payload) => {
      messageHandlersRef.current.delete(type)
      handler(payload)
    })
  }, [])

  // Handle a single parsed message
  const handleSingleMessage = useCallback((message: WSMessage) => {
    try {
      // Check for one-time handlers first
      const handler = messageHandlersRef.current.get(message.type)
      if (handler) {
        handler(message.payload)
        return
      }

      // Handle standard events
      switch (message.type) {
        case 'connected': {
          const { player_id } = message.payload as { player_id: string }
          setPlayerId(player_id)
          setConnected(true)
          break
        }

        case 'room_created': {
          const { room_code } = message.payload as { room_code: string }
          setRoomCode(room_code)
          setIsHost(true)
          break
        }

        case 'room_joined': {
          const { room_code, players, settings } = message.payload as {
            room_code: string
            players: Array<{
              id: string
              nickname: string
              is_host: boolean
              is_ready: boolean
              status: string
            }>
            settings: {
              villagers: number
              mafia: number
              godfather: number
              doctor: number
              detective: number
              night_timer: number
            }
          }
          setRoomCode(room_code)
          setPlayers(
            players.map((p) => ({
              id: p.id,
              nickname: p.nickname,
              isHost: p.is_host,
              isReady: p.is_ready,
              status: p.status as 'alive' | 'dead',
            }))
          )
          setSettings({
            villagers: settings.villagers,
            mafia: settings.mafia,
            godfather: settings.godfather,
            doctor: settings.doctor,
            detective: settings.detective,
            nightTimer: settings.night_timer,
          })
          // Check if current player is host
          const playerId = useGameStore.getState().playerId
          const me = players.find((p) => p.id === playerId)
          if (me?.is_host) {
            setIsHost(true)
          }
          break
        }

        case 'room_state': {
          const { players, settings } = message.payload as {
            players: Array<{
              id: string
              nickname: string
              is_host: boolean
              is_ready: boolean
              status: string
            }>
            settings: {
              villagers: number
              mafia: number
              godfather: number
              doctor: number
              detective: number
              night_timer: number
            }
          }
          setPlayers(
            players.map((p) => ({
              id: p.id,
              nickname: p.nickname,
              isHost: p.is_host,
              isReady: p.is_ready,
              status: p.status as 'alive' | 'dead',
            }))
          )
          setSettings({
            villagers: settings.villagers,
            mafia: settings.mafia,
            godfather: settings.godfather,
            doctor: settings.doctor,
            detective: settings.detective,
            nightTimer: settings.night_timer,
          })
          break
        }

        case 'player_joined': {
          const { player } = message.payload as {
            player: {
              id: string
              nickname: string
              is_host: boolean
              is_ready: boolean
              status: string
            }
          }
          addPlayer({
            id: player.id,
            nickname: player.nickname,
            isHost: player.is_host,
            isReady: player.is_ready,
            status: player.status as 'alive' | 'dead',
          })
          break
        }

        case 'player_left': {
          const { player_id, new_host } = message.payload as {
            player_id: string
            new_host?: string
          }
          removePlayer(player_id, new_host)
          break
        }

        case 'player_ready': {
          const { player_id, ready } = message.payload as {
            player_id: string
            ready: boolean
          }
          updatePlayerReady(player_id, ready)
          break
        }

        case 'settings_updated': {
          const settings = message.payload as {
            villagers: number
            mafia: number
            godfather: number
            doctor: number
            detective: number
            night_timer: number
          }
          setSettings({
            villagers: settings.villagers,
            mafia: settings.mafia,
            godfather: settings.godfather,
            doctor: settings.doctor,
            detective: settings.detective,
            nightTimer: settings.night_timer,
          })
          break
        }

        case 'error': {
          const { code, message: errorMsg } = message.payload as {
            code: string
            message: string
          }
          console.error('[WS] Error:', code, errorMsg)
          // Trigger error handler if registered
          const errorHandler = messageHandlersRef.current.get('error')
          if (errorHandler) {
            errorHandler(message.payload)
          }
          break
        }

        // Game events
        case 'game_starting': {
          // Game is starting - navigate will happen when role is assigned
          break
        }

        case 'role_assigned': {
          const { role, team, teammates } = message.payload as {
            role: string
            team: string
            teammates?: Array<{ id: string; nickname: string; role: string }>
          }
          setMyRole(
            role as 'villager' | 'mafia' | 'godfather' | 'doctor' | 'detective',
            team as 'town' | 'mafia',
            teammates?.map((t) => ({
              id: t.id,
              nickname: t.nickname,
              role: t.role as 'villager' | 'mafia' | 'godfather' | 'doctor' | 'detective',
            }))
          )
          break
        }

        case 'phase_changed': {
          const { phase, round, timer } = message.payload as {
            phase: string
            round: number
            timer?: number
          }
          setPhase(phase as 'night' | 'day')
          setRound(round)
          if (timer !== undefined) {
            setPhaseTimer(timer)
          }
          // Clear previous results when starting new phase
          setNightResult(null)
          setDayResult(null)
          setVoteCounts({})
          break
        }

        case 'timer_tick': {
          const { remaining } = message.payload as { remaining: number }
          setPhaseTimer(remaining)
          break
        }

        case 'night_result': {
          const payload = message.payload as {
            killed?: string
            killed_nickname?: string
            was_saved?: boolean
            investigation?: {
              target_id: string
              target_nickname: string
              is_mafia: boolean
            }
          }

          // Update player status if someone died
          if (payload.killed) {
            updatePlayerStatus(payload.killed, 'dead')
          }

          setNightResult({
            killedId: payload.killed || null,
            killedNickname: payload.killed_nickname || null,
            wasSaved: payload.was_saved || false,
            investigation: payload.investigation
              ? {
                  targetId: payload.investigation.target_id,
                  targetNickname: payload.investigation.target_nickname,
                  isMafia: payload.investigation.is_mafia,
                }
              : undefined,
          })
          setPhase('night_result')
          break
        }

        case 'vote_update': {
          const { votes } = message.payload as { votes: Record<string, number> }
          setVoteCounts(votes)
          break
        }

        case 'day_result': {
          const payload = message.payload as {
            eliminated?: string
            eliminated_nickname?: string
            eliminated_role?: string
            votes: Record<string, number>
            no_majority?: boolean
          }

          // Update player status if someone was eliminated
          if (payload.eliminated) {
            updatePlayerStatus(payload.eliminated, 'dead')
          }

          setDayResult({
            eliminatedId: payload.eliminated || null,
            eliminatedNickname: payload.eliminated_nickname || null,
            eliminatedRole: (payload.eliminated_role as 'villager' | 'mafia' | 'godfather' | 'doctor' | 'detective') || null,
            voteCounts: payload.votes,
            noMajority: payload.no_majority || false,
          })
          setPhase('day_result')
          break
        }

        case 'game_over': {
          const { winner, players } = message.payload as {
            winner: string
            players: Array<{
              id: string
              nickname: string
              role: string
              status: string
            }>
          }

          // Update all players with their revealed roles
          setPlayers(
            players.map((p) => ({
              id: p.id,
              nickname: p.nickname,
              isHost: false,
              isReady: false,
              status: p.status as 'alive' | 'dead',
              role: p.role as 'villager' | 'mafia' | 'godfather' | 'doctor' | 'detective',
            }))
          )

          setWinner(winner as 'town' | 'mafia')
          setPhase('game_over')
          break
        }

        default:
          console.log('[WS] Unhandled message:', message.type)
      }
    } catch (err) {
      console.error('[WS] Failed to handle message:', err)
    }
  }, [setPlayerId, setConnected, setRoomCode, setIsHost, setPlayers, setSettings, addPlayer, removePlayer, updatePlayerReady, updatePlayerStatus, setPhase, setRound, setMyRole, setPhaseTimer, setVoteCounts, setNightResult, setDayResult, setWinner])

  // Handle incoming messages (may be batched with newlines)
  const handleMessage = useCallback((event: MessageEvent) => {
    // Server may batch multiple messages separated by newlines
    const messages = (event.data as string).split('\n').filter((line) => line.trim())

    for (const msgStr of messages) {
      try {
        const message: WSMessage = JSON.parse(msgStr)
        console.log('[WS] Received:', message.type, message.payload)
        handleSingleMessage(message)
      } catch (err) {
        console.error('[WS] Failed to parse message:', err, msgStr)
      }
    }
  }, [handleSingleMessage])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return
    }

    setConnectionState('connecting')
    const url = getWebSocketUrl()
    console.log('[WS] Connecting to', url)

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      setConnectionState('connected')
    }

    ws.onmessage = handleMessage

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
      setConnectionState('error')
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setConnectionState('disconnected')
      setConnected(false)
      wsRef.current = null

      // Auto-reconnect after 2 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        console.log('[WS] Attempting reconnect...')
        connect()
      }, 2000)
    }
  }, [handleMessage, setConnected])

  // Connect on mount
  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const value: WebSocketContextValue = {
    send,
    once,
    connectionState,
    isConnected: connectionState === 'connected',
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}
