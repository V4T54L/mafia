import { motion, AnimatePresence } from 'framer-motion'
import type { Player } from '../stores/gameStore'

interface VoteDetailModalProps {
  isOpen: boolean
  onClose: () => void
  targetPlayer: Player | null
  voters: Array<{ player: Player; isSubmitted: boolean }>
}

export function VoteDetailModal({ isOpen, onClose, targetPlayer, voters }: VoteDetailModalProps) {
  if (!targetPlayer) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
            initial={{ opacity: 0, scale: 0.9, y: '-40%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.9, y: '-40%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="bg-bg-surface rounded-2xl p-6 shadow-xl">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center text-2xl mx-auto mb-3">
                  {targetPlayer.nickname.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {targetPlayer.nickname}
                </h2>
                <p className="text-text-secondary text-sm mt-1">
                  {voters.length === 0 ? 'No votes' : `${voters.length} vote${voters.length === 1 ? '' : 's'}`}
                </p>
              </div>

              {/* Voter list */}
              {voters.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-text-disabled uppercase tracking-wider">Voted by</p>
                  {voters.map(({ player, isSubmitted }) => (
                    <div
                      key={player.id}
                      className={`
                        flex items-center gap-3 p-2 rounded-lg
                        ${isSubmitted ? 'bg-bg-elevated' : 'bg-bg-elevated/50 border border-dashed border-text-disabled/30'}
                      `}
                    >
                      <div className="w-8 h-8 rounded-full bg-bg-primary flex items-center justify-center text-sm">
                        {player.nickname.charAt(0).toUpperCase()}
                      </div>
                      <span className={isSubmitted ? 'text-text-primary' : 'text-text-secondary'}>
                        {player.nickname}
                      </span>
                      {!isSubmitted && (
                        <span className="text-xs text-text-disabled ml-auto">(pending)</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {voters.length === 0 && (
                <div className="text-center py-4 text-text-disabled">
                  No one has voted for this player yet.
                </div>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className="w-full py-3 bg-bg-elevated hover:bg-bg-primary rounded-xl text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
