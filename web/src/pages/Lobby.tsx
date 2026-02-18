import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../components/ui'
import { VoiceControls } from '../components/VoiceControls'
import { useGameStore, type Player, type GameSettings } from '../stores/gameStore'
import { useWebSocket } from '../contexts/WebSocketContext'

// Calculate total players needed from settings
function getTotalPlayers(settings: GameSettings): number {
  return settings.villagers + settings.mafia + settings.godfather + settings.doctor + settings.detective
}

function PlayerCard({ player, isMe }: { player: Player; isMe: boolean }) {
  return (
    <motion.div
      className={`
        flex items-center gap-3 p-3 rounded-xl
        ${isMe ? 'bg-accent-neutral/10 border border-accent-neutral/30' : 'bg-bg-surface'}
      `}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Avatar / Speaking indicator */}
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center text-lg
          ${player.isSpeaking ? 'bg-accent-success ring-2 ring-accent-success ring-offset-2 ring-offset-bg-primary' : 'bg-bg-elevated'}
        `}
      >
        {player.nickname.charAt(0).toUpperCase()}
      </div>

      {/* Name and status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary truncate">{player.nickname}</span>
          {player.isHost && (
            <span className="text-xs px-2 py-0.5 bg-accent-warning/20 text-accent-warning rounded-full">
              Host
            </span>
          )}
          {isMe && (
            <span className="text-xs px-2 py-0.5 bg-accent-neutral/20 text-accent-neutral rounded-full">
              You
            </span>
          )}
        </div>
        <div className="text-sm text-text-secondary">
          {player.isSpeaking ? (
            <span className="text-accent-success">Speaking...</span>
          ) : player.isReady ? (
            <span className="text-accent-success">Ready</span>
          ) : (
            <span className="text-text-disabled">Not ready</span>
          )}
        </div>
      </div>

      {/* Ready indicator */}
      <div
        className={`
          w-3 h-3 rounded-full
          ${player.isReady ? 'bg-accent-success' : 'bg-text-disabled'}
        `}
      />
    </motion.div>
  )
}

function SettingsPanel({
  settings,
  onChange,
  disabled,
}: {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
  disabled: boolean
}) {
  const updateSetting = (key: keyof GameSettings, value: number) => {
    onChange({ ...settings, [key]: value })
  }

  const roles = [
    { key: 'villagers' as const, label: 'Villagers', min: 0, max: 8, icon: '👤' },
    { key: 'mafia' as const, label: 'Mafia', min: 1, max: 4, icon: '💀' },
    { key: 'godfather' as const, label: 'Godfather', min: 0, max: 1, icon: '🎩' },
    { key: 'doctor' as const, label: 'Doctor', min: 0, max: 1, icon: '💊' },
    { key: 'detective' as const, label: 'Detective', min: 0, max: 1, icon: '🔍' },
  ]

  const totalPlayers =
    settings.villagers + settings.mafia + settings.godfather + settings.doctor + settings.detective

  return (
    <div className="bg-bg-surface rounded-xl p-4">
      <h3 className="font-semibold text-text-primary mb-4">Game Settings</h3>

      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{role.icon}</span>
              <span className="text-sm text-text-secondary">{role.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting(role.key, Math.max(role.min, settings[role.key] - 1))}
                disabled={disabled || settings[role.key] <= role.min}
                className="w-8 h-8 rounded-lg bg-bg-elevated text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                -
              </button>
              <span className="w-6 text-center text-text-primary font-medium">
                {settings[role.key]}
              </span>
              <button
                onClick={() => updateSetting(role.key, Math.min(role.max, settings[role.key] + 1))}
                disabled={disabled || settings[role.key] >= role.max}
                className="w-8 h-8 rounded-lg bg-bg-elevated text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-bg-elevated">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Total players needed</span>
          <span className={`font-medium ${totalPlayers >= 3 && totalPlayers <= 12 ? 'text-accent-success' : 'text-accent-mafia'}`}>
            {totalPlayers}
          </span>
        </div>
        {(totalPlayers < 3 || totalPlayers > 12) && (
          <p className="text-xs text-accent-mafia mt-1">Must be between 3-12 players</p>
        )}
      </div>
    </div>
  )
}

export function Lobby() {
  const { code } = useParams()
  const navigate = useNavigate()

  const { send, isConnected, connectionState } = useWebSocket()
  const {
    players,
    settings,
    playerId,
    isHost,
    roomCode,
    phase,
    myRole,
    reset,
  } = useGameStore()

  const [copied, setCopied] = useState(false)

  // Redirect to join page if no room code (not in a room)
  useEffect(() => {
    if (isConnected && !roomCode) {
      navigate(`/join/${code}`)
    }
  }, [isConnected, roomCode, code, navigate])

  // Navigate to game when game starts AND role is assigned AND we have playerId
  useEffect(() => {
    if (phase === 'role_reveal' && myRole && playerId) {
      console.log('[Lobby] Navigating to game - phase:', phase, 'myRole:', myRole, 'playerId:', playerId)
      navigate(`/game/${roomCode || code}`)
    }
  }, [phase, myRole, playerId, roomCode, code, navigate])

  const me = players.find((p) => p.id === playerId)
  const isReady = me?.isReady || false
  const allReady = players.filter((p) => p.status === 'alive').every((p) => p.isReady)
  const readyCount = players.filter((p) => p.isReady).length

  const copyRoomCode = async () => {
    const roomCodeToCopy = roomCode || code
    if (roomCodeToCopy) {
      const shareUrl = `${window.location.origin}/join/${roomCodeToCopy}`
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleToggleReady = () => {
    send('ready', { ready: !isReady })
  }

  const handleUpdateSettings = (newSettings: GameSettings) => {
    send('update_settings', {
      villagers: newSettings.villagers,
      mafia: newSettings.mafia,
      godfather: newSettings.godfather,
      doctor: newSettings.doctor,
      detective: newSettings.detective,
      night_timer: newSettings.nightTimer,
    })
  }

  const handleStartGame = () => {
    send('start_game', {})
  }

  const handleLeave = () => {
    send('leave_room', {})
    reset()
    navigate('/')
  }

  const displayCode = roomCode || code

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-bg-surface">
        <button
          onClick={handleLeave}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Leave
        </button>

        {/* Room code */}
        <button
          onClick={copyRoomCode}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface rounded-lg hover:bg-bg-elevated transition-colors"
        >
          <span className="font-mono text-lg text-text-primary">{displayCode}</span>
          <span className="text-xs text-text-secondary">{copied ? 'Copied!' : 'Share'}</span>
        </button>

        <div className="text-xs text-text-disabled">
          {connectionState === 'connecting' && 'Connecting...'}
          {connectionState === 'connected' && '● Connected'}
          {connectionState === 'disconnected' && '○ Disconnected'}
          {connectionState === 'error' && '✕ Error'}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 pb-32 overflow-auto">
        <div className="max-w-md mx-auto space-y-6">
          {/* Title */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="font-display text-3xl text-text-primary tracking-wide">LOBBY</h1>
            <p className="text-text-secondary mt-1">
              {readyCount}/{players.length} ready
            </p>
          </motion.div>

          {/* Players */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-text-secondary mb-2">
              Players ({players.length}/12)
            </h2>
            {players.map((player) => (
              <PlayerCard key={player.id} player={player} isMe={player.id === playerId} />
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 3 - players.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-bg-surface"
              >
                <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center">
                  <span className="text-text-disabled">?</span>
                </div>
                <span className="text-text-disabled">Waiting for player...</span>
              </div>
            ))}
          </div>

          {/* Voice Chat */}
          <VoiceControls variant="full" />

          {/* Settings */}
          <SettingsPanel settings={settings} onChange={handleUpdateSettings} disabled={!isHost} />
        </div>
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg-primary border-t border-bg-surface">
        <div className="max-w-md mx-auto flex gap-3">
          {isHost ? (
            <Button
              variant="danger"
              size="lg"
              fullWidth
              glow
              onClick={handleStartGame}
              disabled={!allReady || players.length < getTotalPlayers(settings)}
            >
              {players.length < getTotalPlayers(settings)
                ? `Need ${getTotalPlayers(settings)} players (${players.length} joined)`
                : !allReady
                ? `Waiting (${readyCount}/${players.length})`
                : 'Start Game'}
            </Button>
          ) : (
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              onClick={handleToggleReady}
            >
              {isReady ? 'Not Ready' : 'Ready Up'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
