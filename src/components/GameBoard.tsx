import { useGameStore } from "@/store/gameStore";
import { resultLabel } from "@/lib/gameEngine";
import { Flag, Timer, Zap, Trophy, Skull } from "lucide-react";
import React, { useMemo, useRef, useEffect, useState } from "react";
import type { Cell } from "@/types";

interface GameBoardProps {
  onCellClick: (cellId: string) => void;
  onCellRightClick: (cellId: string) => void;
  disabled?: boolean;
  isSpectator?: boolean;
  isFocusMode?: boolean;
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
        "relative select-none font-bold transition-all duration-150 flex items-center justify-center rounded-lg",
        // 🔹 Case cachée : style futuriste 🔹
        !isRevealed && [
          "bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-500/50",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),_0_2px_4px_rgba(0,0,0,0.4)]",
          !disabled && "hover:from-slate-600 hover:to-slate-700 hover:border-cyan-400/80 hover:shadow-[0_0_10px_rgba(34,211,238,0.3)] active:scale-95 active:shadow-inner",
        ].join(" "),
        // 🔹 Case révélée : style creux futuriste 🔹
        isRevealed && !isMine && "bg-[#0b1121] border border-white/5 shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)]",
        // 🔹 Mine explosée 🔹
        isExploded && "bg-red-500 border border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)] z-10 scale-105",
        // 🔹 Mine révélée (game over) 🔹
        isRevealed && isMine && !isExploded && "bg-slate-900 border border-slate-800 shadow-[inset_0_3px_6px_rgba(0,0,0,0.8)]",
        // 🔹 Disabled 🔹
        disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer",
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

export function GameBoard({ onCellClick, onCellRightClick, disabled = false, isSpectator = false, isFocusMode = false }: GameBoardProps) {
  const { game, timer } = useGameStore();
  const { cells, config, result, explodedCellId } = game;

  const revealedCount = useMemo(() => cells.filter((c) => c.status === "revealed").length, [cells]);
  const flagsCount = useMemo(() => cells.filter((c) => c.mark === "flag").length, [cells]);
  const safeCells = config.width * config.height - config.mines;

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;

  /* Taille de cellule adaptative : plus gros sur petites grilles */
  const cellSize = config.width <= 9 ? 42 : config.width <= 16 ? 34 : 28;

  const containerRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState(1);

  // ResizeObserver pour adapter l'échelle
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const availableWidth = entry.contentRect.width;
        // In focus mode, we also care about viewport height roughly
        const availableHeight = isFocusMode ? window.innerHeight - 150 : Infinity;
        
        // gap = 2px
        const boardWidth = config.width * cellSize + (config.width - 1) * 2;
        const boardHeight = config.height * cellSize + (config.height - 1) * 2;
        
        const scaleWidth = boardWidth > availableWidth ? availableWidth / boardWidth : 1;
        const scaleHeight = boardHeight > availableHeight ? availableHeight / boardHeight : 1;
        
        setBaseScale(Math.min(scaleWidth, scaleHeight, 1));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [config.width, config.height, cellSize, isFocusMode]);

  return (
    <section 
      className={`rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl w-full ${isFocusMode ? "overflow-hidden" : ""}`}
    >
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

      {/* Grid */}
      <div className="relative flex justify-center w-full" ref={containerRef}>
        {disabled && game.result === "playing" && !isSpectator && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-950/20 backdrop-blur-[1px]">
            <div className="rounded-full bg-slate-900/80 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur">
              ⏳ Tour de l'adversaire...
            </div>
          </div>
        )}

        <div
          className={`mx-auto transition-transform duration-200 ${isFocusMode ? "origin-center" : "origin-top"}`}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${config.width}, ${cellSize}px)`,
            gap: "2px",
            width: "fit-content",
            transform: `scale(${baseScale})`,
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
