import type { Cell, CellMark, GameResult, GameState, GridConfig } from "@/types";

const directions: Array<[number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

const cellId = (x: number, y: number): string => `${x}:${y}`;

const neighbors = (x: number, y: number, config: GridConfig): string[] =>
  directions
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < config.width && p.y < config.height)
    .map((p) => cellId(p.x, p.y));

/* ── Seeded PRNG (Linear Congruential Generator) ── */

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/* ── Board creation ── */

export const createEmptyGame = (config: GridConfig): GameState => ({
  config,
  firstClickDone: false,
  result: "playing",
  flagsUsed: false,
  clickedRevealed: false,
  cells: Array.from({ length: config.width * config.height }, (_, index) => {
    const x = index % config.width;
    const y = Math.floor(index / config.width);
    return { id: cellId(x, y), x, y, hasMine: false, adjacentMines: 0, status: "hidden", mark: null };
  }),
});

/** Place mines randomly, keeping a 3×3 safe zone around (safeX, safeY). */
export const generateSafeBoard = (state: GameState, safeX: number, safeY: number): GameState => {
  const forbidden = new Set<string>([cellId(safeX, safeY), ...neighbors(safeX, safeY, state.config)]);
  const candidates = state.cells.map((cell) => cell.id).filter((id) => !forbidden.has(id));
  const mines = new Set<string>();
  while (mines.size < Math.min(state.config.mines, candidates.length)) {
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    mines.add(picked);
  }

  const cells = state.cells.map((cell) => {
    const hasMine = mines.has(cell.id);
    const adjacentMines = hasMine ? 0 : neighbors(cell.x, cell.y, state.config).filter((id) => mines.has(id)).length;
    return { ...cell, hasMine, adjacentMines };
  });

  return { ...state, cells, firstClickDone: true };
};

/** Place mines using a deterministic seeded RNG — same seed = same board. */
export const generateSafeBoardSeeded = (
  state: GameState,
  safeX: number,
  safeY: number,
  seed: number,
): GameState => {
  const rng = seededRandom(seed);
  const forbidden = new Set<string>([cellId(safeX, safeY), ...neighbors(safeX, safeY, state.config)]);
  const candidates = state.cells.map((cell) => cell.id).filter((id) => !forbidden.has(id));

  // Fisher-Yates shuffle with seeded RNG
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const mines = new Set<string>(shuffled.slice(0, Math.min(state.config.mines, shuffled.length)));

  const cells = state.cells.map((cell) => {
    const hasMine = mines.has(cell.id);
    const adjacentMines = hasMine ? 0 : neighbors(cell.x, cell.y, state.config).filter((id) => mines.has(id)).length;
    return { ...cell, hasMine, adjacentMines };
  });

  return { ...state, cells, firstClickDone: true };
};

/** Create a pre-generated board for duel mode — safe zone at board center. */
export const generateDuelBoard = (config: GridConfig, seed: number): GameState => {
  const state = createEmptyGame(config);
  const centerX = Math.floor(config.width / 2);
  const centerY = Math.floor(config.height / 2);
  return generateSafeBoardSeeded(state, centerX, centerY, seed);
};

/* ── Reveal logic ── */

const revealFrom = (state: GameState, id: string): GameState => {
  const byId = new Map(state.cells.map((cell) => [cell.id, { ...cell }]));
  const start = byId.get(id);
  if (!start || start.mark === "flag") return state;

  const queue: string[] = [id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const cell = byId.get(currentId);
    if (!cell || cell.status === "revealed" || cell.mark === "flag") continue;
    cell.status = "revealed";
    byId.set(currentId, cell);
    if (cell.adjacentMines === 0 && !cell.hasMine) queue.push(...neighbors(cell.x, cell.y, state.config));
  }

  const cells = Array.from(byId.values());
  const safeCells = cells.filter((cell) => !cell.hasMine);
  const won = safeCells.every((cell) => cell.status === "revealed");
  return { ...state, cells, result: won ? "won" : state.result };
};

export const revealCell = (state: GameState, id: string, isTrap: boolean): GameState => {
  if (state.result !== "playing") return state;
  const target = state.cells.find((cell) => cell.id === id);
  if (!target || target.mark === "flag") return state;

  // Clic sur case déjà révélée (Chord / Succès Louis)
  if (target.status === "revealed") {
    let nextState = { ...state, clickedRevealed: true };
    if (target.adjacentMines > 0) {
      const neighborIds = neighbors(target.x, target.y, state.config);
      const neighborCells = nextState.cells.filter(c => neighborIds.includes(c.id));
      const flagCount = neighborCells.filter(c => c.mark === "flag").length;
      
      if (flagCount === target.adjacentMines) {
        const toReveal = neighborCells.filter(c => c.status === "hidden" && c.mark !== "flag");
        for (const cellToReveal of toReveal) {
          if (nextState.result !== "playing") break;
          if (cellToReveal.hasMine) {
            nextState = {
              ...nextState,
              cells: nextState.cells.map((c) => (c.hasMine ? { ...c, status: "revealed" as const } : c)),
              result: "lost",
              explodedCellId: cellToReveal.id,
            };
          } else {
            nextState = revealFrom(nextState, cellToReveal.id);
          }
        }
      }
    }
    return nextState;
  }

  // Shadowban trap: first click = instant death
  if (isTrap && !state.firstClickDone) {
    const cells = state.cells.map((cell) =>
      cell.id === id
        ? { ...cell, hasMine: true, adjacentMines: 0, status: "revealed" as const }
        : cell,
    );
    return { ...state, cells, firstClickDone: true, result: "lost", explodedCellId: id };
  }

  const generated = state.firstClickDone ? state : generateSafeBoard(state, target.x, target.y);
  const clicked = generated.cells.find((cell) => cell.id === id);
  if (clicked?.hasMine) {
    return {
      ...generated,
      cells: generated.cells.map((cell) => (cell.hasMine ? { ...cell, status: "revealed" as const } : cell)),
      result: "lost",
      explodedCellId: id,
    };
  }
  return revealFrom(generated, id);
};

export const cycleMark = (state: GameState, id: string): GameState => {
  if (state.result !== "playing") return state;
  const nextMark = (mark: CellMark): CellMark => (mark === null ? "flag" : mark === "flag" ? "question" : null);
  const target = state.cells.find((c) => c.id === id);
  const willFlag = target && target.status === "hidden" && target.mark === null;
  return {
    ...state,
    flagsUsed: state.flagsUsed || !!willFlag,
    cells: state.cells.map((cell) =>
      cell.id === id && cell.status === "hidden" ? { ...cell, mark: nextMark(cell.mark) } : cell,
    ),
  };
};

export const resultLabel = (result: GameResult): string =>
  result === "playing" ? "En cours" : result === "won" ? "Victoire" : "Défaite";
