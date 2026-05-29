import { useState, useEffect, useMemo } from "react";
import { getAllUsers } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { UserProfile } from "@/types";
import { Trophy, X, Crown, Medal, Award, Users } from "lucide-react";
import { Link } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════
   CommunityModal – Ranked leaderboard of all registered
   players, sorted by win-rate.
   Gold / Silver / Bronze styling for top-3.
   ═══════════════════════════════════════════════════════════ */

import { AuthBar } from "@/components/AuthBar";

export default function Community() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAllUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  /* Sort: win-rate DESC, then total wins DESC */
  const ranked = useMemo(() => {
    return users
      .filter((u) => u.username)
      .map((u) => {
        const w = u.stats?.totalWins ?? 0;
        const l = u.stats?.totalLosses ?? 0;
        const total = w + l;
        const rate = total > 0 ? w / total : 0;
        return { ...u, rate, total, w, l };
      })
      .sort((a, b) => (b.rate - a.rate !== 0 ? b.rate - a.rate : b.w - a.w));
  }, [users]);

  return (
    <div className="min-h-screen bg-[#020611] text-slate-200 flex flex-col font-sans">
      <AuthBar />

      <main className="flex-1 container mx-auto max-w-4xl py-12 px-4 flex flex-col items-center">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400 mb-4 shadow-[0_0_30px_rgba(251,191,36,0.15)] border border-amber-400/20">
            <Users className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">Communauté</h1>
          <p className="text-slate-400">Classement officiel par taux de victoire</p>
        </div>

        {/* Body */}
        <div className="w-full max-w-2xl bg-white/[0.02] border border-white/10 rounded-3xl p-2 shadow-2xl backdrop-blur-sm">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            </div>
          ) : ranked.length === 0 ? (
            <p className="py-24 text-center text-slate-500">Aucun joueur inscrit pour le moment.</p>
          ) : (
            <div className="space-y-1.5 p-2">
              {ranked.map((player, idx) => {
                const isMe = player.uid === userProfile?.uid;
                const medal = MEDAL_COLORS[idx];
                const rateStr = (player.rate * 100).toFixed(1);
                const MedalIcon = medal?.icon;

                return (
                  <Link
                    to={`/profile/${player.uid}`}
                    key={player.uid}
                    className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 transition ${
                      medal
                        ? `${medal.bg} hover:brightness-110`
                        : isMe
                        ? "border-cyan-400/20 bg-cyan-400/[0.06] hover:bg-cyan-400/10"
                        : "border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Rank badge */}
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black ${
                        medal
                          ? `${medal.text} bg-white/[0.08]`
                          : "bg-white/[0.04] text-slate-500"
                      }`}
                    >
                      {MedalIcon ? <MedalIcon className="h-5 w-5" /> : `#${idx + 1}`}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ${
                        medal ? medal.ring : "ring-white/10"
                      } bg-gradient-to-br from-slate-700 to-slate-800 text-lg font-bold text-white shadow-lg`}
                    >
                      {player.avatarUrl ? (
                        <img src={player.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (player.username[0] ?? "?").toUpperCase()
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-lg font-bold ${medal ? medal.text : "text-white"}`}>
                          {player.username}
                        </span>
                        {isMe && (
                          <span className="rounded bg-cyan-400/20 px-2 py-0.5 text-[10px] font-black tracking-wider text-cyan-300">
                            VOUS
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs font-medium text-slate-500">
                        <span>
                          <span className="text-emerald-400/90">{player.w}W</span>
                          <span className="mx-1 text-slate-600">/</span>
                          <span className="text-red-400/90">{player.l}L</span>
                        </span>
                        <span className="text-slate-700">•</span>
                        <span>{player.total} parties</span>
                      </div>
                    </div>

                    {/* Win rate */}
                    <div className="flex flex-col items-end justify-center shrink-0">
                      <span
                        className={`text-2xl font-black tabular-nums tracking-tight ${
                          medal ? medal.text : player.rate >= 0.6 ? "text-emerald-300" : "text-amber-200"
                        }`}
                      >
                        {rateStr}%
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                        Win Rate
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
