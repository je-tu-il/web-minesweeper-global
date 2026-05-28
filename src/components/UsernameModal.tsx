import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { UserCircle, X } from "lucide-react";

export function UsernameModal() {
  const { userProfile, updateProfile } = useAuth();
  const { showUsernameModal, setShowUsernameModal } = useUiStore();
  
  const [username, setUsername] = useState(userProfile?.username || "");
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!showUsernameModal) return null;

  // Si l'utilisateur n'a pas de pseudo, il DOIT en choisir un (pas de bouton fermer)
  const mustChooseUsername = !userProfile?.username;

  const validate = (value: string): string => {
    if (value.length < 3) return "Minimum 3 caractères pour le pseudo";
    if (value.length > 20) return "Maximum 20 caractères pour le pseudo";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Lettres, chiffres et _ uniquement pour le pseudo";
    return "";
  };

  const submit = async () => {
    const err = validate(username);
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      await updateProfile({ username, avatarUrl });
      setShowUsernameModal(false);
    } catch {
      setError("Erreur lors de la sauvegarde");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-300/15 text-cyan-300">
                <UserCircle className="h-6 w-6" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{mustChooseUsername ? "Choisissez votre pseudo" : "Modifier le profil"}</h2>
              <p className="text-sm text-slate-400">Ce profil sera visible par les autres joueurs</p>
            </div>
          </div>
          {!mustChooseUsername && (
            <button
              onClick={() => setShowUsernameModal(false)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Pseudo</label>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="MonPseudo_42"
              maxLength={20}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/50"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">URL Photo (optionnel)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="https://exemple.com/photo.jpg"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/50 text-sm"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || username.length < 3}
          className="mt-6 w-full rounded-xl bg-cyan-300 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Enregistrement…" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
