import { create } from "zustand";
import type { GameState, GridConfig, RoomMode } from "@/types";
import { createEmptyGame, revealCell, cycleMark, generateDuelBoard, generateSafeBoardSeeded } from "@/lib/gameEngine";

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
  /** Restaure le state depuis Firestore (reprendre / spectate) */
  restoreFromSync: (
    config: GridConfig,
    seed: number,
    mode: RoomMode,
    flaggedCells: string[],
    questionCells: string[],
    explodedCellId?: string,
    firstClick?: { x: number, y: number },
  ) => void;
  mergeOpponentState: (revealedIds: string[], flaggedIds: string[], questionIds: string[], explodedId?: string) => void;
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

  restoreFromSync: (config, seed, mode, revealedCells, flaggedCells, questionCells, explodedCellId, firstClick) => {
    // Recréer le board avec le seed (identique pour tous les joueurs)
    let base = createEmptyGame(config);
    if (mode === "duel") {
      base = generateDuelBoard(config, seed);
    } else if (firstClick) {
      // Pour les autres modes, on regénère la grille en se basant sur le premier clic !
      base = generateSafeBoardSeeded(base, firstClick.x, firstClick.y, seed);
      
      const revealedSet = new Set(revealedCells);
      const flaggedSet = new Set(flaggedCells);
      const questionSet = new Set(questionCells);

      const cells = base.cells.map((cell) => ({
        ...cell,
        status: revealedSet.has(cell.id) ? ("revealed" as const) : cell.status,
        mark: flaggedSet.has(cell.id) ? ("flag" as const) : questionSet.has(cell.id) ? ("question" as const) : cell.mark,
      }));

      const safeCells = cells.filter((c) => !c.hasMine);
      const won = safeCells.every((c) => c.status === "revealed");
      const lost = !!explodedCellId;
      const result = won ? "won" : lost ? "lost" : "playing";

      set((state) => ({
        game: {
          ...base,
          cells,
          firstClickDone: revealedCells.length > 0,
          result,
          explodedCellId,
          flagsUsed: flaggedCells.length > 0,
          clickedRevealed: false,
        },
        mode,
        isTimerRunning: result === "playing",
        // Keep the existing timer if already running, don't reset to 0 on every sync
        timer: state.timer === 0 && revealedCells.length > 0 ? 1 : state.timer
      }));
      return;
    }

    const revealedSet = new Set(revealedCells);
    const flaggedSet = new Set(flaggedCells);
    const questionSet = new Set(questionCells);

    const cells = base.cells.map((cell) => ({
      ...cell,
      status: revealedSet.has(cell.id) ? ("revealed" as const) : cell.status,
      mark: flaggedSet.has(cell.id) ? ("flag" as const) : questionSet.has(cell.id) ? ("question" as const) : cell.mark,
    }));

    const safeCells = cells.filter((c) => !c.hasMine);
    const won = safeCells.every((c) => c.status === "revealed");
    const lost = !!explodedCellId;
    const result = won ? "won" : lost ? "lost" : "playing";

    set((state) => ({
      game: {
        ...base,
        cells,
        firstClickDone: revealedCells.length > 0,
        result,
        explodedCellId,
        flagsUsed: flaggedCells.length > 0,
        clickedRevealed: false,
      },
      mode,
      isTimerRunning: result === "playing",
      timer: state.timer === 0 && revealedCells.length > 0 ? 1 : state.timer
    }));
  },

  mergeOpponentState: (revealedIds: string[], flaggedIds: string[], questionIds: string[], explodedId?: string) => {
    set((state) => {
      if (state.game.result !== "playing") return state; // Don't merge if we already won/lost
      const revealedSet = new Set(revealedIds);
      const flaggedSet = new Set(flaggedIds);
      const questionSet = new Set(questionIds);

      const cells = state.game.cells.map((cell) => {
        let status = cell.status;
        if (revealedSet.has(cell.id)) status = "revealed";
        let mark = cell.mark;
        if (flaggedSet.has(cell.id)) mark = "flag";
        else if (questionSet.has(cell.id)) mark = "question";
        return { ...cell, status, mark };
      });

      const safeCells = cells.filter((c) => !c.hasMine);
      const won = safeCells.every((c) => c.status === "revealed");
      // Note: we don't end the game immediately if the opponent explodes, that's cross-victory logic handled elsewhere if needed
      // Actually, if it's a shared board, opponent exploding doesn't necessarily mean WE lost, it means the opponent lost.
      // But if we want cross-victory:
      // const lost = !!explodedId;
      // For now we just merge visual state.

      return {
        game: {
          ...state.game,
          cells,
          result: won ? "won" : state.game.result,
        }
      };
    });
  },
}));
