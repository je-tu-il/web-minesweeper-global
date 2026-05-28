import { useState, useEffect } from "react";
import { Shield, UserX, Users, ArrowLeft, Plus, Trash2, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { getAllUsers, subscribeBannedUsernames, addBannedUsername, removeBannedUsername } from "@/lib/firestore";
import type { UserProfile } from "@/types";

const ADMIN_PASSWORD = ".1Azerty";

const Admin = () => {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bannedUsernames, setBannedUsernames] = useState<string[]>([]);
  const [newBan, setNewBan] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Subscribe to banned list
  useEffect(() => {
    if (!unlocked) return;
    const unsub = subscribeBannedUsernames(setBannedUsernames);
    return unsub;
  }, [unlocked]);

  // Load all users
  useEffect(() => {
    if (!unlocked) return;
    setLoadingUsers(true);
    getAllUsers().then((u) => {
      setUsers(u);
      setLoadingUsers(false);
    });
  }, [unlocked]);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setUnlocked(true);
      setError("");
    } else {
      setError("Mot de passe invalide");
    }
  };

  const handleAddBan = async () => {
    const trimmed = newBan.trim();
    if (!trimmed) return;
    await addBannedUsername(trimmed);
    setNewBan("");
  };

  const handleRemoveBan = async (username: string) => {
    await removeBannedUsername(username);
  };

  // ── Password gate ──
  if (!unlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#03070c]">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.12),transparent_28%)]" />
        <div className="relative mx-4 w-full max-w-sm rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-300/15 text-amber-300">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin</h1>
              <p className="text-sm text-slate-500">Accès restreint</p>
            </div>
          </div>

          <input
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            type="password"
            placeholder="Mot de passe"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-amber-300/40"
            autoFocus
          />

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleLogin}
            className="mt-4 w-full rounded-xl bg-amber-300 py-3 font-bold text-slate-950 transition hover:bg-amber-200"
          >
            Entrer
          </button>

          <Link to="/" className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-300">
            <ArrowLeft className="h-3 w-3" />
            Retour au jeu
          </Link>
        </div>
      </main>
    );
  }

  // ── Admin dashboard ──
  return (
    <main className="min-h-screen bg-[#03070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.12),transparent_28%)]" />

      <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 text-slate-950">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au jeu
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Banned users */}
          <section className="rounded-[2rem] border border-red-300/15 bg-red-400/[0.05] p-5">
            <div className="mb-4 flex items-center gap-3">
              <UserX className="h-5 w-5 text-red-300" />
              <h2 className="text-xl font-bold">Utilisateurs bannis</h2>
              <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-xs text-red-300">{bannedUsernames.length}</span>
            </div>

            <div className="mb-4 flex gap-2">
              <input
                value={newBan}
                onChange={(e) => setNewBan(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddBan()}
                placeholder="Pseudo à bannir"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-red-300/40"
              />
              <button
                onClick={handleAddBan}
                disabled={!newBan.trim()}
                className="rounded-xl bg-red-400/80 px-4 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {bannedUsernames.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
                  Aucun utilisateur banni.
                </p>
              ) : (
                bannedUsernames.map((username) => (
                  <div
                    key={username}
                    className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-2.5"
                  >
                    <span className="text-sm text-white">{username}</span>
                    <button
                      onClick={() => handleRemoveBan(username)}
                      className="rounded-lg p-1.5 text-red-300 transition hover:bg-red-400/20"
                      title="Retirer du ban"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Users list */}
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-cyan-200" />
              <h2 className="text-xl font-bold">Tous les joueurs</h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{users.length}</span>
            </div>

            {loadingUsers ? (
              <div className="flex justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">Aucun joueur inscrit.</p>
                ) : (
                  <>
                    {/* Header */}
                    <div className="grid grid-cols-5 gap-2 px-3 text-xs uppercase tracking-wider text-slate-600">
                      <span className="col-span-2">Pseudo</span>
                      <span className="text-center">W</span>
                      <span className="text-center">L</span>
                      <span className="text-center">Ratio</span>
                    </div>
                    {users.map((u) => {
                      const total = u.stats.totalWins + u.stats.totalLosses;
                      const rate = total > 0 ? Math.round((u.stats.totalWins / total) * 100) : 0;
                      const isBanned = bannedUsernames.includes(u.username);
                      return (
                        <div
                          key={u.uid}
                          className={`grid grid-cols-5 items-center gap-2 rounded-xl px-3 py-2.5 ${
                            isBanned ? "bg-red-400/[0.06] border border-red-400/20" : "bg-white/[0.04]"
                          }`}
                        >
                          <span className="col-span-2 flex items-center gap-2 text-sm text-white">
                            {u.username || <span className="italic text-slate-500">Sans pseudo</span>}
                            {u.role === "admin" && (
                              <Shield className="h-3 w-3 text-amber-300" />
                            )}
                            {isBanned && (
                              <span className="rounded bg-red-400/20 px-1.5 py-0.5 text-[10px] text-red-300">BAN</span>
                            )}
                          </span>
                          <span className="text-center text-sm text-emerald-300">{u.stats.totalWins}</span>
                          <span className="text-center text-sm text-red-300">{u.stats.totalLosses}</span>
                          <span className="text-center text-sm text-amber-200">{rate}%</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default Admin;
