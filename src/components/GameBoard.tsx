import { useGameStore } from "@/store/gameStore";
import { resultLabel } from "@/lib/gameEngine";
import { Flag, Timer, Zap, Trophy, Skull } from "lucide-react";
import React, { useMemo, useCallback } from "react";
import type { Cell } from "@/types";

interface GameBoardProps {
  onCellClick: (cellId: string) => void;
  onCellRightClick: (cellId: string) => void;
  disabled?: boolean;
}

/* Couleurs classiques du démineur pour les chiffres */
const NUMBER_COLORS: Record<number, string> = {
  1: "#4a90d9",
  2: "#4caf50",
  3: "#e53935",
  4: "#7b1fa2",
  5: "#ff8f00",
  6: "#00897b",
  7: "#37474f",
  8: "#78909c",
};

interface CellComponentProps {
  cell: Cell;
  cellSize: number;
  isExploded: boolean;
  disabled: boolean;
  isGameOver: boolean;
  onCellClick: (cellId: string) => void;
  onCellRightClick: (cellId: string) => void;
}

const CellComponent = React.memo(({ cell, cellSize, isExploded, disabled, isGameOver, onCellClick, onCellRightClick }: CellComponentProps) => {
  const isRevealed = cell.status === "revealed";
  const isMine = cell.hasMine;
  const num = cell.adjacentMines;

  return (
    <button
      onClick={() => !disabled && onCellClick(cell.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!disabled) onCellRightClick(cell.id);
      }}
      disabled={disabled || isGameOver}
      style={{
        width: cellSize,
        height: cellSize,
        fontSize: cellSize > 34 ? 16 : 13,
        color: isRevealed && !isMine && num > 0 ? NUMBER_COLORS[num] : undefined,
      }}
      className={[
        "relative select-none font-black transition-all duration-100",
        // ── Case cachée : style classique 3D relevé ──
        !isRevealed && [
          "border-t-[2px] border-l-[2px] border-b-[2px] border-r-[2px]",
          "border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#3a3a3a] border-r-[#3a3a3a]",
          "bg-[#5a5a5a]",
          "hover:bg-[#6a6a6a] hover:scale-[1.08] hover:z-10 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)]",
          "active:border-t-[#3a3a3a] active:border-l-[#3a3a3a] active:border-b-[#8a8a8a] active:border-r-[#8a8a8a] active:bg-[#4a4a4a]",
        ].join(" "),
        // ── Case révélée : style creux ──
        isRevealed && !isMine && "border border-[#2a2a2a] bg-[#3a3a3a]",
        // ── Mine explosée ──
        isExploded && "!bg-red-600 !border-red-700 shadow-lg shadow-red-600/50",
        // ── Mine révélée (game over) ──
        isRevealed && isMine && !isExploded && "border border-[#2a2a2a] bg-[#3a3a3a]",
        // ── Disabled ──
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Cellule ${cell.x},${cell.y}`}
    >
      {isRevealed ? (
        isMine ? (
          <span className="flex items-center justify-center text-base">✦</span>
        ) : num > 0 ? (
          <span className="flex items-center justify-center font-black">{num}</span>
        ) : null
      ) : cell.mark === "flag" ? (
        <span className="flex items-center justify-center text-red-400">▶</span>
      ) : cell.mark === "question" ? (
        <span className="flex items-center justify-center text-amber-300 font-bold">?</span>
      ) : null}
    </button>
  );
});

export function GameBoard({ onCellClick, onCellRightClick, disabled = false }: GameBoardProps) {
  const { game, timer } = useGameStore();
  const { cells, config, result, explodedCellId } = game;

  const revealedCount = useMemo(() => cells.filter((c) => c.status === "revealed").length, [cells]);
  const flagsCount = useMemo(() => cells.filter((c) => c.mark === "flag").length, [cells]);
  const safeCells = config.width * config.height - config.mines;

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;

  /* Taille de cellule adaptative : plus gros sur petites grilles */
  const cellSize = config.width <= 9 ? 42 : config.width <= 16 ? 34 : 28;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* Stats bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm">
            <Timer className="h-4 w-4 text-cyan-300" />
            <span className="font-mono text-white">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm">
            <Flag className="h-4 w-4 text-amber-300" />
            <span className="text-slate-300">
              {flagsCount}/{config.mines}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm">
            <Zap className="h-4 w-4 text-emerald-300" />
            <span className="text-slate-300">
              {revealedCount}/{safeCells}
            </span>
          </div>
        </div>

        {result !== "playing" && (
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${
              result === "won"
                ? "border border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                : "border border-red-400/30 bg-red-400/15 text-red-200"
            }`}
          >
            {result === "won" ? <Trophy className="h-4 w-4" /> : <Skull className="h-4 w-4" />}
            {resultLabel(result)}
          </div>
        )}
      </div>

      {/* Grid — scroll horizontal sur grandes grilles */}
      <div className="relative overflow-x-auto pb-2">
        {disabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
            <p className="text-lg font-bold text-slate-400">Tour de l'adversaire…</p>
          </div>
        )}

        <div
          className="mx-auto"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${config.width}, ${cellSize}px)`,
            gap: "1px",
            width: "fit-content",
          }}
        >
          {cells.map((cell) => (
            <CellComponent
              key={cell.id}
              cell={cell}
              cellSize={cellSize}
              isExploded={explodedCellId === cell.id}
              disabled={disabled}
              isGameOver={result !== "playing"}
              onCellClick={onCellClick}
              onCellRightClick={onCellRightClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
