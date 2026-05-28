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

      set({
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
        timer: 0,
        isTimerRunning: result === "playing",
      });
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

    set({
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
      timer: 0,
      isTimerRunning: result === "playing",
    });
  },
}));
