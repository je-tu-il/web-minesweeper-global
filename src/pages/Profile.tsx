import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, followUser, unfollowUser, getAllUsers } from "@/lib/firestore";
import { useUiStore } from "@/store/uiStore";
import { Trophy, Swords, Flame, Clock, CalendarDays, X, User, ArrowLeft, UserPlus, UserMinus, Settings, Users } from "lucide-react";
import { ACHIEVEMENTS, TIER_COLORS, GRID_PRESETS, type UserProfile, type GameHistoryEntry } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { createEmptyGame, generateDuelBoard } from "@/lib/gameEngine";
import { toast } from "sonner";
import { subscribeUserPresence } from "@/lib/firestore";

export default function Profile() {
  const { uid } = useParams();
  const { userProfile: myProfile, refreshProfile } = useAuth();
  const { setShowUsernameModal } = useUiStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "history" | "social">("stats");
  const [selectedGame, setSelectedGame] = useState<GameHistoryEntry | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  const targetUid = uid || myProfile?.uid;
  const isMe = myProfile?.uid === targetUid;

  useEffect(() => {
    if (!targetUid) return;
    setLoading(true);
    
    const load = async () => {
      const [p, users] = await Promise.all([
        getUserProfile(targetUid),
        getAllUsers()
      ]);
      setProfile(p);
      const userMap: Record<string, string> = {};
      users.forEach(u => userMap[u.uid] = u.username);
      setAllUsers(userMap);
      setLoading(false);
    };
    
    load();
    
    if (targetUid) {
      const unsubPresence = subscribeUserPresence(targetUid, (status) => {
        setIsOnline(status === "online");
      });
      return () => unsubPresence();
    }
  }, [targetUid, isMe, myProfile]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#03070c]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#03070c] text-white">
        <h1 className="text-2xl font-bold">Joueur introuvable</h1>
        <Link to="/" className="mt-4 text-cyan-300 hover:underline">
          Retour à l'accueil
        </Link>
      </main>
    );
  }

  const handleFollow = async () => {
    if (!myProfile || isMe) return;
    try {
      await followUser(myProfile.uid, profile.uid);
      setProfile(prev => prev ? { ...prev, friends: [...(prev.friends || []), myProfile.uid] } : prev);
      await refreshProfile();
      toast.success(`Vous suivez désormais ${profile.username}`);
    } catch (e) {
      toast.error("Impossible de suivre cet utilisateur.");
    }
  };

  const handleUnfollow = async () => {
    if (!myProfile || isMe) return;
    try {
      await unfollowUser(myProfile.uid, profile.uid);
      setProfile(prev => prev ? { ...prev, friends: (prev.friends || []).filter(id => id !== myProfile.uid) } : prev);
      await refreshProfile();
      toast.success(`Vous ne suivez plus ${profile.username}`);
    } catch (e) {
      toast.error("Erreur lors du désabonnement.");
    }
  };

  const isFollowing = myProfile?.following?.includes(profile.uid);
  const { totalWins, totalLosses } = profile.stats || { totalWins: 0, totalLosses: 0 };
  const winRate = totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : 0;

  return (
    <main className="min-h-screen overflow-hidden bg-[#03070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />
      
      <div className="relative mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Retour au lobby
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6 rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 backdrop-blur-xl">
          <div className="flex items-center gap-6 relative">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.username} className="h-24 w-24 rounded-3xl object-cover shadow-lg" />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-3xl bg-cyan-300/10 text-cyan-300">
                  <User className="h-12 w-12" />
                </div>
              )}
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-[#03070c] bg-green-500" title="En ligne" />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">{profile.username}</h1>
              <p className="mt-2 text-slate-400">
                Membre depuis le {new Date(profile.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-3 flex gap-4 text-sm font-medium">
                <button onClick={() => setActiveTab("social")} className="text-slate-300 hover:text-white transition">
                  <strong className="text-white">{profile.friends?.length || 0}</strong> abonnés
                </button>
                <button onClick={() => setActiveTab("social")} className="text-slate-300 hover:text-white transition">
                  <strong className="text-white">{profile.following?.length || 0}</strong> abonnements
                </button>
              </div>
            </div>
          </div>

          {isMe ? (
            <button onClick={() => setShowUsernameModal(true)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08]">
              <Settings className="h-4 w-4" /> Modifier
            </button>
          ) : myProfile && (
            isFollowing ? (
              <button onClick={handleUnfollow} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08]">
                <UserMinus className="h-4 w-4" /> Ne plus suivre
              </button>
            ) : (
              <button onClick={handleFollow} className="flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
                <UserPlus className="h-4 w-4" /> Suivre
              </button>
            )
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab("stats")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "stats" ? "bg-cyan-300/10 text-cyan-300" : "text-slate-400 hover:text-white"}`}
          >
            Statistiques & Succès
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "history" ? "bg-cyan-300/10 text-cyan-300" : "text-slate-400 hover:text-white"}`}
          >
            Historique des parties
          </button>
          <button
            onClick={() => setActiveTab("social")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "social" ? "bg-cyan-300/10 text-cyan-300" : "text-slate-400 hover:text-white"}`}
          >
            Réseau
          </button>
        </div>

        {activeTab === "stats" && (
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                <div className="mb-4 flex items-center gap-2 text-white">
                  <Trophy className="h-5 w-5 text-amber-300" />
                  <h2 className="text-lg font-bold">Statistiques</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Victoires</span>
                    <span className="font-mono text-xl font-black text-emerald-400">{totalWins}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Défaites</span>
                    <span className="font-mono text-xl font-black text-red-400">{totalLosses}</span>
                  </div>
                  <div className="h-px w-full bg-white/10" />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Win Rate</span>
                      <span className="text-lg font-bold text-cyan-300">{winRate}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                      <div className="h-full bg-cyan-400 transition-all" style={{ width: `${winRate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400"><Flame className="h-4 w-4 text-orange-400" /> Série max</span>
                    <span className="font-mono text-lg font-bold text-orange-400">{profile.stats?.bestWinStreak || 0}</span>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-6 flex items-center gap-2 text-white">
                <Swords className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-bold">Succès débloqués ({profile.achievements?.length || 0}/{ACHIEVEMENTS.length})</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {ACHIEVEMENTS.map((ach) => {
                  const unlocked = profile.achievements?.includes(ach.id);
                  const color = TIER_COLORS[ach.tier];
                  
                  return (
                    <div
                      key={ach.id}
                      className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                        unlocked
                          ? "border-white/10 bg-white/[0.04]"
                          : "border-transparent bg-white/[0.01] opacity-50 grayscale hover:grayscale-0"
                      }`}
                    >
                      {unlocked && (
                        <div className="absolute -right-4 -top-4 h-16 w-16 opacity-20 blur-2xl" style={{ backgroundColor: color }} />
                      )}
                      <div className="mb-2 text-3xl">{ach.icon}</div>
                      <h3 className="text-sm font-bold text-white">{ach.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{ach.description}</p>
                      
                      <div className="mt-3 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: unlocked ? color : '#64748b', backgroundColor: unlocked ? `${color}20` : '#1e293b' }}>
                        {ach.tier}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === "history" && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="mb-6 text-lg font-bold text-white">Dernières parties</h2>
            {(!profile.history || profile.history.length === 0) ? (
              <p className="text-slate-500">Aucune partie terminée pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {[...profile.history].reverse().map((game) => (
                  <button 
                    key={game.id} 
                    onClick={() => setSelectedGame(game)}
                    className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.06] hover:border-cyan-400/30 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold ${
                        game.result === "won" ? "bg-emerald-400/20 text-emerald-400" : "bg-red-400/20 text-red-400"
                      }`}>
                        {game.result === "won" ? "V" : "D"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white capitalize">{game.difficulty}</span>
                          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-300">
                            {game.mode}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {game.time}s</span>
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatDistanceToNow(game.date, { addSuffix: true, locale: fr })}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "social" && (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="mb-6 text-lg font-bold text-white flex items-center gap-2"><Users className="h-5 w-5" /> Abonnés</h2>
              {(!profile.friends || profile.friends.length === 0) ? (
                <p className="text-slate-500">Aucun abonné.</p>
              ) : (
                <div className="space-y-3">
                  {profile.friends.map(id => (
                    <Link to={`/profile/${id}`} key={id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04]">
                      <div className="h-8 w-8 rounded-full bg-cyan-300/20 grid place-items-center text-cyan-300"><User className="h-4 w-4"/></div>
                      <span className="font-semibold text-white">{allUsers[id] || "Joueur inconnu"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="mb-6 text-lg font-bold text-white flex items-center gap-2"><Users className="h-5 w-5" /> Abonnements</h2>
              {(!profile.following || profile.following.length === 0) ? (
                <p className="text-slate-500">Aucun abonnement.</p>
              ) : (
                <div className="space-y-3">
                  {profile.following.map(id => (
                    <Link to={`/profile/${id}`} key={id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04]">
                      <div className="h-8 w-8 rounded-full bg-cyan-300/20 grid place-items-center text-cyan-300"><User className="h-4 w-4"/></div>
                      <span className="font-semibold text-white">{allUsers[id] || "Joueur inconnu"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* History Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl overflow-hidden flex flex-col max-h-screen">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Partie terminée {selectedGame.result === "won" ? "🏆" : "💥"}
                </h2>
                <p className="text-sm text-slate-400">
                  Temps : {selectedGame.time}s • Difficulté : {selectedGame.difficulty}
                </p>
              </div>
              <button
                onClick={() => setSelectedGame(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto rounded-xl bg-black/40 p-4 border border-white/5 flex items-center justify-center min-h-[300px]">
              {(() => {
                const config = GRID_PRESETS[selectedGame.difficulty] || { width: 10, height: 10, mines: 15 };
                const cellSize = Math.min(30, Math.floor((window.innerWidth > 768 ? 500 : 280) / config.width));
                
                let board = createEmptyGame(config);
                if (selectedGame.seed !== undefined && selectedGame.firstClick) {
                  // We simulate the generation to place the mines
                  board = generateDuelBoard(config, selectedGame.seed);
                  // We don't reveal the whole board, we just show the mines so they can see the solution
                  board.cells = board.cells.map(c => ({
                    ...c,
                    status: "revealed" // Reveal everything for the post-game static view
                  }));
                } else {
                  return <p className="text-slate-500">Plateau non disponible pour cette partie ancienne.</p>;
                }

                return (
                  <div
                    className="mx-auto grid gap-[2px] rounded-lg bg-slate-800 p-[2px] shadow-2xl"
                    style={{
                      gridTemplateColumns: `repeat(${config.width}, ${cellSize}px)`,
                      gridTemplateRows: `repeat(${config.height}, ${cellSize}px)`,
                    }}
                  >
                    {board.cells.map((cell) => (
                      <div
                        key={cell.id}
                        className={`flex items-center justify-center font-bold text-xs ${
                          cell.hasMine 
                            ? "bg-red-600/80 border border-red-700" 
                            : "border border-slate-800/50 bg-[#1e2329]"
                        }`}
                        style={{ width: cellSize, height: cellSize }}
                      >
                        {cell.hasMine ? "✦" : cell.adjacentMines > 0 ? cell.adjacentMines : ""}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
