import { describe, expect, it, vi } from 'vitest';
import { createEmptyGame, cycleMark, generateSafeBoard, generateSafeBoardSeeded, revealCell, seededRandom } from './gameEngine';

const grid = { width: 8, height: 8, mines: 10 };

describe('minesweeper board rules', () => {
  it('keeps the seeded random endpoint strictly below one', () => {
    const seed = Math.imul((0xffffffff - 1013904223) | 0, 4276115653) >>> 0;
    const roll = seededRandom(seed)();
    expect(roll).toBeGreaterThan(0.999999999);
    expect(roll).toBeLessThan(1);
  });

  it('generates the same board, with the full mine count and corner protected', () => {
    const state = createEmptyGame(grid);
    const first = generateSafeBoardSeeded(state, 0, 0, 17);
    expect(first).toEqual(generateSafeBoardSeeded(state, 0, 0, 17));
    expect(first.cells.filter(cell => cell.hasMine)).toHaveLength(grid.mines);
    expect(first.cells.filter(cell => cell.x < 2 && cell.y < 2).every(cell => !cell.hasMine)).toBe(true);
  });

  it('draws distinct mines even if the random source returns the same value', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const board = generateSafeBoard(createEmptyGame(grid), 3, 3);
      expect(board.cells.filter(cell => cell.hasMine)).toHaveLength(grid.mines);
      expect(random).toHaveBeenCalledTimes(54);
    } finally {
      random.mockRestore();
    }
  });

  it('preserves placed flags on first click in pure logic mode and honors seed zero', () => {
    const blank = { ...createEmptyGame({ ...grid, pureLogic: true }), seed: 0 };
    const flagged = cycleMark(blank, '7:7');
    const first = revealCell(flagged, '0:0', false);
    expect(first.flagsUsed).toBe(true);
    expect(first.cells.find(cell => cell.id === '7:7')?.mark).toBe('flag');
    expect(first).toEqual(revealCell(flagged, '0:0', false));
  });

  it('ignores a click on a flagged cell', () => {
    const flagged = cycleMark(createEmptyGame(grid), '0:0');
    expect(revealCell(flagged, '0:0', false)).toBe(flagged);
  });
});
