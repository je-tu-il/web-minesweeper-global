import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Bomb, LogOut, Shield, Users } from "lucide-react";
import { Link } from "react-router-dom";
export function AuthBar() {
  const { user, userProfile, isLoading, signInWithGoogle, logout } = useAuth();

  if (isLoading) {
    return (
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 text-slate-950">
            <Bomb className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-white">Minesweeper Global</span>
        </div>
        <div className="h-8 w-32 animate-pulse rounded-xl bg-white/10" />
      </header>
    );
  }

  if (!user || !userProfile) {
    return (
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 text-slate-950">
            <Bomb className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-white">Minesweeper Global</span>
        </div>
        <button
          onClick={signInWithGoogle}
          className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
        >
          Se connecter avec Google
        </button>
      </header>
    );
  }

  const initial = (userProfile.username || user.displayName || "?")[0].toUpperCase();
  const { totalWins, totalLosses } = userProfile.stats || { totalWins: 0, totalLosses: 0 };

  return (
    <header className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 text-slate-950">
          <Bomb className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/60">Minesweeper Global</p>
          <p className="text-sm font-bold text-white">{userProfile.username || "Sans pseudo"}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 text-sm sm:flex">
          <span className="text-emerald-300">{totalWins}W</span>
          <span className="text-slate-500">/</span>
          <span className="text-red-300">{totalLosses}L</span>
        </div>

        <Link
          to="/community"
          className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-200 transition hover:bg-cyan-300/20"
          title="Communauté"
        >
          <Users className="h-4 w-4" />
        </Link>

        {userProfile.role === "admin" && (
          <Link
            to="/admin"
            className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-amber-200 transition hover:bg-amber-300/20"
            title="Admin"
          >
            <Shield className="h-4 w-4" />
          </Link>
        )}

        <div className="relative">
          <Link to="/profile" className="grid h-9 w-9 overflow-hidden place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-bold text-white transition hover:scale-105 hover:shadow-lg hover:shadow-cyan-400/20" title="Mon Profil">
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </Link>
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#03070c] bg-green-500" title="En ligne" />
        </div>

        <button
          onClick={logout}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          title="Déconnexion"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

    </header>
  );
}
