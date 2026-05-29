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

interface CommunityModalProps {
  open: boolean;
  onClose: () => void;
}

const MEDAL_COLORS: Record<number, { ring: string; bg: string; text: string; icon: typeof Crown }> = {
  0: { ring: "ring-yellow-400/50", bg: "bg-yellow-400/10 border-yellow-400/25", text: "text-yellow-300", icon: Crown },
  1: { ring: "ring-slate-300/40", bg: "bg-slate-300/10 border-slate-300/20", text: "text-slate-200", icon: Medal },
  2: { ring: "ring-amber-600/50", bg: "bg-amber-700/10 border-amber-600/20", text: "text-amber-400", icon: Award },
};

export function CommunityModal({ open, onClose }: CommunityModalProps) {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAllUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [open]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#070e1c]/95 shadow-2xl shadow-black/60 backdrop-blur-xl max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/15 text-amber-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Communauté</h2>
              <p className="text-xs text-slate-500">Classement par taux de victoire</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
            </div>
          ) : ranked.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-600">Aucun joueur inscrit pour le moment.</p>
          ) : (
            <div className="space-y-1.5">
              {ranked.map((player, idx) => {
                const isMe = player.uid === userProfile?.uid;
                const medal = MEDAL_COLORS[idx];
                const rateStr = (player.rate * 100).toFixed(1);
                const MedalIcon = medal?.icon;

                return (
                  <Link
                    to={`/profile/${player.uid}`}
                    key={player.uid}
                    onClick={onClose}
                    className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                      medal
                        ? `${medal.bg} hover:brightness-110`
                        : isMe
                        ? "border-cyan-400/20 bg-cyan-400/[0.06] hover:bg-cyan-400/10"
                        : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    {/* Rank badge */}
                    <div
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black ${
                        medal
                          ? `${medal.text} bg-white/[0.06]`
                          : "bg-white/[0.04] text-slate-500"
                      }`}
                    >
                      {MedalIcon ? <MedalIcon className="h-4 w-4" /> : `#${idx + 1}`}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ${
                        medal ? medal.ring : "ring-white/10"
                      } bg-gradient-to-br from-slate-700 to-slate-800 text-sm font-bold text-white`}
                    >
                      {player.avatarUrl ? (
                        <img src={player.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (player.username[0] ?? "?").toUpperCase()
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`truncate text-sm font-semibold ${medal ? medal.text : "text-white"}`}>
                          {player.username}
                        </span>
                        {isMe && (
                          <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                            VOUS
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>
                          <span className="text-emerald-400">{player.w}W</span>
                          {" / "}
                          <span className="text-red-400">{player.l}L</span>
                        </span>
                        <span>·</span>
                        <span>{player.total} parties</span>
                      </div>
                    </div>

                    {/* Win rate */}
                    <div className="flex flex-col items-end shrink-0">
                      <span
                        className={`text-lg font-black tabular-nums ${
                          medal ? medal.text : player.rate >= 0.6 ? "text-emerald-300" : "text-amber-200"
                        }`}
                      >
                        {rateStr}%
                      </span>
                      <span className="text-[9px] text-slate-600">win rate</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
