import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui'
import type { GamePhase, Role, Player, Team } from '../stores/gameStore'

// Role display info
const roleInfo: Record<Role, { icon: string; name: string; team: Team; description: string }> = {
  villager: {
    icon: '👤',
    name: 'Villager',
    team: 'town',
    description: 'Find and eliminate the Mafia. You have no special abilities, but your voice matters.',
  },
  mafia: {
    icon: '💀',
    name: 'Mafia',
    team: 'mafia',
    description: 'Eliminate the Town. Each night, choose a victim with your partners.',
  },
  godfather: {
    icon: '🎩',
    name: 'Godfather',
    team: 'mafia',
    description: 'Lead the Mafia. You appear innocent to the Detective... the first time.',
  },
  doctor: {
    icon: '💊',
    name: 'Doctor',
    team: 'town',
    description: 'Each night, protect one player from elimination.',
  },
  detective: {
    icon: '🔍',
    name: 'Detective',
    team: 'town',
    description: 'Each night, investigate one player to learn if they are Mafia.',
  },
}

// Mock game state
const mockPlayers: Player[] = [
  { id: '1', nickname: 'Alice', isHost: true, isReady: true, status: 'alive', role: 'detective' },
  { id: '2', nickname: 'Bob', isHost: false, isReady: true, status: 'alive', role: 'mafia' },
  { id: '3', nickname: 'Charlie', isHost: false, isReady: true, status: 'dead', role: 'villager' },
  { id: '4', nickname: 'Diana', isHost: false, isReady: true, status: 'alive', role: 'doctor' },
  { id: '5', nickname: 'Eve', isHost: false, isReady: true, status: 'alive', role: 'mafia' },
  { id: '6', nickname: 'Frank', isHost: false, isReady: true, status: 'alive', role: 'villager' },
]

// Component: Role Reveal
function RoleReveal({ role, onContinue }: { role: Role; onContinue: () => void }) {
  const info = roleInfo[role]

  useEffect(() => {
    const timer = setTimeout(onContinue, 5000)
    return () => clearTimeout(timer)
  }, [onContinue])

  return (
    <motion.div
      className="fixed inset-0 bg-bg-primary flex flex-col items-center justify-center p-6 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <p className="text-text-secondary mb-4">You are the</p>
        <div
          className={`text-8xl mb-4 ${info.team === 'mafia' ? 'animate-pulse' : ''}`}
        >
          {info.icon}
        </div>
        <h1
          className={`font-display text-5xl mb-2 tracking-wide ${
            info.team === 'mafia' ? 'text-accent-mafia' : 'text-accent-town'
          }`}
        >
          {info.name.toUpperCase()}
        </h1>
        <p
          className={`text-sm font-medium mb-6 ${
            info.team === 'mafia' ? 'text-accent-mafia' : 'text-accent-town'
          }`}
        >
          {info.team === 'mafia' ? 'Mafia' : 'Town'}
        </p>
        <p className="text-text-secondary max-w-xs mx-auto">{info.description}</p>
      </motion.div>

      <motion.p
        className="absolute bottom-8 text-text-disabled text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Starting soon...
      </motion.p>
    </motion.div>
  )
}

// Component: Player Card
function PlayerCard({
  player,
  isMe,
  isSelectable,
  isSelected,
  onSelect,
  showRole,
  votedBy,
}: {
  player: Player
  isMe: boolean
  isSelectable: boolean
  isSelected: boolean
  onSelect?: () => void
  showRole?: boolean
  votedBy?: number
}) {
  const isDead = player.status === 'dead'
  const role = showRole && player.role ? roleInfo[player.role] : null

  return (
    <motion.button
      onClick={isSelectable && !isDead ? onSelect : undefined}
      disabled={!isSelectable || isDead}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl transition-all
        ${isDead ? 'opacity-50' : ''}
        ${isSelectable && !isDead ? 'cursor-pointer hover:bg-bg-elevated' : 'cursor-default'}
        ${isSelected ? 'ring-2 ring-accent-mafia bg-accent-mafia/10' : 'bg-bg-surface'}
        ${isMe ? 'border border-accent-neutral/30' : ''}
      `}
      whileTap={isSelectable && !isDead ? { scale: 0.98 } : {}}
    >
      {/* Avatar */}
      <div
        className={`
          w-12 h-12 rounded-full flex items-center justify-center text-xl
          ${isDead ? 'bg-bg-elevated' : 'bg-bg-elevated'}
        `}
      >
        {isDead ? '💀' : player.nickname.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isDead ? 'text-text-disabled line-through' : 'text-text-primary'}`}>
            {player.nickname}
          </span>
          {isMe && (
            <span className="text-xs px-2 py-0.5 bg-accent-neutral/20 text-accent-neutral rounded-full">
              You
            </span>
          )}
        </div>
        {showRole && role && (
          <div className={`text-sm ${role.team === 'mafia' ? 'text-accent-mafia' : 'text-accent-town'}`}>
            {role.icon} {role.name}
          </div>
        )}
        {isDead && <span className="text-sm text-text-disabled">Eliminated</span>}
      </div>

      {/* Vote count */}
      {votedBy !== undefined && votedBy > 0 && (
        <div className="w-8 h-8 rounded-full bg-accent-mafia/20 flex items-center justify-center">
          <span className="text-accent-mafia font-bold text-sm">{votedBy}</span>
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-6 h-6 rounded-full bg-accent-mafia flex items-center justify-center">
          <span className="text-white text-sm">✓</span>
        </div>
      )}
    </motion.button>
  )
}

