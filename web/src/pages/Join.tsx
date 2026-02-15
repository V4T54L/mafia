import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../components/ui'
import { useWebSocket } from '../hooks/useWebSocket'
import { useGameStore } from '../stores/gameStore'

export function Join() {
  const { code: urlCode } = useParams()
  const navigate = useNavigate()

  const [roomCode, setRoomCode] = useState(urlCode || '')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [isCreating, setIsCreating] = useState(!urlCode)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { connect, send, once, isConnected, connectionState } = useWebSocket()
  const { roomCode: storeRoomCode, reset } = useGameStore()

  // Connect to WebSocket on mount
  useEffect(() => {
    reset() // Clear any previous state
    connect()
  }, [connect, reset])

  // Navigate to lobby when room is joined/created
  useEffect(() => {
    if (storeRoomCode) {
      navigate(`/lobby/${storeRoomCode}`)
    }
  }, [storeRoomCode, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!nickname.trim()) {
      setError('Please enter a nickname')
      return
    }

    if (!isCreating && !roomCode.trim()) {
      setError('Please enter a room code')
      return
    }

    if (!isConnected) {
      setError('Connecting to server...')
      return
    }

    setIsLoading(true)

    // Register error handler
    once('error', (payload) => {
      const { message } = payload as { code: string; message: string }
      setError(message)
      setIsLoading(false)
    })

    if (isCreating) {
      // Create room
      send('create_room', {
        nickname: nickname.trim(),
        password: password || undefined,
      })
    } else {
      // Join room
      send('join_room', {
        room_code: roomCode.toUpperCase(),
        nickname: nickname.trim(),
        password: password || undefined,
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back
        </button>
        <div className="text-xs text-text-disabled">
          {connectionState === 'connecting' && 'Connecting...'}
          {connectionState === 'connected' && '● Connected'}
          {connectionState === 'disconnected' && '○ Disconnected'}
          {connectionState === 'error' && '✕ Error'}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <h1 className="font-display text-4xl text-center text-text-primary mb-2 tracking-wide">
            {isCreating ? 'CREATE GAME' : 'JOIN GAME'}
          </h1>
          <p className="text-center text-text-secondary mb-8">
            {isCreating
              ? 'Start a new room for your friends'
              : 'Enter the room code to join'}
          </p>

          {/* Toggle */}
          <div className="flex bg-bg-surface rounded-xl p-1 mb-6">
            <button
              onClick={() => setIsCreating(true)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                isCreating
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Create
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                !isCreating
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Join
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Room Code (join only) */}
            {!isCreating && (
              <div>
                <label
                  htmlFor="roomCode"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  Room Code
                </label>
                <input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full h-14 px-4 bg-bg-surface border border-bg-surface rounded-xl text-text-primary text-center text-2xl font-mono tracking-widest placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent-neutral"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Room Password {isCreating && <span className="text-text-disabled">(optional)</span>}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isCreating ? 'Set a password' : 'Enter password'}
                className="w-full h-12 px-4 bg-bg-surface border border-bg-surface rounded-xl text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent-neutral"
              />
            </div>

            {/* Nickname */}
            <div>
              <label
                htmlFor="nickname"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Your Nickname
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="w-full h-12 px-4 bg-bg-surface border border-bg-surface rounded-xl text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent-neutral"
              />
            </div>

            {/* Error message */}
            {error && (
              <motion.p
                className="text-accent-mafia text-sm text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {error}
              </motion.p>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              variant={isCreating ? 'primary' : 'danger'}
              size="lg"
              fullWidth
              glow={!isCreating}
              disabled={isLoading || !isConnected}
              className="mt-6"
            >
              {isLoading ? 'Loading...' : isCreating ? 'Create Room' : 'Join Room'}
            </Button>
          </form>

          {/* Info text */}
          <p className="text-center text-sm text-text-disabled mt-6">
            {isCreating
              ? "You'll get a code to share with friends"
              : 'Ask the host for the room code'}
          </p>
        </motion.div>
      </main>
    </div>
  )
}
