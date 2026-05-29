import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, followUser, unfollowUser, getAllUsers } from "@/lib/firestore";
import { useUiStore } from "@/store/uiStore";
import { Trophy, Swords, Flame, Clock, CalendarDays, X, User, ArrowLeft, UserPlus, UserMinus, Settings, Users, MessageCircle, Shield } from "lucide-react";
import { ACHIEVEMENTS, TIER_COLORS, GRID_PRESETS, type UserProfile, type GameHistoryEntry } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { createEmptyGame, generateDuelBoard } from "@/lib/gameEngine";
import { toast } from "sonner";
import { subscribeUserPresence } from "@/lib/firestore";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";

export default function Profile() {
  const { uid } = useParams();
  const { userProfile: myProfile, refreshProfile } = useAuth();
  const { setShowUsernameModal } = useUiStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "history" | "social" | "records">("stats");
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

  // Calculer l'évolution du winrate sur les 20 dernières parties
  const history = profile.history || [];
  const recentHistory = [...history].sort((a, b) => a.date - b.date).slice(-20);
  
  let tempWins = Math.max(0, totalWins - recentHistory.filter(g => g.result === "won").length);
  let tempTotal = Math.max(0, (totalWins + totalLosses) - recentHistory.length);
  
  const winrateData = recentHistory.map(g => {
    tempTotal++;
    if (g.result === "won") tempWins++;
    return {
      rate: tempTotal > 0 ? Math.round((tempWins / tempTotal) * 100) : 0
    };
  });

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
              {(isOnline || isMe) && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-[#03070c] bg-green-500" title="En ligne" />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-black text-white flex items-center gap-3">
                {profile.username}
                {profile.role === "admin" && (
                  <div title="Administrateur" className="grid h-8 w-8 place-items-center rounded-xl bg-amber-400/20 text-amber-300">
                    <Shield className="h-4 w-4" />
                  </div>
                )}
              </h1>
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

          <div className="flex flex-wrap items-center gap-3">
            {!isMe && myProfile && (
              <button
                onClick={() => useUiStore.getState().setActivePrivateChat({ uid: profile.uid, username: profile.username })}
                className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-5 py-2.5 text-sm font-bold text-cyan-300 transition hover:bg-white/[0.1] border border-cyan-300/20"
              >
                <MessageCircle className="h-4 w-4" /> Discuter
              </button>
            )}
            
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
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab("stats")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "stats" ? "bg-cyan-300/10 text-cyan-300" : "text-slate-400 hover:text-white"}`}
          >
            Statistiques & Succès
          </button>
          <button
            onClick={() => setActiveTab("records")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "records" ? "bg-cyan-300/10 text-cyan-300" : "text-slate-400 hover:text-white"}`}
          >
            Meilleurs Temps
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

        {activeTab === "stats" && (() => {
          const CATEGORIZED_ACHIEVEMENTS = [
            {
              title: "Désamorceur",
              desc: "Remporter des victoires sur les différentes grilles de base.",
              icon: "🏆",
              tiers: [
                { id: "win_beginner", label: "Débutant", tier: "bronze" as const },
                { id: "win_intermediate", label: "Intermédiaire", tier: "silver" as const },
                { id: "win_expert", label: "Expert", tier: "gold" as const },
                { id: "win_custom_hard", label: "Légende (25×25+)", tier: "diamond" as const },
              ]
            },
            {
              title: "Puriste",
              desc: "Gagner des parties sans poser un seul drapeau de repérage.",
              icon: "🏴",
              tiers: [
                { id: "no_flag_beginner", label: "Débutant", tier: "bronze" as const },
                { id: "no_flag_intermediate", label: "Intermédiaire", tier: "silver" as const },
                { id: "no_flag_expert", label: "Expert", tier: "gold" as const },
              ]
            },
            {
              title: "Speedrunner",
              desc: "Terminer et désamorcer la grille le plus rapidement possible.",
              icon: "⚡",
              tiers: [
                { id: "speed_beginner", label: "Débutant (<15s)", tier: "bronze" as const },
                { id: "speed_intermediate", label: "Intermédiaire (<60s)", tier: "silver" as const },
                { id: "speed_expert", label: "Expert (<120s)", tier: "gold" as const },
              ]
            },
            {
              title: "Série de Victoires",
              desc: "Enchaîner les victoires d'affilée sans aucune défaite.",
              icon: "🔥",
              tiers: [
                { id: "win_streak_3", label: "3 de Suite", tier: "bronze" as const },
                { id: "win_streak_5", label: "5 de Suite", tier: "silver" as const },
                { id: "win_streak_10", label: "10 de Suite", tier: "gold" as const },
              ]
            },
            {
              title: "Accro au Protocol",
              desc: "Cumuler du temps de jeu total en pleine analyse de mines.",
              icon: "⏰",
              tiers: [
                { id: "playtime_1h", label: "1 Heure", tier: "bronze" as const },
                { id: "playtime_10h", label: "10 Heures", tier: "silver" as const },
                { id: "playtime_100h", label: "100 Heures", tier: "diamond" as const },
              ]
            }
          ];

          const SPECIAL_ACHIEVEMENTS = [
            { id: "click_revealed", label: "Succès Louis", tier: "bronze" as const, icon: "🤡", desc: "Cliquer sur une case déjà révélée" },
            { id: "first_duel_win", label: "Rival", tier: "silver" as const, icon: "⚔️", desc: "Gagner un duel" },
            { id: "first_spectate", label: "Voyeur", tier: "bronze" as const, icon: "👀", desc: "Observer une partie" },
            { id: "boom_chain", label: "Malchanceux", tier: "bronze" as const, icon: "🌧️", desc: "Perdre 2 parties de suite" },
            { id: "sweep", label: "Balayage", tier: "silver" as const, icon: "🧹", desc: "Dévoiler plus de 50 cases" },
            { id: "mystere_egirl", label: "E-Girl", tier: "silver" as const, icon: "🌸", desc: "Dire uwu dans le chat global", isHidden: true },
            { id: "mystere_boom_first_click", label: "Pas de chance", tier: "bronze" as const, icon: "💣", desc: "Perdre sur le tout premier clic (impossible normalement)", isHidden: true },
            { id: "mystere_1", label: "Curieux", tier: "bronze" as const, icon: "🔍", desc: "Cliquer sur 5 profils différents", isHidden: true },
          ];

          // S'assurer d'avoir au moins 2 points pour le tracé de la courbe
          const displayData = winrateData.length === 1 
            ? [{ rate: winrateData[0].rate }, { rate: winrateData[0].rate }] 
            : winrateData;

          return (
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
                    
                    {/* Winrate Evolution Chart (Glow & styled AreaChart) */}
                    {displayData.length > 0 && (
                      <div className="mt-4 h-36 w-full">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Évolution du Win Rate</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={displayData}>
                            <defs>
                              <linearGradient id="winrateGlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35}/>
                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#03070c', borderColor: '#22d3ee20', borderRadius: '1rem', color: '#fff' }}
                              itemStyle={{ color: '#22d3ee' }}
                              formatter={(val: number) => [`${val}%`, 'Win Rate']}
                              labelFormatter={() => ''}
                            />
                            <Area type="monotone" dataKey="rate" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#winrateGlow)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-400"><Flame className="h-4 w-4 text-orange-400" /> Série max</span>
                      <span className="font-mono text-lg font-bold text-orange-400">{profile.stats?.bestWinStreak || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-400"><Clock className="h-4 w-4 text-purple-400" /> Temps joué</span>
                      <span className="font-mono text-lg font-bold text-purple-400">
                        {profile.stats?.playTime ? Math.floor(profile.stats.playTime / 3600) + 'h ' + Math.floor((profile.stats.playTime % 3600) / 60) + 'm' : '0m'}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Achievements with Tiers */}
              <div className="space-y-6">
                <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                  <div className="mb-6 flex items-center gap-2 text-white">
                    <Swords className="h-5 w-5 text-cyan-300" />
                    <h2 className="text-lg font-bold">Succès Majeurs (Paliers)</h2>
                  </div>
                  
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    {CATEGORIZED_ACHIEVEMENTS.map((cat) => (
                      <div key={cat.title} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{cat.icon}</span>
                            <h3 className="text-base font-black text-white">{cat.title}</h3>
                          </div>
                          <p className="text-xs text-slate-400 mb-4">{cat.desc}</p>
                        </div>
                        <div className={`grid ${cat.tiers.length === 4 ? "grid-cols-4" : "grid-cols-3"} gap-1.5 border-t border-white/5 pt-3`}>
                          {cat.tiers.map((t) => {
                            const hasAch = profile.achievements?.includes(t.id);
                            const tierColor = TIER_COLORS[t.tier];
                            const badgeIcon = t.tier === "bronze" ? "🥉" : t.tier === "silver" ? "🥈" : t.tier === "gold" ? "🥇" : "💎";
                            return (
                              <div
                                key={t.id}
                                className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                                  hasAch
                                    ? "bg-slate-900/60 border-white/10 scale-100 shadow-[0_0_10px_rgba(255,255,255,0.02)]"
                                    : "border-transparent bg-white/[0.01] opacity-30 grayscale"
                                }`}
                                title={t.label}
                              >
                                <span className="text-lg">{badgeIcon}</span>
                                <span className="text-[9px] font-bold text-center mt-1 text-slate-300 leading-tight w-full break-words whitespace-normal">{t.label}</span>
                                <span className="text-[8px] font-extrabold uppercase tracking-widest mt-0.5" style={{ color: hasAch ? tierColor : "#555" }}>
                                  {t.tier}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                  <div className="mb-4 flex items-center gap-2 text-white">
                    <Trophy className="h-5 w-5 text-amber-300" />
                    <h2 className="text-lg font-bold">Succès Spéciaux & Mystères</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {SPECIAL_ACHIEVEMENTS.map((ach) => {
                      const hasAch = profile.achievements?.includes(ach.id);
                      const isMystery = ach.isHidden && !hasAch;
                      const tierColor = TIER_COLORS[ach.tier];
                      return (
                        <div
                          key={ach.id}
                          className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                            hasAch
                              ? "border-white/10 bg-white/[0.04]"
                              : "border-transparent bg-white/[0.01] opacity-30 grayscale"
                          }`}
                        >
                          {hasAch && (
                            <div className="absolute -right-4 -top-4 h-12 w-12 opacity-15 blur-xl" style={{ backgroundColor: tierColor }} />
                          )}
                          <div className="mb-2 text-2xl">{isMystery ? "❓" : ach.icon}</div>
                          <h3 className="text-xs font-bold text-white truncate">{ach.label}</h3>
                          <p className={`mt-1 text-[10px] text-slate-500 leading-normal ${isMystery ? 'blur-sm select-none' : ''}`}>
                            {isMystery ? 'Secret' : ach.desc}
                          </p>
                          <div className="mt-2.5 inline-block rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider" style={{ color: hasAch ? tierColor : '#64748b', backgroundColor: hasAch ? `${tierColor}15` : '#1e293b' }}>
                            {ach.tier}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          );
        })()}

        {activeTab === "records" && (() => {
          const getBestTime = (diff: string) => {
            const wins = (profile.history || []).filter(g => g.result === "won" && g.difficulty === diff);
            if (wins.length === 0) return null;
            return Math.min(...wins.map(g => g.time));
          };
          const bTime = getBestTime("beginner");
          const iTime = getBestTime("intermediate");
          const eTime = getBestTime("expert");

          return (
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <div className="mb-6 flex items-center justify-center gap-2 text-white">
                <Trophy className="h-5 w-5 text-amber-300" />
                <h2 className="text-lg font-bold">Meilleurs Temps Personnels</h2>
              </div>
              <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto">
                Vos temps records pour désamorcer les grilles standards du protocole principal.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { title: "Débutant", size: "9 × 9", mines: 10, time: bTime, color: "from-emerald-400 to-green-500", glow: "rgba(52,211,153,0.15)" },
                  { title: "Intermédiaire", size: "16 × 16", mines: 40, time: iTime, color: "from-cyan-400 to-blue-500", glow: "rgba(34,211,238,0.15)" },
                  { title: "Expert", size: "30 × 16", mines: 99, time: eTime, color: "from-amber-400 to-orange-500", glow: "rgba(245,158,11,0.15)" },
                ].map((preset) => (
                  <div
                    key={preset.title}
                    className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-slate-950/50 p-6 backdrop-blur-xl transition hover:border-white/15"
                    style={{ boxShadow: `0 10px 30px -10px ${preset.glow}` }}
                  >
                    <div className="mb-2">
                      <span className={`inline-block rounded-full bg-gradient-to-r ${preset.color} px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-950`}>
                        {preset.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{preset.size} · {preset.mines} mines</p>
                    <div className="my-6">
                      {preset.time !== null ? (
                        <p className="font-mono text-4xl font-black text-white">
                          {preset.time}
                          <span className="text-lg font-medium text-slate-400 ml-1">s</span>
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500 font-semibold italic py-2">Non enregistré</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {activeTab === "history" && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="mb-6 text-lg font-bold text-white">Dernières parties</h2>
            {(!profile.history || profile.history.length === 0) ? (
              <p className="text-slate-500">Aucune partie terminée pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {profile.history.map((game) => (
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
