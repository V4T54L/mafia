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

export interface Teammate {
  id: string
  nickname: string
  role: Role
}

export interface NightResult {
  killedId: string | null
  killedNickname: string | null
  wasSaved: boolean
  investigation?: {
    targetId: string
    targetNickname: string
    isMafia: boolean
  }
}

export interface DayResult {
  eliminatedId: string | null
  eliminatedNickname: string | null
  eliminatedRole: Role | null
  voteCounts: Record<string, number>
  noMajority: boolean
}

export interface GhostMessage {
  fromId: string
  fromNickname: string
  message: string
  timestamp: number
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
  round: number
  myRole: Role | null
  myTeam: Team | null
  teammates: Teammate[]
  phaseTimer: number | null
  nightTarget: string | null
  dayVote: string | null
  voteCounts: Record<string, number>
  nightResult: NightResult | null
  dayResult: DayResult | null
  winner: Team | null
  ghostMessages: GhostMessage[]

  // Actions
  setRoomCode: (code: string | null) => void
  setPlayerId: (id: string) => void
  setConnected: (connected: boolean) => void
  setPlayers: (players: Player[]) => void
  setSettings: (settings: GameSettings) => void
  setIsHost: (isHost: boolean) => void
  addPlayer: (player: Player) => void
  removePlayer: (playerId: string, newHostId?: string) => void
  updatePlayerReady: (playerId: string, ready: boolean) => void
  updatePlayerStatus: (playerId: string, status: PlayerStatus) => void
  updatePlayerRole: (playerId: string, role: Role) => void
  updatePlayerSpeaking: (playerId: string, speaking: boolean) => void
  setPhase: (phase: GamePhase) => void
  setRound: (round: number) => void
  setMyRole: (role: Role, team: Team, teammates?: Teammate[]) => void
  setPhaseTimer: (timer: number | null) => void
  setNightTarget: (targetId: string | null) => void
  setDayVote: (targetId: string | null) => void
  setVoteCounts: (counts: Record<string, number>) => void
  setNightResult: (result: NightResult | null) => void
  setDayResult: (result: DayResult | null) => void
  setWinner: (winner: Team | null) => void
  addGhostMessage: (message: GhostMessage) => void
  clearGhostMessages: () => void
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
  round: 0,
  myRole: null,
  myTeam: null,
  teammates: [],
  phaseTimer: null,
  nightTarget: null,
  dayVote: null,
  voteCounts: {},
  nightResult: null,
  dayResult: null,
  winner: null,
  ghostMessages: [],

  // Actions
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayerId: (id) => set({ playerId: id }),
  setConnected: (connected) => set({ isConnected: connected }),
  setPlayers: (players) => set({ players }),
  setSettings: (settings) => set({ settings }),
  setIsHost: (isHost) => set({ isHost }),
  addPlayer: (player) => set((state) => ({ players: [...state.players, player] })),
  removePlayer: (playerId, newHostId) =>
    set((state) => ({
      players: state.players
        .filter((p) => p.id !== playerId)
        .map((p) => (newHostId && p.id === newHostId ? { ...p, isHost: true } : p)),
      // If current player becomes host
      isHost: newHostId === state.playerId ? true : state.isHost,
    })),
  updatePlayerReady: (playerId, ready) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, isReady: ready } : p)),
    })),
  updatePlayerStatus: (playerId, status) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, status } : p)),
    })),
  updatePlayerRole: (playerId, role) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, role } : p)),
    })),
  updatePlayerSpeaking: (playerId, speaking) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, isSpeaking: speaking } : p)),
    })),
  setPhase: (phase) => set({ phase, nightTarget: null, dayVote: null }),
  setRound: (round) => set({ round }),
  setMyRole: (role, team, teammates) => set({ myRole: role, myTeam: team, teammates: teammates || [] }),
  setPhaseTimer: (timer) => set({ phaseTimer: timer }),
  setNightTarget: (targetId) => set({ nightTarget: targetId }),
  setDayVote: (targetId) => set({ dayVote: targetId }),
  setVoteCounts: (counts) => set({ voteCounts: counts }),
  setNightResult: (result) => set({ nightResult: result }),
  setDayResult: (result) => set({ dayResult: result }),
  setWinner: (winner) => set({ winner }),
  addGhostMessage: (message) =>
    set((state) => ({
      ghostMessages: [...state.ghostMessages, message].slice(-50), // Keep last 50 messages
    })),
  clearGhostMessages: () => set({ ghostMessages: [] }),
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
      round: 0,
      myRole: null,
      myTeam: null,
      teammates: [],
      phaseTimer: null,
      nightTarget: null,
      dayVote: null,
      voteCounts: {},
      nightResult: null,
      dayResult: null,
      winner: null,
      ghostMessages: [],
    }),
}))