// Component: Night Phase
function NightPhase({
  myRole,
  players,
  timer,
  onAction,
}: {
  myRole: Role
  players: Player[]
  timer: number
  onAction: (targetId: string) => void
}) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const alivePlayers = players.filter((p) => p.status === 'alive')
  const canAct = ['mafia', 'godfather', 'doctor', 'detective'].includes(myRole)

  const getActionText = () => {
    switch (myRole) {
      case 'mafia':
      case 'godfather':
        return 'Choose who to eliminate'
      case 'doctor':
        return 'Choose who to protect'
      case 'detective':
        return 'Choose who to investigate'
      default:
        return 'Wait for night to end...'
    }
  }

  const handleSubmit = () => {
    if (selectedTarget) {
      onAction(selectedTarget)
      setHasSubmitted(true)
    }
  }

  return (
    <div className="flex-1 p-4 pb-32">
      <div className="max-w-md mx-auto">
        {/* Phase header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌙</div>
          <h1 className="font-display text-3xl text-text-primary tracking-wide">NIGHT</h1>
          <p className="text-text-secondary mt-1">{getActionText()}</p>
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          <span className="text-4xl font-mono text-accent-neutral">{timer}s</span>
        </div>

        {/* Player selection */}
        {canAct && !hasSubmitted && (
          <div className="space-y-2">
            {alivePlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isMe={player.id === '1'}
                isSelectable={player.id !== '1'} // Can't target self (except doctor maybe)
                isSelected={selectedTarget === player.id}
                onSelect={() => setSelectedTarget(player.id)}
              />
            ))}
          </div>
        )}

        {/* Waiting state for villagers */}
        {!canAct && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">😴</div>
            <p className="text-text-secondary">The town sleeps...</p>
          </div>
        )}

        {/* Submitted state */}
        {hasSubmitted && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✓</div>
            <p className="text-text-secondary">Action submitted. Waiting for others...</p>
          </div>
        )}
      </div>

      {/* Submit button */}
      {canAct && !hasSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg-primary border-t border-bg-surface">
          <div className="max-w-md mx-auto">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              glow
              disabled={!selectedTarget}
              onClick={handleSubmit}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Component: Day Phase
function DayPhase({
  players,
  onVote,
}: {
  players: Player[]
  onVote: (targetId: string | null) => void
}) {
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)

  // Mock vote counts
  const voteCounts: Record<string, number> = {
    '2': 2,
    '5': 1,
  }

  const alivePlayers = players.filter((p) => p.status === 'alive')

  const handleSubmitVote = () => {
    onVote(selectedVote)
    setHasVoted(true)
  }

  return (
    <div className="flex-1 p-4 pb-32">
      <div className="max-w-md mx-auto">
        {/* Phase header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">☀️</div>
          <h1 className="font-display text-3xl text-text-primary tracking-wide">DAY</h1>
          <p className="text-text-secondary mt-1">Discuss and vote to eliminate</p>
        </div>

        {/* Info banner */}
        <div className="bg-accent-mafia/10 border border-accent-mafia/20 rounded-xl p-3 mb-6 text-center">
          <p className="text-sm text-accent-mafia">
            <span className="font-semibold">Charlie</span> was eliminated last night
          </p>
        </div>

        {/* Player list with voting */}
        <div className="space-y-2">
          {alivePlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isMe={player.id === '1'}
              isSelectable={!hasVoted && player.id !== '1'}
              isSelected={selectedVote === player.id}
              onSelect={() => setSelectedVote(player.id)}
              votedBy={voteCounts[player.id]}
            />
          ))}
        </div>

        {/* Skip vote option */}
        {!hasVoted && (
          <button
            onClick={() => setSelectedVote(null)}
            className={`
              w-full mt-4 p-3 rounded-xl text-center transition-all
              ${selectedVote === null ? 'ring-2 ring-text-disabled bg-bg-surface' : 'bg-bg-surface hover:bg-bg-elevated'}
            `}
          >
            <span className="text-text-secondary">Skip vote (no elimination)</span>
          </button>
        )}

        {/* Voted state */}
        {hasVoted && (
          <div className="text-center py-8">
            <p className="text-accent-success">Vote submitted!</p>
            <p className="text-text-secondary text-sm mt-1">Waiting for others...</p>
          </div>
        )}
      </div>

      {/* Submit button */}
      {!hasVoted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg-primary border-t border-bg-surface">
          <div className="max-w-md mx-auto">
            <Button variant="danger" size="lg" fullWidth glow onClick={handleSubmitVote}>
              {selectedVote ? 'Vote to Eliminate' : 'Skip Vote'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Component: Game Over
function GameOver({
  winner,
  players,
  onPlayAgain,
  onLeave,
}: {
  winner: Team
  players: Player[]
  onPlayAgain: () => void
  onLeave: () => void
}) {
  return (
    <div className="flex-1 p-4 pb-32">
      <div className="max-w-md mx-auto text-center">
        {/* Winner announcement */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-6xl mb-4">{winner === 'mafia' ? '💀' : '🎉'}</div>
          <h1
            className={`font-display text-4xl mb-2 tracking-wide ${
              winner === 'mafia' ? 'text-accent-mafia' : 'text-accent-town'
            }`}
          >
            {winner === 'mafia' ? 'MAFIA WINS' : 'TOWN WINS'}
          </h1>
          <p className="text-text-secondary mb-8">
            {winner === 'mafia'
              ? 'The Mafia has taken over the town.'
              : 'The town has eliminated all the Mafia.'}
          </p>
        </motion.div>

        {/* All roles revealed */}
        <div className="text-left">
          <h2 className="text-sm font-medium text-text-secondary mb-3">All Players</h2>
          <div className="space-y-2">
            {players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isMe={player.id === '1'}
                isSelectable={false}
                isSelected={false}
                showRole
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg-primary border-t border-bg-surface">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="secondary" size="lg" fullWidth onClick={onLeave}>
            Leave
          </Button>
          <Button variant="primary" size="lg" fullWidth onClick={onPlayAgain}>
            Play Again
          </Button>
        </div>
      </div>
    </div>
  )
}

// Main Game component
export function Game() {
  const { code } = useParams()
  const navigate = useNavigate()

  // Mock state - will be replaced with Zustand/WebSocket
  const [phase, setPhase] = useState<GamePhase>('role_reveal')
  const [myRole] = useState<Role>('detective')
  const [players] = useState<Player[]>(mockPlayers)
  const [timer, setTimer] = useState(60)
  const [winner, setWinner] = useState<Team | null>(null)

  // Mock: cycle through phases for demo
  useEffect(() => {
    if (phase === 'role_reveal') {
      const timeout = setTimeout(() => setPhase('night'), 5000)
      return () => clearTimeout(timeout)
    }
  }, [phase])

  // Mock timer countdown
  useEffect(() => {
    if (phase === 'night' && timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000)
      return () => clearInterval(interval)
    }
  }, [phase, timer])

  const handleNightAction = (targetId: string) => {
    console.log('Night action on:', targetId)
    // After some delay, move to day
    setTimeout(() => {
      setPhase('day')
      setTimer(0) // No timer for day in MVP
    }, 2000)
  }

  const handleDayVote = (targetId: string | null) => {
    console.log('Day vote:', targetId)
    // After some delay, show game over (mock)
    setTimeout(() => {
      setWinner('town')
      setPhase('game_over')
    }, 2000)
  }

  const handlePlayAgain = () => {
    navigate(`/lobby/${code}`)
  }

  const handleLeave = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Role reveal overlay */}
      <AnimatePresence>
        {phase === 'role_reveal' && (
          <RoleReveal role={myRole} onContinue={() => setPhase('night')} />
        )}
      </AnimatePresence>

      {/* Header (not shown during role reveal) */}
      {phase !== 'role_reveal' && (
        <header className="p-4 flex items-center justify-between border-b border-bg-surface">
          <div className="text-text-secondary text-sm">
            Room: <span className="font-mono">{code}</span>
          </div>
          <div className="text-text-secondary text-sm">
            {roleInfo[myRole].icon} {roleInfo[myRole].name}
          </div>
        </header>
      )}

      {/* Phase content */}
      {phase === 'night' && (
        <NightPhase myRole={myRole} players={players} timer={timer} onAction={handleNightAction} />
      )}

      {phase === 'day' && <DayPhase players={players} onVote={handleDayVote} />}

      {phase === 'game_over' && winner && (
        <GameOver
          winner={winner}
          players={players}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
        />
      )}
    </div>
  )
}
