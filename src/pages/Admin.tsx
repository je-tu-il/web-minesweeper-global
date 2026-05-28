import { useState, useEffect } from "react";
import { Shield, UserX, Users, ArrowLeft, Plus, Trash2, Lock, Edit2, KeyRound, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { 
  getAllUsers, 
  subscribeBannedUsernames, 
  addBannedUsername, 
  removeBannedUsername, 
  resetUserStats, 
  subscribeRooms, 
  deleteRoom, 
  getAdminPassword, 
  deleteUserProfile, 
  updateUsername,
  resetUserAchievements,
  updateAdminPassword,
  createOrUpdateProfile
} from "@/lib/firestore";
import { ACHIEVEMENTS } from "@/types";
import type { UserProfile, Room, GameHistoryEntry } from "@/types";

const Admin = () => {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bannedUsernames, setBannedUsernames] = useState<string[]>([]);
  const [newBan, setNewBan] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Precise User Editing States
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [tempUsername, setTempUsername] = useState("");
  const [tempWins, setTempWins] = useState("");
  const [tempLosses, setTempLosses] = useState("");
  const [tempStreak, setTempStreak] = useState("");
  const [tempBestStreak, setTempBestStreak] = useState("");
  const [tempPlayTime, setTempPlayTime] = useState("");
  const [tempAchievements, setTempAchievements] = useState<string[]>([]);
  const [tempHistory, setTempHistory] = useState<GameHistoryEntry[]>([]);

  // Subscribe to banned list and rooms
  useEffect(() => {
    if (!unlocked) return;
    const unsubBanned = subscribeBannedUsernames(setBannedUsernames);
    const unsubRooms = subscribeRooms(setRooms);
    return () => {
      unsubBanned();
      unsubRooms();
    };
  }, [unlocked]);

  // Load all users
  const loadUsers = () => {
    setLoadingUsers(true);
    getAllUsers().then((u) => {
      setUsers(u);
      setLoadingUsers(false);
    });
  };

  useEffect(() => {
    if (unlocked) loadUsers();
  }, [unlocked]);

  const handleLogin = async () => {
    setIsAuthenticating(true);
    try {
      const realPassword = await getAdminPassword();
      if (realPassword && password === realPassword) {
        setUnlocked(true);
        setError("");
      } else {
        setError("Mot de passe invalide");
      }
    } catch (err) {
      setError("Erreur de connexion à la base de données");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAddBan = async () => {
    const trimmed = newBan.trim();
    if (!trimmed) return;
    try {
      await addBannedUsername(trimmed);
      setNewBan("");
      toast.success(`Pseudo banni : ${trimmed}`);
    } catch (e) {
      toast.error("Impossible d'ajouter ce ban (permissions insuffisantes ?)");
    }
  };

  const handleRemoveBan = async (username: string) => {
    try {
      await removeBannedUsername(username);
      toast.success(`Ban retiré pour : ${username}`);
    } catch (e) {
      toast.error("Impossible de retirer ce ban.");
    }
  };

  const handleResetStats = async (uid: string) => {
    if (confirm("Voulez-vous vraiment réinitialiser les statistiques de ce joueur ?")) {
      await resetUserStats(uid);
      loadUsers();
      toast.success("Statistiques réinitialisées.");
    }
  };

  const handleAdminDeleteRoom = async (roomId: string) => {
    if (confirm("Forcer la suppression de cette partie ?")) {
      try {
        await deleteRoom(roomId);
        toast.success("Partie supprimée avec succès.");
      } catch (e) {
        toast.error("Erreur de suppression (permissions Firestore bloquées ?)");
      }
    }
  };

  const handleMassReset = async () => {
    if (!confirm(`Réinitialiser les statistiques de ${selectedUsers.length} joueurs ?`)) return;
    try {
      await Promise.all(selectedUsers.map(uid => resetUserStats(uid)));
      loadUsers();
      setSelectedUsers([]);
      toast.success("Statistiques réinitialisées en lot.");
    } catch (e) {
      toast.error("Erreur lors de la réinitialisation en lot.");
    }
  };

  const handleMassResetAchievements = async () => {
    if (!confirm(`Réinitialiser les succès de ${selectedUsers.length} joueurs ?`)) return;
    try {
      await Promise.all(selectedUsers.map(uid => resetUserAchievements(uid)));
      loadUsers();
      setSelectedUsers([]);
      toast.success("Succès réinitialisés en lot.");
    } catch (e) {
      toast.error("Erreur lors de la réinitialisation en lot.");
    }
  };

  const handleMassBan = async () => {
    if (!confirm(`Bannir ${selectedUsers.length} joueurs ?`)) return;
    try {
      const usernamesToBan = users.filter(u => selectedUsers.includes(u.uid)).map(u => u.username);
      await Promise.all(usernamesToBan.map(uname => addBannedUsername(uname)));
      setSelectedUsers([]);
      toast.success("Joueurs bannis avec succès.");
    } catch (e) {
      toast.error("Erreur lors du bannissement en lot.");
    }
  };

  const handleMassDelete = async () => {
    if (!confirm(`Attention ! Supprimer DÉFINITIVEMENT ${selectedUsers.length} joueurs ?`)) return;
    try {
      await Promise.all(selectedUsers.map(uid => deleteUserProfile(uid)));
      loadUsers();
      setSelectedUsers([]);
      toast.success("Profils supprimés avec succès.");
    } catch (e) {
      toast.error("Erreur lors de la suppression en lot.");
    }
  };

  const handleUpdateUsername = async (uid: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateUsername(uid, newName.trim());
      loadUsers();
      toast.success("Pseudo modifié avec succès.");
    } catch (e) {
      toast.error("Erreur lors de la modification du pseudo.");
    }
  };

  // Open Player Detail Drawer
  const openPlayerEditor = (u: UserProfile) => {
    setEditingUser(u);
    setTempUsername(u.username || "");
    setTempWins(String(u.stats?.totalWins || 0));
    setTempLosses(String(u.stats?.totalLosses || 0));
    setTempStreak(String(u.stats?.winStreak || 0));
    setTempBestStreak(String(u.stats?.bestWinStreak || 0));
    setTempPlayTime(String(u.stats?.playTime || 0));
    setTempAchievements(u.achievements || []);
    setTempHistory(u.history || []);
  };

  // Save Detailed Changes
  const handleSavePlayerEdit = async () => {
    if (!editingUser) return;
    try {
      await createOrUpdateProfile(editingUser.uid, {
        username: tempUsername.trim(),
        stats: {
          totalWins: parseInt(tempWins) || 0,
          totalLosses: parseInt(tempLosses) || 0,
          winStreak: parseInt(tempStreak) || 0,
          bestWinStreak: parseInt(tempBestStreak) || 0,
          playTime: parseInt(tempPlayTime) || 0,
        },
        achievements: tempAchievements,
        history: tempHistory,
      });
      loadUsers();
      setEditingUser(null);
      toast.success("Profil mis à jour précisément avec succès !");
    } catch (err) {
      toast.error("Erreur de mise à jour précise.");
    }
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
            disabled={isAuthenticating}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
          >
            {isAuthenticating ? "Vérification..." : "Accéder"}
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
    <main className="min-h-screen bg-[#03070c] text-slate-100 pb-16">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.12),transparent_28%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 text-slate-950">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au jeu
            </Link>
          </div>
        </header>


        <div className="grid gap-6 lg:grid-cols-[1.2fr_2fr]">
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
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-cyan-200" />
                <h2 className="text-xl font-bold">Tous les joueurs</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{users.length}</span>
              </div>
              
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5">
                  <span className="text-xs text-slate-400">{selectedUsers.length} sélectionné(s) :</span>
                  <button onClick={handleMassReset} className="rounded-lg bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-400/30">
                    Reset Stats
                  </button>
                  <button onClick={handleMassResetAchievements} className="rounded-lg bg-cyan-400/20 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-400/30">
                    Reset Succès
                  </button>
                  <button onClick={handleMassBan} className="rounded-lg bg-red-400/20 px-2.5 py-1 text-xs font-bold text-red-300 hover:bg-red-400/30">
                    Bannir
                  </button>
                  <button onClick={handleMassDelete} className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400 hover:bg-red-500/30">
                    Supprimer
                  </button>
                </div>
              )}
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
                    <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-2 px-3 text-xs uppercase tracking-wider text-slate-600">
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.length === users.length} 
                        onChange={(e) => setSelectedUsers(e.target.checked ? users.map(u => u.uid) : [])}
                        className="rounded border-white/10 bg-white/5 accent-cyan-400 cursor-pointer"
                      />
                      <span>Pseudo</span>
                      <span className="text-center">W</span>
                      <span className="text-center">L</span>
                      <span className="text-center">Ratio</span>
                      <span className="text-center"></span>
                    </div>
                    {users.map((u) => {
                      const total = (u.stats?.totalWins || 0) + (u.stats?.totalLosses || 0);
                      const rate = total > 0 ? Math.round(((u.stats?.totalWins || 0) / total) * 100) : 0;
                      const isBanned = bannedUsernames.includes(u.username);
                      const isSelected = selectedUsers.includes(u.uid);
                      
                      return (
                        <div
                          key={u.uid}
                          className={`grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-2 rounded-xl px-3 py-2.5 transition ${
                            isSelected ? "bg-cyan-400/10 border border-cyan-400/20" : 
                            isBanned ? "bg-red-400/[0.06] border border-red-400/20" : "bg-white/[0.04]"
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => setSelectedUsers(prev => e.target.checked ? [...prev, u.uid] : prev.filter(id => id !== u.uid))}
                            className="rounded border-white/10 bg-white/5 accent-cyan-400 cursor-pointer"
                          />
                          <span className="flex items-center gap-2 text-sm text-white truncate cursor-pointer" onClick={() => {
                            const newName = prompt("Nouveau pseudo :", u.username);
                            if (newName) handleUpdateUsername(u.uid, newName);
                          }}>
                            {u.username || <span className="italic text-slate-500">Sans pseudo</span>}
                            {u.role === "admin" && (
                              <Shield className="h-3 w-3 text-amber-300" />
                            )}
                            {isBanned && (
                              <span className="rounded bg-red-400/20 px-1.5 py-0.5 text-[10px] text-red-300">BAN</span>
                            )}
                          </span>
                          <span className="text-center text-sm text-emerald-300">{u.stats?.totalWins || 0}</span>
                          <span className="text-center text-sm text-red-300">{u.stats?.totalLosses || 0}</span>
                          <span className="text-center text-sm text-amber-200">{rate}%</span>
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => openPlayerEditor(u)}
                              className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-cyan-400 transition"
                              title="Édition précise (Stats, Succès, Historique)"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleResetStats(u.uid)}
                              className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-amber-400 transition"
                              title="Réinitialiser les stats"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Active Rooms */}
        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xl font-bold">Parties en cours</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{rooms.length}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune partie.</p>
            ) : (
              rooms.map((room) => (
                <div key={room.roomId} className="flex flex-col justify-between rounded-xl bg-white/[0.04] p-3">
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white uppercase tracking-wider">{room.mode}</span>
                      <span className="text-xs text-slate-400">{room.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      ID: {room.roomId.slice(0, 8)}... | Joueurs: {Object.keys(room.players || {}).length}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdminDeleteRoom(room.roomId)}
                    className="flex w-full items-center justify-center gap-1 rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Precise Editor Drawer/Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-bold text-white">
                  Éditeur Précis : {editingUser.username || "Sans pseudo"}
                </h2>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              {/* Pseudo & Role */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Pseudo</label>
                  <input
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    type="text"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-white outline-none transition focus:border-cyan-300/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">UID (Lecture seule)</label>
                  <input
                    value={editingUser.uid}
                    readOnly
                    type="text"
                    className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-slate-500 outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Stats values */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Valeurs Statistiques</h3>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
                  {[
                    { label: "Victoires", val: tempWins, set: setTempWins },
                    { label: "Défaites", val: tempLosses, set: setTempLosses },
                    { label: "Série act.", val: tempStreak, set: setTempStreak },
                    { label: "Série max.", val: tempBestStreak, set: setTempBestStreak },
                    { label: "Temps (s)", val: tempPlayTime, set: setTempPlayTime },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <label className="text-[10px] font-bold text-slate-400 mb-1 block truncate">{stat.label}</label>
                      <input
                        value={stat.val}
                        onChange={(e) => stat.set(e.target.value)}
                        type="number"
                        min="0"
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white outline-none text-center focus:border-cyan-300/40"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements checkboxes */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">
                  Succès Débloqués ({tempAchievements.length} / {ACHIEVEMENTS.length})
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-white/5 bg-black/40 rounded-xl">
                  {ACHIEVEMENTS.map((ach) => {
                    const hasAch = tempAchievements.includes(ach.id);
                    return (
                      <label 
                        key={ach.id} 
                        className={`flex items-center gap-2 text-xs p-1.5 rounded-lg border cursor-pointer transition ${
                          hasAch ? "border-cyan-300/20 bg-cyan-400/5 text-cyan-200" : "border-transparent text-slate-400 hover:bg-white/[0.02]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={hasAch}
                          onChange={(e) => {
                            setTempAchievements(prev => e.target.checked ? [...prev, ach.id] : prev.filter(id => id !== ach.id));
                          }}
                          className="rounded border-white/10 bg-white/5 accent-cyan-400 cursor-pointer"
                        />
                        <span className="truncate">{ach.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* History list */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">
                  Historique des Parties ({tempHistory.length})
                </h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-3 border border-white/5 bg-black/40 rounded-xl">
                  {tempHistory.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-4">Aucune partie dans l'historique.</p>
                  ) : (
                    tempHistory.map((game) => (
                      <div key={game.id} className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/5 px-3 py-2 rounded-xl hover:border-white/10">
                        <div className="flex gap-3 items-center">
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase ${game.result === "won" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                            {game.result === "won" ? "Victoire" : "Défaite"}
                          </span>
                          <span className="text-slate-300 font-medium capitalize">
                            {game.difficulty} ({game.mode}) — {game.time}s
                          </span>
                        </div>
                        <button
                          onClick={() => setTempHistory(prev => prev.filter(g => g.id !== game.id))}
                          className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition"
                          title="Supprimer cette partie"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-white/5 pt-4 mt-4">
              <button
                onClick={async () => {
                  if (confirm(`Supprimer définitivement le compte de ${editingUser.username} ?`)) {
                    try {
                      await deleteUserProfile(editingUser.uid);
                      loadUsers();
                      setEditingUser(null);
                      toast.success("Compte supprimé avec succès.");
                    } catch (e) {
                      toast.error("Erreur lors de la suppression du compte.");
                    }
                  }
                }}
                className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20 mr-auto flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Supprimer le compte
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-semibold text-slate-400 hover:bg-white/10"
              >
                Annuler
              </button>
              <button
                onClick={handleSavePlayerEdit}
                className="rounded-xl bg-cyan-300 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-200 flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" /> Enregistrer les modifications
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Admin;
