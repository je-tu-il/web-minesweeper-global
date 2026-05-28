import { create } from "zustand";
import type { GameState, GridConfig, RoomMode } from "@/types";
import { createEmptyGame, revealCell, cycleMark, generateDuelBoard } from "@/lib/gameEngine";

interface GameStore {
  game: GameState;
  mode: RoomMode;
  isTrap: boolean;
  timer: number;
  isTimerRunning: boolean;

  initSoloGame: (config: GridConfig, isTrap?: boolean) => void;
  initDuelGame: (config: GridConfig, seed: number, isTrap?: boolean) => void;
  initTurnBasedGame: (config: GridConfig, isTrap?: boolean) => void;
  handleReveal: (cellId: string) => GameState;
  handleFlag: (cellId: string) => GameState;
  setGame: (game: GameState) => void;
  resetGame: () => void;
  tickTimer: () => void;
  stopTimer: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: createEmptyGame({ width: 9, height: 9, mines: 10 }),
  mode: "solo",
  isTrap: false,
  timer: 0,
  isTimerRunning: false,

  initSoloGame: (config, isTrap = false) => {
    set({
      game: createEmptyGame(config),
      mode: "solo",
      isTrap,
      timer: 0,
      isTimerRunning: true,
    });
  },

  initDuelGame: (config, seed, isTrap = false) => {
    set({
      game: generateDuelBoard(config, seed),
      mode: "duel",
      isTrap,
      timer: 0,
      isTimerRunning: true,
    });
  },

  initTurnBasedGame: (config, isTrap = false) => {
    set({
      game: createEmptyGame(config),
      mode: "turn-based",
      isTrap,
      timer: 0,
      isTimerRunning: true,
    });
  },

  handleReveal: (cellId) => {
    const { game, isTrap } = get();
    const newGame = revealCell(game, cellId, isTrap);
    if (newGame.result !== "playing") {
      set({ game: newGame, isTimerRunning: false });
    } else {
      set({ game: newGame });
    }
    return newGame;
  },

  handleFlag: (cellId) => {
    const { game } = get();
    const newGame = cycleMark(game, cellId);
    set({ game: newGame });
    return newGame;
  },

  setGame: (game) => {
    set({ game });
    if (game.result !== "playing") {
      set({ isTimerRunning: false });
    }
  },

  resetGame: () => {
    const { game } = get();
    set({
      game: createEmptyGame(game.config),
      timer: 0,
      isTimerRunning: false,
      isTrap: false,
    });
  },

  tickTimer: () => set((s) => (s.isTimerRunning ? { timer: s.timer + 1 } : s)),

  stopTimer: () => set({ isTimerRunning: false }),
}));
