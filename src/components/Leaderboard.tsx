import { useEffect, useState } from "react";
import { subscribeLeaderboard } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { GRID_PRESETS, type LeaderboardEntry } from "@/types";
import { Clock, Crown, Medal } from "lucide-react";
import { Link } from "react-router-dom";

const DIFFICULTIES = ["beginner", "intermediate", "expert"] as const;
const LABELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  expert: "Expert",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Leaderboard() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState<string>("beginner");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const unsub = subscribeLeaderboard(tab, setEntries, 20);
    return unsub;
  }, [tab]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-300" />
        <h2 className="text-lg font-bold text-white">Classement</h2>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 rounded-xl bg-white/[0.04] p-1">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => setTab(d)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              tab === d ? "bg-amber-300/15 text-amber-200" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {LABELS[d]}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-1">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600">Aucun score enregistré.</p>
        ) : (
          entries.map((entry, i) => {
            const isMe = entry.uid === userProfile?.uid;
            const rankIcon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <div
                key={entry.id || `${entry.uid}-${entry.time}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                  isMe ? "border border-cyan-300/20 bg-cyan-300/[0.06]" : "bg-white/[0.03]"
                }`}
              >
                {/* Rang */}
                <div className="w-7 text-center text-sm font-bold">
                  {rankIcon || <span className="text-slate-500">{i + 1}</span>}
                </div>
                {/* Pseudo */}
                <Link to={`/profile/${entry.uid}`} className={`flex-1 truncate text-sm font-medium hover:underline ${isMe ? "text-cyan-200" : "text-white"}`}>
                  {entry.username}
                </Link>
                {/* Temps */}
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span className="font-mono text-amber-200">{formatTime(entry.time)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
