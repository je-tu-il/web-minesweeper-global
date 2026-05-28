import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, followUser, unfollowUser } from "@/lib/firestore";
import { useUiStore } from "@/store/uiStore";
import { ACHIEVEMENTS, TIER_COLORS, type UserProfile } from "@/types";
import { User, Trophy, Flame, Swords, ArrowLeft, UserPlus, UserMinus, Settings } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { uid } = useParams();
  const { userProfile: myProfile, refreshProfile } = useAuth();
  const { setShowUsernameModal } = useUiStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const targetUid = uid || myProfile?.uid;
  const isMe = myProfile?.uid === targetUid;

  useEffect(() => {
    if (!targetUid) return;
    setLoading(true);
    getUserProfile(targetUid).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [targetUid]);

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
  const winRate = profile.stats.totalWins + profile.stats.totalLosses > 0
    ? Math.round((profile.stats.totalWins / (profile.stats.totalWins + profile.stats.totalLosses)) * 100)
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
          <div className="flex items-center gap-6">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.username} className="h-24 w-24 rounded-3xl object-cover shadow-lg" />
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-3xl bg-cyan-300/10 text-cyan-300">
                <User className="h-12 w-12" />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-black text-white">{profile.username}</h1>
              <p className="mt-2 text-slate-400">
                Membre depuis le {new Date(profile.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-3 flex gap-4 text-sm font-medium">
                <span className="text-slate-300"><strong className="text-white">{profile.friends?.length || 0}</strong> abonnés</span>
                <span className="text-slate-300"><strong className="text-white">{profile.following?.length || 0}</strong> abonnements</span>
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

        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          {/* Stats Sidebar */}
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-4 flex items-center gap-2 text-white">
                <Trophy className="h-5 w-5 text-amber-300" />
                <h2 className="text-lg font-bold">Statistiques</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Victoires</span>
                  <span className="font-mono text-xl font-black text-emerald-400">{profile.stats.totalWins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Défaites</span>
                  <span className="font-mono text-xl font-black text-red-400">{profile.stats.totalLosses}</span>
                </div>
                <div className="h-px w-full bg-white/10" />
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Win Rate</span>
                  <span className="text-lg font-bold text-cyan-300">{winRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-400"><Flame className="h-4 w-4 text-orange-400" /> Série max</span>
                  <span className="font-mono text-lg font-bold text-orange-400">{profile.stats.bestWinStreak || 0}</span>
                </div>
              </div>
            </section>
          </div>

          {/* Achievements Grid */}
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
      </div>
    </main>
  );
}
