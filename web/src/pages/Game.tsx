import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui'
import { VoiceControls } from '../components/VoiceControls'
import { GhostChat } from '../components/GhostChat'
import { VoteDetailModal } from '../components/VoteDetailModal'
import { useGameStore } from '../stores/gameStore'
import { useWebSocket } from '../contexts/WebSocketContext'
import type { Role, Player, Team } from '../stores/gameStore'

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
    description: 'Lead the Mafia. You appear innocent to the Detective.',
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

// Component: Role Reveal
function RoleReveal({
  role,
  teammates,
}: {
  role: Role
  teammates: Array<{ id: string; nickname: string; role: Role }>
}) {
  const info = roleInfo[role]

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
        <div className={`text-8xl mb-4 ${info.team === 'mafia' ? 'animate-pulse' : ''}`}>
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
        <p className="text-text-secondary max-w-xs mx-auto mb-6">{info.description}</p>

        {/* Show teammates for mafia */}
        {teammates.length > 0 && (
          <div className="mt-4 p-4 bg-accent-mafia/10 rounded-xl">
            <p className="text-sm text-accent-mafia mb-2">Your partners:</p>
            {teammates.map((t) => (
              <p key={t.id} className="text-accent-mafia">
                {roleInfo[t.role].icon} {t.nickname}
              </p>
            ))}
          </div>
        )}
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
  onVoteCountClick,
}: {
  player: Player
  isMe: boolean
  isSelectable: boolean
  isSelected: boolean
  onSelect?: () => void
  showRole?: boolean
  votedBy?: number
  onVoteCountClick?: () => void
}) {
  const isDead = player.status === 'dead'
  const isDisconnected = player.isConnected === false
  const role = showRole && player.role ? roleInfo[player.role] : null

  return (
    <motion.button
      onClick={isSelectable && !isDead ? onSelect : undefined}
      disabled={!isSelectable || isDead}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl transition-all
        ${isDead ? 'opacity-50' : ''}
        ${isDisconnected && !isDead ? 'opacity-60' : ''}
        ${isSelectable && !isDead ? 'cursor-pointer hover:bg-bg-elevated' : 'cursor-default'}
        ${isSelected ? 'ring-2 ring-accent-mafia bg-accent-mafia/10' : 'bg-bg-surface'}
        ${isMe ? 'border border-accent-neutral/30' : ''}
      `}
      whileTap={isSelectable && !isDead ? { scale: 0.98 } : {}}
    >
      {/* Avatar */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl bg-bg-elevated ${isDisconnected && !isDead ? 'ring-2 ring-accent-warning ring-offset-2 ring-offset-bg-surface' : ''}`}>
        {isDead ? '💀' : isDisconnected ? '📵' : player.nickname.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isDead ? 'text-text-disabled line-through' : isDisconnected ? 'text-text-secondary' : 'text-text-primary'}`}>
            {player.nickname}
          </span>
          {isMe && (
            <span className="text-xs px-2 py-0.5 bg-accent-neutral/20 text-accent-neutral rounded-full">
              You
            </span>
          )}
          {isDisconnected && !isDead && (
            <span className="text-xs px-2 py-0.5 bg-accent-warning/20 text-accent-warning rounded-full">
              Disconnected
            </span>
          )}
        </div>
        {showRole && role && (
          <div className={`text-sm ${role.team === 'mafia' ? 'text-accent-mafia' : 'text-accent-town'}`}>
            {role.icon} {role.name}
          </div>
        )}
        {isDead && <span className="text-sm text-text-disabled">Eliminated</span>}
        {isDisconnected && !isDead && <span className="text-sm text-accent-warning">Reconnecting...</span>}
      </div>

      {/* Vote count - clickable to see voters */}
      {votedBy !== undefined && votedBy > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onVoteCountClick?.()
          }}
          className="w-8 h-8 rounded-full bg-accent-mafia/20 flex items-center justify-center hover:bg-accent-mafia/30 transition-colors"
        >
          <span className="text-accent-mafia font-bold text-sm">{votedBy}</span>
        </button>
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
  myId,
  players,
  timer,
  onAction,
}: {
  myRole: Role
  myId: string
  players: Player[]
  timer: number | null
  onAction: (targetId: string) => void
}) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const alivePlayers = players.filter((p) => p.status === 'alive')
  const canAct = ['mafia', 'godfather', 'doctor', 'detective'].includes(myRole)
  const isMafia = myRole === 'mafia' || myRole === 'godfather'

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

  const canTarget = (playerId: string) => {
    if (playerId === myId && myRole !== 'doctor') return false // Doctor can self-protect
    if (isMafia) {
      // Mafia can't target other mafia
      const target = players.find((p) => p.id === playerId)
      if (target?.role === 'mafia' || target?.role === 'godfather') return false
    }
    return true
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
        {timer !== null && (
          <div className="text-center mb-6">
            <span className="text-4xl font-mono text-accent-neutral">{timer}s</span>
          </div>
        )}

        {/* Player selection */}
        {canAct && !hasSubmitted && (
          <div className="space-y-2">
            {alivePlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isMe={player.id === myId}
                isSelectable={canTarget(player.id)}
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

// Component: Night Result
function NightResultPhase({
  killedNickname,
  wasSaved,
  investigation,
}: {
  killedNickname: string | null
  wasSaved: boolean
  investigation?: { targetNickname: string; isMafia: boolean }
}) {
  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="text-4xl mb-4">☀️</div>
        <h1 className="font-display text-3xl text-text-primary tracking-wide mb-6">DAWN BREAKS</h1>

        {wasSaved ? (
          <div className="bg-accent-success/10 border border-accent-success/20 rounded-xl p-4 mb-4">
            <p className="text-accent-success">No one was killed last night.</p>
            <p className="text-text-secondary text-sm mt-1">The Doctor saved someone...</p>
          </div>
        ) : killedNickname ? (
          <div className="bg-accent-mafia/10 border border-accent-mafia/20 rounded-xl p-4 mb-4">
            <p className="text-accent-mafia">
              <span className="font-semibold">{killedNickname}</span> was eliminated.
            </p>
          </div>
        ) : (
          <div className="bg-bg-surface rounded-xl p-4 mb-4">
            <p className="text-text-secondary">The Mafia did not kill anyone.</p>
          </div>
        )}

        {investigation && (
          <div className="bg-accent-neutral/10 border border-accent-neutral/20 rounded-xl p-4 mt-4">
            <p className="text-accent-neutral text-sm">Investigation Result:</p>
            <p className={investigation.isMafia ? 'text-accent-mafia' : 'text-accent-town'}>
              {investigation.targetNickname} is {investigation.isMafia ? 'MAFIA' : 'NOT MAFIA'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Component: Day Phase
function DayPhase({
  myId,
  players,
  timer,
  voteCounts,
  voteMap,
  submittedVoters,
  onVote,
}: {
  myId: string
  players: Player[]
  timer: number | null
  voteCounts: Record<string, number>
  voteMap: Record<string, string>
  submittedVoters: string[]
  onVote: (targetId: string | null) => void
}) {
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null)

  const alivePlayers = players.filter((p) => p.status === 'alive')
  const amIDead = players.find((p) => p.id === myId)?.status === 'dead'

  const handleSubmitVote = () => {
    onVote(selectedVote)
    setHasVoted(true)
  }

  // Get voters for a specific target
  const getVotersFor = (targetId: string) => {
    const voters: Array<{ player: Player; isSubmitted: boolean }> = []
    for (const [voterId, target] of Object.entries(voteMap)) {
      if (target === targetId) {
        const player = players.find((p) => p.id === voterId)
        if (player) {
          voters.push({
            player,
            isSubmitted: submittedVoters.includes(voterId),
          })
        }
      }
    }
    return voters
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

        {/* Timer */}
        {timer !== null && (
          <div className="text-center mb-6">
            <span className="text-4xl font-mono text-accent-neutral">{timer}s</span>
          </div>
        )}

        {/* Dead player notice */}
        {amIDead && (
          <div className="bg-bg-surface rounded-xl p-4 mb-6 text-center">
            <p className="text-text-disabled">You are dead. You cannot vote.</p>
          </div>
        )}

        {/* Player list with voting */}
        <div className="space-y-2">
          {alivePlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isMe={player.id === myId}
              isSelectable={!hasVoted && !amIDead && player.id !== myId}
              isSelected={selectedVote === player.id}
              onSelect={() => setSelectedVote(player.id)}
              votedBy={voteCounts[player.id]}
              onVoteCountClick={() => setModalPlayer(player)}
            />
          ))}
        </div>

        {/* Vote Detail Modal */}
        <VoteDetailModal
          isOpen={modalPlayer !== null}
          onClose={() => setModalPlayer(null)}
          targetPlayer={modalPlayer}
          voters={modalPlayer ? getVotersFor(modalPlayer.id) : []}
        />

        {/* Skip vote option */}
        {!hasVoted && !amIDead && (
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
      {!hasVoted && !amIDead && (
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

// Component: Day Result
function DayResultPhase({
  eliminatedNickname,
  eliminatedRole,
  noMajority,
}: {
  eliminatedNickname: string | null
  eliminatedRole: Role | null
  noMajority: boolean
}) {
  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="text-4xl mb-4">⚖️</div>
        <h1 className="font-display text-3xl text-text-primary tracking-wide mb-6">VERDICT</h1>

        {noMajority ? (
          <div className="bg-bg-surface rounded-xl p-4">
            <p className="text-text-secondary">No majority reached.</p>
            <p className="text-text-disabled text-sm mt-1">No one was eliminated.</p>
          </div>
        ) : eliminatedNickname ? (
          <div className="bg-accent-mafia/10 border border-accent-mafia/20 rounded-xl p-4">
            <p className="text-accent-mafia mb-2">
              <span className="font-semibold">{eliminatedNickname}</span> was eliminated.
            </p>
            {eliminatedRole && (
              <p className={eliminatedRole === 'mafia' || eliminatedRole === 'godfather' ? 'text-accent-mafia' : 'text-accent-town'}>
                They were the {roleInfo[eliminatedRole].icon} {roleInfo[eliminatedRole].name}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Component: Game Over
function GameOver({
  winner,
  players,
  myId,
  onLeave,
}: {
  winner: Team
  players: Player[]
  myId: string
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
                isMe={player.id === myId}
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
        <div className="max-w-md mx-auto">
          <Button variant="primary" size="lg" fullWidth onClick={onLeave}>
            Leave Game
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
  const { send, isConnected } = useWebSocket()
  const [isGhostChatOpen, setIsGhostChatOpen] = useState(false)

  const {
    phase,
    playerId,
    myRole,
    teammates,
    players,
    phaseTimer,
    voteCounts,
    voteMap,
    submittedVoters,
    nightResult,
    dayResult,
    winner,
    roomCode,
    reset,
  } = useGameStore()

  // Redirect to lobby if not in a game
  useEffect(() => {
    if (isConnected && !roomCode) {
      navigate(`/join/${code}`)
    }
  }, [isConnected, roomCode, code, navigate])

  // Redirect to lobby if still in lobby phase
  useEffect(() => {
    if (phase === 'lobby') {
      navigate(`/lobby/${code}`)
    }
  }, [phase, code, navigate])

  const handleNightAction = (targetId: string) => {
    send('night_action', { target_id: targetId })
  }

  const handleDayVote = (targetId: string | null) => {
    send('day_vote', { target_id: targetId || '' })
  }

  const handleLeave = () => {
    send('leave_room', {})
    reset()
    navigate('/')
  }

  if (!myRole || !playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <p className="text-text-secondary">Loading game...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Role reveal overlay */}
      <AnimatePresence>
        {phase === 'role_reveal' && (
          <RoleReveal role={myRole} teammates={teammates} />
        )}
      </AnimatePresence>

      {/* Header (not shown during role reveal) */}
      {phase !== 'role_reveal' && (
        <header className="p-4 flex items-center justify-between border-b border-bg-surface">
          <div className="text-text-secondary text-sm">
            Room: <span className="font-mono">{roomCode || code}</span>
          </div>
          <VoiceControls variant="compact" />
          <div className="text-text-secondary text-sm">
            {roleInfo[myRole].icon} {roleInfo[myRole].name}
          </div>
        </header>
      )}

      {/* Phase content */}
      {phase === 'night' && (
        <NightPhase
          myRole={myRole}
          myId={playerId}
          players={players}
          timer={phaseTimer}
          onAction={handleNightAction}
        />
      )}

      {phase === 'night_result' && nightResult && (
        <NightResultPhase
          killedNickname={nightResult.killedNickname}
          wasSaved={nightResult.wasSaved}
          investigation={nightResult.investigation}
        />
      )}

      {phase === 'day' && (
        <DayPhase
          myId={playerId}
          players={players}
          timer={phaseTimer}
          voteCounts={voteCounts}
          voteMap={voteMap}
          submittedVoters={submittedVoters}
          onVote={handleDayVote}
        />
      )}

      {phase === 'day_result' && dayResult && (
        <DayResultPhase
          eliminatedNickname={dayResult.eliminatedNickname}
          eliminatedRole={dayResult.eliminatedRole}
          noMajority={dayResult.noMajority}
        />
      )}

      {phase === 'game_over' && winner && (
        <GameOver
          winner={winner}
          players={players}
          myId={playerId}
          onLeave={handleLeave}
        />
      )}

      {/* Ghost chat for dead players */}
      <GhostChat
        isOpen={isGhostChatOpen}
        onToggle={() => setIsGhostChatOpen(!isGhostChatOpen)}
      />
    </div>
  )
}
