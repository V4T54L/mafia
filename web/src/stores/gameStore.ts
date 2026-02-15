import { create } from 'zustand'

// Types
export type Role = 'villager' | 'mafia' | 'godfather' | 'doctor' | 'detective'
export type Team = 'town' | 'mafia'
export type GamePhase = 'lobby' | 'role_reveal' | 'night' | 'night_result' | 'day' | 'day_result' | 'game_over'
export type PlayerStatus = 'alive' | 'dead'

export interface Player {
  id: string
  nickname: string
  isHost: boolean
  isReady: boolean
  status: PlayerStatus
  role?: Role
  isSpeaking?: boolean
}

export interface GameSettings {
  villagers: number
  mafia: number
  godfather: number
  doctor: number
  detective: number
  nightTimer: number
}

export interface GameState {
  // Connection
  roomCode: string | null
  playerId: string | null
  isConnected: boolean

  // Room state
  players: Player[]
  settings: GameSettings
  isHost: boolean

  // Game state
  phase: GamePhase
  myRole: Role | null
  phaseTimer: number | null
  nightTarget: string | null
  dayVote: string | null
  winner: Team | null

  // Actions
  setRoomCode: (code: string) => void
  setPlayerId: (id: string) => void
  setPlayers: (players: Player[]) => void
  setSettings: (settings: GameSettings) => void
  setPhase: (phase: GamePhase) => void
  setMyRole: (role: Role) => void
  setPhaseTimer: (timer: number | null) => void
  setNightTarget: (targetId: string | null) => void
  setDayVote: (targetId: string | null) => void
  setWinner: (winner: Team | null) => void
  toggleReady: () => void
  reset: () => void
}

const defaultSettings: GameSettings = {
  villagers: 3,
  mafia: 2,
  godfather: 0,
  doctor: 1,
  detective: 1,
  nightTimer: 60,
}

// Mock players for UI development
export const mockPlayers: Player[] = [
  { id: '1', nickname: 'Alice', isHost: true, isReady: true, status: 'alive', isSpeaking: false },
  { id: '2', nickname: 'Bob', isHost: false, isReady: true, status: 'alive', isSpeaking: true },
  { id: '3', nickname: 'Charlie', isHost: false, isReady: false, status: 'alive', isSpeaking: false },
  { id: '4', nickname: 'Diana', isHost: false, isReady: true, status: 'alive', isSpeaking: false },
  { id: '5', nickname: 'Eve', isHost: false, isReady: true, status: 'dead', isSpeaking: false },
  { id: '6', nickname: 'Frank', isHost: false, isReady: false, status: 'alive', isSpeaking: false },
]

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  roomCode: null,
  playerId: null,
  isConnected: false,
  players: [],
  settings: defaultSettings,
  isHost: false,
  phase: 'lobby',
  myRole: null,
  phaseTimer: null,
  nightTarget: null,
  dayVote: null,
  winner: null,

  // Actions
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayerId: (id) => set({ playerId: id }),
  setPlayers: (players) => set({ players }),
  setSettings: (settings) => set({ settings }),
  setPhase: (phase) => set({ phase }),
  setMyRole: (role) => set({ myRole: role }),
  setPhaseTimer: (timer) => set({ phaseTimer: timer }),
  setNightTarget: (targetId) => set({ nightTarget: targetId }),
  setDayVote: (targetId) => set({ dayVote: targetId }),
  setWinner: (winner) => set({ winner }),
  toggleReady: () => {
    const { players, playerId } = get()
    set({
      players: players.map((p) =>
        p.id === playerId ? { ...p, isReady: !p.isReady } : p
      ),
    })
  },
  reset: () =>
    set({
      roomCode: null,
      playerId: null,
      isConnected: false,
      players: [],
      settings: defaultSettings,
      isHost: false,
      phase: 'lobby',
      myRole: null,
      phaseTimer: null,
      nightTarget: null,
      dayVote: null,
      winner: null,
    }),
}))
