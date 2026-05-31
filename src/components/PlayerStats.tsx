import type { UserProfile } from "@/types";
import { Trophy, Skull, TrendingUp } from "lucide-react";

interface PlayerStatsProps {
  profile: UserProfile;
}

export function PlayerStats({ profile }: PlayerStatsProps) {
  const { totalWins, totalLosses } = profile.stats || { totalWins: 0, totalLosses: 0 };
  const total = totalWins + totalLosses;
  const winRate = total > 0 ? Math.round((totalWins / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 backdrop-blur">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/60">Statistiques</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.04] p-3">
          <Trophy className="h-4 w-4 text-emerald-300" />
          <span className="text-lg font-bold text-white">{totalWins}</span>
          <span className="text-xs text-slate-500">Victoires</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.04] p-3">
          <Skull className="h-4 w-4 text-red-300" />
          <span className="text-lg font-bold text-white">{totalLosses}</span>
          <span className="text-xs text-slate-500">Défaites</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.04] p-3">
          <TrendingUp className="h-4 w-4 text-amber-300" />
          <span className="text-lg font-bold text-white">{winRate}%</span>
          <span className="text-xs text-slate-500">Ratio</span>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
          style={{ width: `${winRate}%` }}
        />
      </div>
    </div>
  );
}
