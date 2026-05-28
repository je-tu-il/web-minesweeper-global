export type UserRole = "user" | "admin";
export type RoomStatus = "waiting" | "playing" | "finished";
export type RoomMode = "solo" | "duel" | "turn-based";
export type CellMark = "flag" | "question" | null;
export type CellStatus = "hidden" | "revealed";
export type GameResult = "playing" | "won" | "lost";
export type AchievementTier = "bronze" | "silver" | "gold" | "diamond";

/* ── Achievements ── */

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Victoire par difficulté
  { id: "win_beginner", name: "Désamorceur", description: "Gagner en Débutant", tier: "bronze", icon: "🥉" },
  { id: "win_intermediate", name: "Artificier", description: "Gagner en Intermédiaire", tier: "silver", icon: "🥈" },
  { id: "win_expert", name: "Maître Démineur", description: "Gagner en Expert", tier: "gold", icon: "🥇" },
  { id: "win_custom_hard", name: "Légende", description: "Gagner 25×25+ avec 100+ mines", tier: "diamond", icon: "💎" },
  // Spéciaux
  { id: "no_flag", name: "Puriste", description: "Gagner sans poser un seul drapeau", tier: "gold", icon: "🏴" },
  { id: "click_revealed", name: "Succès Louis", description: "Cliquer sur une case déjà révélée", tier: "bronze", icon: "🤡" },
  // Speed
  { id: "speed_30", name: "Speedrunner", description: "Gagner en moins de 30s", tier: "silver", icon: "⚡" },
  { id: "speed_10", name: "Flash", description: "Gagner en moins de 10s", tier: "gold", icon: "🔥" },
  // Streaks
  { id: "win_streak_3", name: "Série", description: "3 victoires d'affilée", tier: "bronze", icon: "🔥" },
  { id: "win_streak_10", name: "Inarrêtable", description: "10 victoires d'affilée", tier: "gold", icon: "💪" },
  // Social
  { id: "first_duel_win", name: "Rival", description: "Gagner un duel", tier: "silver", icon: "⚔️" },
  { id: "first_spectate", name: "Voyeur", description: "Observer une partie", tier: "bronze", icon: "👀" },
];

export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  diamond: "#b9f2ff",
};

/* ── User ── */

export interface UserProfile {
  uid: string;
  username: string;
  avatarUrl?: string;
  role: UserRole;
  stats: {
    totalWins: number;
    totalLosses: number;
    winStreak: number;
    bestWinStreak: number;
  };
  achievements: string[]; // IDs des succès débloqués
  friends: string[]; // UIDs des gens suivis
  following: string[]; // UIDs des gens qu'on suit
  history?: GameHistoryEntry[]; // Historique des parties
  createdAt: number;
}

export interface GameHistoryEntry {
  id: string;
  mode: RoomMode;
  difficulty: string; // ex: "beginner", "custom"
  result: GameResult; // "won" | "lost"
  time: number; // secondes
  date: number; // timestamp
}

/* ── Grid ── */

export interface GridConfig {
  width: number;
  height: number;
  mines: number;
  pureLogic?: boolean;
}

export const GRID_PRESETS: Record<string, GridConfig & { label: string }> = {
  tiny: { width: 6, height: 6, mines: 5, label: "Mini" },
  beginner: { width: 9, height: 9, mines: 10, label: "Débutant" },
  intermediate: { width: 16, height: 16, mines: 40, label: "Intermédiaire" },
  expert: { width: 30, height: 16, mines: 99, label: "Expert" },
};

/* ── Room ── */

export interface RoomPlayer {
  uid: string;
  username: string;
  score: number;
  revealedCount: number;
  result: GameResult;
  revealedCells?: string[];
  flaggedCells?: string[];
  questionCells?: string[];
  explodedCellId?: string;
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
  firstClick?: { x: number, y: number };
}

/* ── Leaderboard ── */

export interface LeaderboardEntry {
  id?: string;
  uid: string;
  username: string;
  time: number; // en secondes
  difficulty: string; // clé de GRID_PRESETS ou "custom"
  gridConfig: GridConfig;
  date: number;
}

/* ── Game ── */

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
  flagsUsed: boolean; // tracking pour succès "Puriste"
  clickedRevealed: boolean; // tracking pour succès "Louis"
}
