export type UserRole = "user" | "admin";
export type RoomStatus = "waiting" | "playing" | "finished";
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
}

export interface GridConfig {
  width: number;
  height: number;
  mines: number;
}

export interface RoomPlayer {
  username: string;
  score: number;
}

export interface Room {
  roomId: string;
  mode: "solo" | "turn-based" | "duel";
  status: RoomStatus;
  isTrap: boolean;
  gridConfig: GridConfig;
  players: Record<string, RoomPlayer>;
  turn: string;
}

export interface LiveCursor { x: number; y: number }
export interface ChatMessage { id: string; sender: string; text: string; timestamp: number }
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
