import { motion, AnimatePresence } from 'framer-motion'
import { useVoice } from '../contexts/VoiceContext'

interface VoiceControlsProps {
  variant?: 'full' | 'compact'
}

export function VoiceControls({ variant = 'full' }: VoiceControlsProps) {
  const {
    isVoiceEnabled,
    isConnecting,
    isConnected,
    isMuted,
    canSpeak,
    joinVoice,
    leaveVoice,
    toggleMute,
  } = useVoice()

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {!isVoiceEnabled ? (
          <button
            onClick={joinVoice}
            disabled={isConnecting}
            className="p-2 rounded-full bg-bg-surface hover:bg-bg-elevated transition-colors disabled:opacity-50"
            title="Join voice chat"
          >
            <MicrophoneIcon className="w-5 h-5 text-text-secondary" />
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              disabled={!canSpeak}
              className={`
                p-2 rounded-full transition-colors
                ${isMuted || !canSpeak
                  ? 'bg-accent-mafia/20 hover:bg-accent-mafia/30'
                  : 'bg-accent-success/20 hover:bg-accent-success/30'
                }
                disabled:opacity-50
              `}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || !canSpeak ? (
                <MicrophoneOffIcon className="w-5 h-5 text-accent-mafia" />
              ) : (
                <MicrophoneIcon className="w-5 h-5 text-accent-success" />
              )}
            </button>
            <button
              onClick={leaveVoice}
              className="p-2 rounded-full bg-bg-surface hover:bg-accent-mafia/20 transition-colors"
              title="Leave voice chat"
            >
              <PhoneOffIcon className="w-5 h-5 text-text-secondary hover:text-accent-mafia" />
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-bg-surface rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-text-primary">Voice Chat</h3>
        <div className="flex items-center gap-2">
          {isConnecting && (
            <span className="text-xs text-text-secondary animate-pulse">Connecting...</span>
          )}
          {isConnected && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-success animate-pulse" />
              <span className="text-xs text-accent-success">Connected</span>
            </span>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isVoiceEnabled ? (
          <motion.button
            key="join"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={joinVoice}
            disabled={isConnecting}
            className={`
              w-full py-3 rounded-lg font-medium transition-all
              bg-accent-town/20 hover:bg-accent-town/30 text-accent-town
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isConnecting ? 'Joining...' : 'Join Voice Chat'}
          </motion.button>
        ) : (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-2"
          >
            <button
              onClick={toggleMute}
              disabled={!canSpeak}
              className={`
                flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2
                ${isMuted || !canSpeak
                  ? 'bg-accent-mafia/20 text-accent-mafia'
                  : 'bg-accent-success/20 text-accent-success'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isMuted || !canSpeak ? (
                <>
                  <MicrophoneOffIcon className="w-5 h-5" />
                  <span>{!canSpeak ? 'Muted (Phase)' : 'Unmute'}</span>
                </>
              ) : (
                <>
                  <MicrophoneIcon className="w-5 h-5" />
                  <span>Mute</span>
                </>
              )}
            </button>
            <button
              onClick={leaveVoice}
              className="py-3 px-4 rounded-lg bg-bg-elevated hover:bg-accent-mafia/20 text-text-secondary hover:text-accent-mafia transition-all"
            >
              <PhoneOffIcon className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!canSpeak && isVoiceEnabled && (
        <p className="mt-2 text-xs text-text-disabled text-center">
          Voice muted during this phase
        </p>
      )}
    </div>
  )
}

// Icon components
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )
}

function MicrophoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  )
}

function PhoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.28 3H5z" />
    </svg>
  )
}
