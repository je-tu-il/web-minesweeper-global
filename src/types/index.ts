export type UserRole = "user" | "admin";
export type RoomStatus = "waiting" | "playing" | "finished";
export type RoomMode = "solo" | "duel" | "turn-based" | "coop";
export type CellMark = "flag" | "question" | null;
export type CellStatus = "hidden" | "revealed";
export type GameResult = "playing" | "won" | "lost";
export type AchievementTier = "bronze" | "silver" | "gold" | "diamond";

/* ── Achievements ── */

export interface AchievementDef {
  id: string;
  name: string;
  description: string; // The visible description
  tier: AchievementTier;
  icon: string;
  isHidden?: boolean; // If true, description is hidden until unlocked
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Victoire par difficulté
  { id: "win_beginner", name: "Désamorceur", description: "Gagner en Débutant", tier: "bronze", icon: "🥉" },
  { id: "win_intermediate", name: "Artificier", description: "Gagner en Intermédiaire", tier: "silver", icon: "🥈" },
  { id: "win_expert", name: "Maître Démineur", description: "Gagner en Expert", tier: "gold", icon: "🥇" },
  { id: "win_custom_hard", name: "Légende", description: "Gagner 25×25+ avec 100+ mines", tier: "diamond", icon: "💎" },
  // Spéciaux - Puriste
  { id: "no_flag", name: "Puriste", description: "Gagner sans poser un seul drapeau", tier: "gold", icon: "🏴" },
  { id: "no_flag_beginner", name: "Puriste Débutant", description: "Gagner sans poser de drapeau (Débutant)", tier: "bronze", icon: "🏴" },
  { id: "no_flag_intermediate", name: "Puriste Intermédiaire", description: "Gagner sans poser de drapeau (Intermédiaire)", tier: "silver", icon: "🏴" },
  { id: "no_flag_expert", name: "Puriste Expert", description: "Gagner sans poser de drapeau (Expert)", tier: "gold", icon: "🏴" },
  // Clic Louis
  { id: "click_revealed", name: "Succès Louis", description: "Cliquer sur une case déjà révélée", tier: "bronze", icon: "🤡" },
  // Speed
  { id: "speed_30", name: "Speedrunner", description: "Gagner en moins de 30s", tier: "silver", icon: "⚡" },
  { id: "speed_10", name: "Flash", description: "Gagner en moins de 10s", tier: "gold", icon: "🔥" },
  { id: "speed_beginner", name: "Speed Débutant", description: "Gagner en Débutant en moins de 15s", tier: "bronze", icon: "⚡" },
  { id: "speed_intermediate", name: "Speed Intermédiaire", description: "Gagner en Intermédiaire en moins de 60s", tier: "silver", icon: "🔥" },
  { id: "speed_expert", name: "Speed Expert", description: "Gagner en Expert en moins de 120s", tier: "gold", icon: "☄️" },
  // Streaks
  { id: "win_streak_3", name: "Série", description: "3 victoires d'affilée", tier: "bronze", icon: "🔥" },
  { id: "win_streak_5", name: "Invaincu", description: "5 victoires d'affilée", tier: "silver", icon: "🎖️" },
  { id: "win_streak_10", name: "Inarrêtable", description: "10 victoires d'affilée", tier: "gold", icon: "💪" },
  // Total Wins
  { id: "win_total_50", name: "Marathon", description: "Atteindre 50 victoires au total", tier: "silver", icon: "🏃" },
  { id: "win_total_100", name: "Centurion", description: "Atteindre 100 victoires au total", tier: "gold", icon: "💯" },
  // Social
  { id: "first_duel_win", name: "Rival", description: "Gagner un duel", tier: "silver", icon: "⚔️" },
  { id: "first_spectate", name: "Voyeur", description: "Observer une partie", tier: "bronze", icon: "👀" },
  // Temps de jeu & Fun
  { id: "playtime_1h", name: "Accro", description: "Jouer pendant 1 heure au total", tier: "bronze", icon: "⏰" },
  { id: "playtime_10h", name: "No-Life", description: "Jouer pendant 10 heures au total", tier: "gold", icon: "🕰️" },
  { id: "playtime_100h", name: "Vétéran", description: "Jouer pendant 100 heures au total", tier: "diamond", icon: "⏳" },
  // Fun & Tryhard
  { id: "boom_chain", name: "Malchanceux", description: "Perdre 2 parties de suite", tier: "bronze", icon: "🌧️" },
  { id: "sweep", name: "Balayage", description: "Dévoiler plus de 50 cases", tier: "silver", icon: "🧹" },
  { id: "sunday_player", name: "Démineur du Dimanche", description: "Jouer une partie un dimanche", tier: "bronze", icon: "📅" },
  { id: "insomniac", name: "Insomniaque", description: "Jouer une partie entre 2h et 5h du matin", tier: "silver", icon: "🦉" },
  { id: "kamikaze", name: "Kamikaze", description: "Perdre une partie en moins de 3 secondes", tier: "bronze", icon: "💥" },
  // Mystères
  { id: "mystere_egirl", name: "E-Girl", description: "Dire uwu dans le chat global", tier: "silver", icon: "🌸", isHidden: true },
  { id: "mystere_boom_first_click", name: "Pas de chance", description: "Perdre sur le tout premier clic (impossible normalement)", tier: "bronze", icon: "💣", isHidden: true },
  { id: "mystere_1", name: "Curieux", description: "Cliquer sur 5 profils différents", tier: "bronze", icon: "🔍", isHidden: true },
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
  email?: string;
  avatarUrl?: string;
  role: UserRole;
  stats: {
    totalWins: number;
    totalLosses: number;
    winStreak: number;
    bestWinStreak: number;
    playTime?: number; // Temps de jeu total en secondes
  };
  achievements: string[]; // IDs des succès débloqués
  friends: string[]; // UIDs des gens suivis
  following: string[]; // UIDs des gens qu'on suit
  history?: GameHistoryEntry[]; // Historique des parties
  maxActiveRooms?: number; // Limite de parties en cours (surcharge globale)
  isBanned?: boolean; // Vrai si le joueur est banni
  lowPerformance?: boolean; // Mode basse performance (désactive animations lourdes)
  createdAt: number;
}

export interface GameHistoryEntry {
  id: string;
  mode: RoomMode;
  difficulty: string; // ex: "beginner", "custom"
  result: GameResult; // "won" | "lost"
  time: number; // secondes
  date: number; // timestamp
  seed?: number;
  firstClick?: { x: number, y: number };
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
  duelMode?: "shared" | "separate";
  rematchProposal?: string; // UID du joueur qui propose
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
  seed?: number;
  flagsUsed: boolean; // tracking pour succès "Puriste"
  clickedRevealed: boolean; // tracking pour clic sur révélé
}
