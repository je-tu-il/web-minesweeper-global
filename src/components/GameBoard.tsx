import { useGameStore } from "@/store/gameStore";
import { resultLabel } from "@/lib/gameEngine";
import { Flag, Timer, Zap, Trophy, Skull } from "lucide-react";
import { useMemo } from "react";

interface GameBoardProps {
  onCellClick: (cellId: string) => void;
  onCellRightClick: (cellId: string) => void;
  disabled?: boolean;
}

export function GameBoard({ onCellClick, onCellRightClick, disabled = false }: GameBoardProps) {
  const { game, timer } = useGameStore();
  const { cells, config, result, explodedCellId } = game;

  const revealedCount = useMemo(() => cells.filter((c) => c.status === "revealed").length, [cells]);
  const flagsCount = useMemo(() => cells.filter((c) => c.mark === "flag").length, [cells]);
  const safeCells = config.width * config.height - config.mines;

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;

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

      {/* Grid */}
      <div className="relative">
        {disabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
            <p className="text-lg font-bold text-slate-400">Tour de l'adversaire…</p>
          </div>
        )}

        <div
          className="mx-auto grid max-w-3xl gap-1"
          style={{ gridTemplateColumns: `repeat(${config.width}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) => {
            const isExploded = explodedCellId === cell.id;
            const isRevealed = cell.status === "revealed";
            const content = isRevealed
              ? cell.hasMine
                ? "💣"
                : cell.adjacentMines || ""
              : cell.mark === "flag"
                ? "🚩"
                : cell.mark === "question"
                  ? "❓"
                  : "";

            const numberColors: Record<number, string> = {
              1: "text-blue-300",
              2: "text-emerald-300",
              3: "text-red-300",
              4: "text-purple-300",
              5: "text-amber-300",
              6: "text-teal-300",
              7: "text-pink-300",
              8: "text-slate-300",
            };

            const numColor = isRevealed && !cell.hasMine && cell.adjacentMines > 0
              ? numberColors[cell.adjacentMines] || "text-white"
              : "";

            return (
              <button
                key={cell.id}
                onClick={() => !disabled && onCellClick(cell.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!disabled) onCellRightClick(cell.id);
                }}
                disabled={disabled || result !== "playing"}
                className={`aspect-square rounded-lg border text-xs font-black transition-all duration-150 sm:text-sm
                  ${
                    isRevealed
                      ? `border-white/5 bg-slate-900/80 ${numColor}`
                      : "border-cyan-300/15 bg-cyan-300/10 text-amber-200 shadow-inner shadow-cyan-300/5 hover:scale-105 hover:bg-cyan-300/20"
                  }
                  ${isExploded ? "!bg-red-500 !text-white shadow-lg shadow-red-500/40" : ""}
                  ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                `}
                aria-label={`Cellule ${cell.x},${cell.y}`}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
