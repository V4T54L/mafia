import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useGameStore } from '../stores/gameStore'

interface GhostChatProps {
  isOpen: boolean
  onToggle: () => void
}

export function GhostChat({ isOpen, onToggle }: GhostChatProps) {
  const { send } = useWebSocket()
  const { ghostMessages, playerId, players } = useGameStore()
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const me = players.find(p => p.id === playerId)
  const isDead = me?.status === 'dead'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ghostMessages])

  const handleSend = () => {
    if (!message.trim() || !isDead) return

    send('ghost_chat', { message: message.trim() })
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Count unread messages (messages from others since last open)
  const unreadCount = ghostMessages.filter(m => m.fromId !== playerId).length

  if (!isDead) {
    return null
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`
          relative p-3 rounded-full shadow-lg transition-all
          ${isOpen
            ? 'bg-accent-neutral text-bg-primary'
            : 'bg-bg-surface text-text-primary hover:bg-bg-elevated'
          }
        `}
      >
        <GhostIcon className="w-6 h-6" />
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-mafia text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-80 bg-bg-surface rounded-xl shadow-xl border border-bg-elevated overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-bg-elevated flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GhostIcon className="w-5 h-5 text-text-secondary" />
                <span className="font-medium text-text-primary">Ghost Chat</span>
              </div>
              <button
                onClick={onToggle}
                className="p-1 rounded hover:bg-bg-elevated transition-colors"
              >
                <CloseIcon className="w-4 h-4 text-text-secondary" />
              </button>
            </div>

            {/* Messages */}
            <div className="h-64 overflow-y-auto p-3 space-y-3">
              {ghostMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-text-disabled text-sm">
                  No messages yet. Say hi to other ghosts!
                </div>
              ) : (
                ghostMessages.map((msg, index) => (
                  <div
                    key={`${msg.timestamp}-${index}`}
                    className={`flex flex-col ${msg.fromId === playerId ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] rounded-lg px-3 py-2
                        ${msg.fromId === playerId
                          ? 'bg-accent-neutral/20 text-text-primary'
                          : 'bg-bg-elevated text-text-primary'
                        }
                      `}
                    >
                      {msg.fromId !== playerId && (
                        <div className="text-xs text-accent-neutral font-medium mb-1">
                          {msg.fromNickname}
                        </div>
                      )}
                      <p className="text-sm break-words">{msg.message}</p>
                    </div>
                    <span className="text-xs text-text-disabled mt-1">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-bg-elevated">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message other ghosts..."
                  maxLength={500}
                  className="flex-1 px-3 py-2 bg-bg-elevated rounded-lg text-text-primary placeholder:text-text-disabled text-sm focus:outline-none focus:ring-2 focus:ring-accent-neutral/50"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="px-3 py-2 bg-accent-neutral/20 hover:bg-accent-neutral/30 text-accent-neutral rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Icon components
function GhostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C7.03 2 3 6.03 3 11v9.5c0 .28.22.5.5.5s.5-.22.5-.5V18c0-.28.22-.5.5-.5s.5.22.5.5v2.5c0 .28.22.5.5.5s.5-.22.5-.5V18c0-.28.22-.5.5-.5s.5.22.5.5v2.5c0 .28.22.5.5.5s.5-.22.5-.5V18c0-.28.22-.5.5-.5s.5.22.5.5v2.5c0 .28.22.5.5.5s.5-.22.5-.5V18c0-.28.22-.5.5-.5s.5.22.5.5v2.5c0 .28.22.5.5.5s.5-.22.5-.5V18c0-.28.22-.5.5-.5s.5.22.5.5v2.5c0 .28.22.5.5.5s.5-.22.5-.5V11c0-4.97-4.03-9-9-9zm-2 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}
