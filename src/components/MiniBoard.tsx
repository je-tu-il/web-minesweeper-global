import { useMemo } from "react";
import type { GridConfig } from "@/types";

interface MiniBoardProps {
  config: GridConfig;
  revealedCells: string[];
  flaggedCells: string[];
  explodedCellId?: string;
}

export function MiniBoard({ config, revealedCells, flaggedCells, explodedCellId }: MiniBoardProps) {
  const cells = useMemo(() => {
    return Array.from({ length: config.width * config.height }, (_, i) => {
      const x = i % config.width;
      const y = Math.floor(i / config.width);
      return `${x}:${y}`;
    });
  }, [config.width, config.height]);

  const revealedSet = useMemo(() => new Set(revealedCells), [revealedCells]);
  const flaggedSet = useMemo(() => new Set(flaggedCells), [flaggedCells]);

  // Adapter la taille des pixels en fonction de la grille
  const px = config.width <= 10 ? 12 : config.width <= 20 ? 8 : 4;

  return (
    <div
      className="overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-inner blur-[1px] hover:blur-none transition-all duration-300"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${config.width}, ${px}px)`,
        gap: "1px",
        width: "fit-content",
        padding: "4px",
      }}
    >
      {cells.map((id) => {
        const isRevealed = revealedSet.has(id);
        const isFlagged = flaggedSet.has(id);
        const isExploded = explodedCellId === id;

        let bg = "bg-[#5a5a5a]"; // Hidden
        if (isExploded) bg = "bg-red-600";
        else if (isRevealed) bg = "bg-[#2a2a2a]"; // Revealed (safe)
        else if (isFlagged) bg = "bg-red-400"; // Flag

        return (
          <div
            key={id}
            className={`${bg}`}
            style={{ width: px, height: px }}
          />
        );
      })}
    </div>
  );
}
