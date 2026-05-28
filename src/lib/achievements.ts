import type { GameState, GridConfig, UserProfile, AchievementDef, ACHIEVEMENTS as _A } from "@/types";
import { ACHIEVEMENTS, GRID_PRESETS } from "@/types";

/**
 * Vérifie et retourne les nouveaux succès débloqués après une partie.
 */
export function checkAchievements(
  profile: UserProfile,
  gameState: GameState,
  timer: number,
  mode: string,
): string[] {
  const already = new Set(profile.achievements);
  const newAchievements: string[] = [];

  const unlock = (id: string) => {
    if (!already.has(id)) newAchievements.push(id);
  };

  const won = gameState.result === "won";
  const { config } = gameState;

  // ── Succès "Louis" — clic sur case déjà révélée (tracké pendant la partie)
  if (gameState.clickedRevealed) {
    unlock("click_revealed");
  }

  // Si pas gagné, on ne check que les succès non-victoire
  if (!won) return newAchievements;

  // ── Victoire par difficulté ──
  const matchesPreset = (key: string): boolean => {
    const preset = GRID_PRESETS[key];
    return preset.width === config.width && preset.height === config.height && preset.mines === config.mines;
  };

  const isDefaultMap = matchesPreset("beginner") || matchesPreset("intermediate") || matchesPreset("expert");

  if (matchesPreset("beginner")) unlock("win_beginner");
  if (matchesPreset("intermediate")) unlock("win_intermediate");
  if (matchesPreset("expert")) unlock("win_expert");

  // Custom hard : grille 25×25+ avec 100+ mines
  if (config.width >= 25 && config.height >= 25 && config.mines >= 100) {
    unlock("win_custom_hard");
  }

  // ── Seuls les maps par défaut débloquent les autres succès (Puriste, Speed, Séries) ──
  if (isDefaultMap) {
    // ── Puriste — gagner sans drapeau ──
    if (!gameState.flagsUsed) {
      unlock("no_flag");
    }

    // ── Speed ──
    if (timer <= 30) unlock("speed_30");
    if (timer <= 10) unlock("speed_10");

    // ── Win streaks (le streak est déjà incrémenté dans le profile) ──
    const newStreak = (profile.stats.winStreak || 0) + 1; // +1 car pas encore persisté
    if (newStreak >= 3) unlock("win_streak_3");
    if (newStreak >= 10) unlock("win_streak_10");
  }

  // Temps de jeu
  const playTime = (profile.stats.playTime || 0) + timer;
  if (playTime >= 3600) unlock("playtime_1h");
  if (playTime >= 36000) unlock("playtime_10h");
  if (playTime >= 360000) unlock("playtime_100h");

  // ── Social ──
  if (mode === "duel") unlock("first_duel_win");

  return newAchievements;
}

/**
 * Récupère les détails d'un succès par son ID.
 */
export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
