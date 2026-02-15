import { useEffect, useRef, useCallback, useState } from 'react'
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

export function useWebSocket() {
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

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data)
      console.log('[WS] Received:', message.type, message.payload)

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

        default:
          console.log('[WS] Unhandled message:', message.type)
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err)
    }
  }, [setPlayerId, setConnected, setRoomCode, setIsHost, setPlayers, setSettings, addPlayer, removePlayer, updatePlayerReady])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
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

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionState('disconnected')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return {
    connect,
    disconnect,
    send,
    once,
    connectionState,
    isConnected: connectionState === 'connected',
  }
}
