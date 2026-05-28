export type UserRole = "user" | "admin";
export type RoomStatus = "waiting" | "playing" | "finished";
export type RoomMode = "solo" | "duel" | "turn-based";
export type CellMark = "flag" | "question" | null;
export type CellStatus = "hidden" | "revealed";
export type GameResult = "playing" | "won" | "lost";

export interface UserProfile {
  uid: string;
  username: string;
  role: UserRole;
  stats: { totalWins: number; totalLosses: number };
  achievements: string[];
  friends: string[];
  createdAt: number;
}

export interface GridConfig {
  width: number;
  height: number;
  mines: number;
}

export const GRID_PRESETS: Record<string, GridConfig> = {
  beginner: { width: 9, height: 9, mines: 10 },
  intermediate: { width: 16, height: 16, mines: 40 },
  expert: { width: 30, height: 16, mines: 99 },
};

export interface RoomPlayer {
  uid: string;
  username: string;
  score: number;
  revealedCount: number;
  result: GameResult;
}

export interface Room {
  roomId: string;
  mode: RoomMode;
  status: RoomStatus;
  gridConfig: GridConfig;
  seed: number;
  players: Record<string, RoomPlayer>;
  turn: string;
  createdBy: string;
  createdAt: number;
  maxPlayers: number;
  winner: string | null;
}

export interface GameMove {
  playerId: string;
  cellId: string;
  action: "reveal" | "flag" | "question";
  timestamp: number;
}

export interface LiveCursor {
  x: number;
  y: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export interface LiveRoom {
  cursors: Record<string, LiveCursor>;
  chat: Record<string, Omit<ChatMessage, "id">>;
}

export interface Cell {
  id: string;
  x: number;
  y: number;
  hasMine: boolean;
  adjacentMines: number;
  status: CellStatus;
  mark: CellMark;
}

export interface GameState {
  cells: Cell[];
  config: GridConfig;
  firstClickDone: boolean;
  result: GameResult;
  explodedCellId?: string;
}
