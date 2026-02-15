import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useWebSocket } from './WebSocketContext'
import { useGameStore } from '../stores/gameStore'

// Voice message payload types
interface VoiceAnswerPayload {
  sdp: string
}

interface VoiceCandidatePayload {
  candidate: string
  sdp_mid: string
  sdp_mline_index: number
  username_fragment?: string
}

// Voice routing state
interface VoiceRoutingPlayer {
  playerId: string
  canSpeak: boolean
  canHear: string[]
}

interface VoiceRouting {
  phase: string
  players: VoiceRoutingPlayer[]
}

interface VoiceContextValue {
  // State
  isVoiceEnabled: boolean
  isConnecting: boolean
  isConnected: boolean
  isMuted: boolean
  canSpeak: boolean

  // Actions
  joinVoice: () => void
  leaveVoice: () => void
  toggleMute: () => void
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { send, subscribe, connectionState } = useWebSocket()
  const { playerId, roomCode, updatePlayerSpeaking } = useGameStore()

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [canSpeak, setCanSpeak] = useState(true)
  // Store routing for potential future use (e.g., visual indicators)
  const [, setVoiceRouting] = useState<VoiceRouting | null>(null)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([])
  const audioAnalyserRef = useRef<AnalyserNode | null>(null)
  const speakingDetectionRef = useRef<number | null>(null)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (speakingDetectionRef.current) {
      cancelAnimationFrame(speakingDetectionRef.current)
      speakingDetectionRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    audioAnalyserRef.current = null
    iceCandidatesQueue.current = []
    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  // Set up speaking detection
  const setupSpeakingDetection = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    audioAnalyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    let wasSpeaking = false
    const THRESHOLD = 30

    const detectSpeaking = () => {
      if (!audioAnalyserRef.current || isMuted) {
        speakingDetectionRef.current = requestAnimationFrame(detectSpeaking)
        return
      }

      analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      const isSpeaking = average > THRESHOLD && canSpeak && !isMuted

      if (isSpeaking !== wasSpeaking) {
        wasSpeaking = isSpeaking
        // Send speaking state to server
        send('speaking_state', { speaking: isSpeaking })
        // Update local store
        if (playerId) {
          updatePlayerSpeaking(playerId, isSpeaking)
        }
      }

      speakingDetectionRef.current = requestAnimationFrame(detectSpeaking)
    }

    detectSpeaking()
  }, [send, playerId, updatePlayerSpeaking, isMuted, canSpeak])

  // Join voice chat
  const joinVoice = useCallback(async () => {
    if (!roomCode || isConnecting || isConnected) return

    setIsConnecting(true)

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      localStreamRef.current = stream

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      })
      peerConnectionRef.current = pc

      // Add local audio track
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send('voice_candidate', {
            candidate: event.candidate.candidate,
            sdp_mid: event.candidate.sdpMid,
            sdp_mline_index: event.candidate.sdpMLineIndex,
            username_fragment: event.candidate.usernameFragment,
          })
        }
      }

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case 'connected':
            setIsConnected(true)
            setIsConnecting(false)
            break
          case 'disconnected':
          case 'failed':
          case 'closed':
            setIsConnected(false)
            break
        }
      }

      // Handle incoming tracks (from other participants)
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0]
        if (remoteStream) {
          // Create audio element to play remote audio
          const audio = new Audio()
          audio.srcObject = remoteStream
          audio.autoplay = true
          audio.play().catch(console.error)
        }
      }

      // Send join request
      send('voice_join', {})

      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send('voice_offer', { sdp: offer.sdp })

      // Set up speaking detection
      setupSpeakingDetection(stream)

      setIsVoiceEnabled(true)
    } catch (error) {
      console.error('Failed to join voice:', error)
      cleanup()
    }
  }, [roomCode, isConnecting, isConnected, send, cleanup, setupSpeakingDetection])

  // Leave voice chat
  const leaveVoice = useCallback(() => {
    send('voice_leave', {})
    cleanup()
    setIsVoiceEnabled(false)
  }, [send, cleanup])

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = isMuted // Toggle (if was muted, unmute)
        setIsMuted(!isMuted)
        // Update speaking state when muting
        if (!isMuted && playerId) {
          send('speaking_state', { speaking: false })
          updatePlayerSpeaking(playerId, false)
        }
      }
    }
  }, [isMuted, playerId, send, updatePlayerSpeaking])

  // Subscribe to voice-related WebSocket messages
  useEffect(() => {
    const unsubscribers: (() => void)[] = []

    // Handle voice answer (SDP response from server)
    unsubscribers.push(subscribe('voice_answer', (payload) => {
      const pc = peerConnectionRef.current
      const { sdp } = payload as VoiceAnswerPayload
      if (pc && sdp) {
        pc.setRemoteDescription({ type: 'answer', sdp }).then(() => {
          // Add queued ICE candidates
          iceCandidatesQueue.current.forEach(candidate => {
            pc.addIceCandidate(candidate).catch(console.error)
          })
          iceCandidatesQueue.current = []
        }).catch(console.error)
      }
    }))

    // Handle ICE candidates from server
    unsubscribers.push(subscribe('voice_candidate', (payload) => {
      const pc = peerConnectionRef.current
      const data = payload as VoiceCandidatePayload
      if (pc && data) {
        const candidate: RTCIceCandidateInit = {
          candidate: data.candidate,
          sdpMid: data.sdp_mid,
          sdpMLineIndex: data.sdp_mline_index,
          usernameFragment: data.username_fragment,
        }

        if (pc.remoteDescription) {
          pc.addIceCandidate(candidate).catch(console.error)
        } else {
          iceCandidatesQueue.current.push(candidate)
        }
      }
    }))

    // Handle voice routing changes (game phase changes)
    unsubscribers.push(subscribe('voice_routing', (payload) => {
      const routing = payload as VoiceRouting
      setVoiceRouting(routing)

      // Update canSpeak based on routing
      const myRouting = routing.players.find(p => p.playerId === playerId)
      if (myRouting) {
        setCanSpeak(myRouting.canSpeak)
        // If can't speak, auto-mute
        if (!myRouting.canSpeak && localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0]
          if (audioTrack) {
            audioTrack.enabled = false
          }
        }
      }
    }))

    // Handle voice joined/left for logging
    unsubscribers.push(subscribe('voice_joined', (payload) => {
      const { player_id } = payload as { player_id: string }
      console.log('Player joined voice:', player_id)
    }))

    unsubscribers.push(subscribe('voice_left', (payload) => {
      const { player_id } = payload as { player_id: string }
      console.log('Player left voice:', player_id)
    }))

    return () => {
      unsubscribers.forEach(unsub => unsub())
      cleanup()
    }
  }, [subscribe, playerId, cleanup])

  // Cleanup on disconnect
  useEffect(() => {
    if (connectionState === 'disconnected') {
      cleanup()
      setIsVoiceEnabled(false)
    }
  }, [connectionState, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const value: VoiceContextValue = {
    isVoiceEnabled,
    isConnecting,
    isConnected,
    isMuted,
    canSpeak,
    joinVoice,
    leaveVoice,
    toggleMute,
  }

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider')
  }
  return context
}
