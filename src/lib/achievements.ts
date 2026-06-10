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

  // ── Malchanceux (Perdre 2 parties de suite) ──
  if (!won) {
    const history = profile.history || [];
    const lastGame = history.length > 0 ? history[0] : null; // Because history is unshifted (newest first)
    if (lastGame && lastGame.result === "lost") {
      unlock("boom_chain");
    }

    // ── Kamikaze (Perdre en moins de 3s) ──
    if (timer <= 3) {
      unlock("kamikaze");
    }
  }

  // Si pas gagné, on ne check que les succès non-victoire
  if (!won) return newAchievements;

  // ── Victoire par difficulté ──
  const matchesPreset = (key: string): boolean => {
    const preset = GRID_PRESETS[key];
    return preset.width === config.width && preset.height === config.height && preset.mines === config.mines;
  };

  const isDefaultMap = matchesPreset("beginner") || matchesPreset("intermediate") || matchesPreset("expert");

  if (mode === "solo") {
    if (matchesPreset("beginner")) unlock("win_beginner");
    if (matchesPreset("intermediate")) unlock("win_intermediate");
    if (matchesPreset("expert")) unlock("win_expert");

    // Custom hard : grille 25×25+ avec 100+ mines
    if (config.width >= 25 && config.height >= 25 && config.mines >= 100) {
      unlock("win_custom_hard");
    }
  }

  // ── Seuls les maps par défaut en mode SOLO débloquent les autres succès (Puriste, Speed, Séries) ──
  if (isDefaultMap && mode === "solo") {
    // ── Puriste — gagner sans drapeau ──
    if (!gameState.flagsUsed) {
      unlock("no_flag");
      if (matchesPreset("beginner")) unlock("no_flag_beginner");
      if (matchesPreset("intermediate")) unlock("no_flag_intermediate");
      if (matchesPreset("expert")) unlock("no_flag_expert");
    }

    // ── Speed ──
    if (timer <= 30) unlock("speed_30");
    if (timer <= 10) unlock("speed_10");
    if (matchesPreset("beginner") && timer <= 15) unlock("speed_beginner");
    if (matchesPreset("intermediate") && timer <= 60) unlock("speed_intermediate");
    if (matchesPreset("expert") && timer <= 120) unlock("speed_expert");

    // ── Win streaks (le streak est déjà incrémenté dans le profile) ──
    const newStreak = (profile.stats.winStreak || 0) + 1; // +1 car pas encore persisté
    if (newStreak >= 3) unlock("win_streak_3");
    if (newStreak >= 5) unlock("win_streak_5");
    if (newStreak >= 10) unlock("win_streak_10");
  }

  // ── Sweep ──
  if (mode === "solo") {
    const revealedCount = gameState.cells.filter(c => c.status === "revealed" && !c.hasMine).length;
    if (revealedCount >= 50) unlock("sweep");

    // ── Total Wins (Marathon & Centurion) ──
    const totalWins = (profile.stats.totalWins || 0) + 1;
    if (totalWins >= 50) unlock("win_total_50");
    if (totalWins >= 100) unlock("win_total_100");
  }

  // ── Date/Time based (Démineur du Dimanche, Insomniaque) ──
  const now = new Date();
  if (now.getDay() === 0) { // 0 = Dimanche
    unlock("sunday_player");
  }
  const hours = now.getHours();
  if (hours >= 2 && hours < 5) { // Entre 2h et 5h du matin
    unlock("insomniac");
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
