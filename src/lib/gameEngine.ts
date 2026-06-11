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

/* ── Pure Logic Solver ── */

/**
 * Simple CSP-based pure logic solver.
 * Returns true if the board is solvable by pure logic (no guessing needed).
 * Uses constraint propagation: if a cell's constraint is fully satisfied by flags,
 * or all remaining hidden neighbors must be mines, we can deduce deterministically.
 */
export function isPureLogicSolvable(cells: Cell[], config: GridConfig): boolean {
  // Simulate solving
  const byId = new Map(cells.map((c) => [c.id, { ...c }]));
  const mines = new Set(cells.filter(c => c.hasMine).map(c => c.id));
  
  // Start by revealing from a safe "first click" cell (a corner neighbor area)
  // Find a non-mine cell with 0 adjacent mines
  const zeroCells = cells.filter(c => !c.hasMine && c.adjacentMines === 0);
  if (zeroCells.length === 0) return false; // No zero cells = must guess

  // Simulate reveals
  const revealed = new Set<string>();
  const flagged = new Set<string>();
  
  // BFS reveal from a zero cell
  const bfsReveal = (startId: string) => {
    const queue = [startId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (revealed.has(id) || flagged.has(id)) continue;
      const cell = byId.get(id);
      if (!cell || cell.hasMine) continue;
      revealed.add(id);
      if (cell.adjacentMines === 0) {
        queue.push(...neighbors(cell.x, cell.y, config));
      }
    }
  };
  
  bfsReveal(zeroCells[0].id);
  
  let progress = true;
  const MAX_ITERATIONS = 500;
  let iterations = 0;
  
  while (progress && iterations < MAX_ITERATIONS) {
    progress = false;
    iterations++;
    
    // For each revealed numbered cell, apply constraints
    for (const id of revealed) {
      const cell = byId.get(id);
      if (!cell || cell.adjacentMines === 0) continue;
      
      const nbs = neighbors(cell.x, cell.y, config);
      const hiddenNbs = nbs.filter(n => !revealed.has(n) && !flagged.has(n));
      const flaggedNbs = nbs.filter(n => flagged.has(n));
      const mineNbs = nbs.filter(n => mines.has(n));
      const remainingMines = mineNbs.length - flaggedNbs.length;
      
      if (hiddenNbs.length === 0) continue;
      
      // All hidden neighbors are mines → flag them
      if (remainingMines === hiddenNbs.length && remainingMines > 0) {
        for (const n of hiddenNbs) {
          flagged.add(n);
          progress = true;
        }
      }
      
      // All mines found → reveal remaining hidden neighbors
      if (remainingMines === 0 && hiddenNbs.length > 0) {
        for (const n of hiddenNbs) {
          if (!mines.has(n)) {
            bfsReveal(n);
            progress = true;
          }
        }
      }
    }
  }
  
  // Check if all non-mine cells are revealed
  const totalSafeCells = cells.filter(c => !c.hasMine).length;
  return revealed.size === totalSafeCells;
}

/**
 * Generate a board that is solvable by pure logic.
 * Tries up to maxAttempts times with different seeds.
 */
export const generatePureLogicBoard = (
  config: GridConfig,
  safeX: number,
  safeY: number,
  baseSeed: number,
): GameState => {
  const MAX_ATTEMPTS = 80;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = baseSeed + attempt * 7919; // Use prime offset for variety
    const emptyState = createEmptyGame(config);
    const candidate = generateSafeBoardSeeded(emptyState, safeX, safeY, seed);
    if (isPureLogicSolvable(candidate.cells, config)) {
      return { ...candidate, seed };
    }
  }
  // Fallback: return a regular seeded board if no pure logic solution found
  const emptyState = createEmptyGame(config);
  return generateSafeBoardSeeded(emptyState, safeX, safeY, baseSeed);
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
            // On game over: reveal all mines but PRESERVE flags on correctly flagged mines
            nextState = {
              ...nextState,
              cells: nextState.cells.map((c) => {
                if (c.hasMine) {
                  // Keep flag mark visible on correctly flagged mines
                  if (c.mark === "flag") return { ...c, status: "revealed" as const };
                  return { ...c, status: "revealed" as const, mark: null };
                }
                return c;
              }),
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

  const generated = state.firstClickDone 
    ? state 
    : (state.seed !== undefined 
        ? generateSafeBoardSeeded(state, target.x, target.y, state.seed)
        : generateSafeBoard(state, target.x, target.y));
  
  const clicked = generated.cells.find((cell) => cell.id === id);
  if (clicked?.hasMine) {
    return {
      ...generated,
      // On game over: reveal all mines but preserve flag marks on correctly flagged mines
      cells: generated.cells.map((cell) => {
        if (cell.hasMine) {
          if (cell.mark === "flag") return { ...cell, status: "revealed" as const };
          return { ...cell, status: "revealed" as const, mark: null };
        }
        return cell;
      }),
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
