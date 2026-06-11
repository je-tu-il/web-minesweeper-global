import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { UserCircle, X, Upload } from "lucide-react";
import { checkUsernameExists } from "@/lib/firestore";

export function UsernameModal() {
  const { userProfile, updateProfile } = useAuth();
  const { showUsernameModal, setShowUsernameModal } = useUiStore();
  
  const [username, setUsername] = useState(userProfile?.username || "");
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!showUsernameModal) return null;

  // Si l'utilisateur n'a pas de pseudo, il DOIT en choisir un (pas de bouton fermer)
  const mustChooseUsername = !userProfile?.username;

  const validate = (value: string): string => {
    if (value.length < 3) return "Minimum 3 caractères pour le pseudo";
    if (value.length > 20) return "Maximum 20 caractères pour le pseudo";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Lettres, chiffres et _ uniquement pour le pseudo";
    return "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convertir en jpeg léger (qualité 0.7)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setAvatarUrl(dataUrl);
        setError("");
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const err = validate(username);
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      if (username !== userProfile?.username) {
        const exists = await checkUsernameExists(username);
        if (exists) {
          setError("Ce pseudo est déjà pris");
          setLoading(false);
          return;
        }
      }

      await updateProfile({ username, avatarUrl });
      setShowUsernameModal(false);
    } catch {
      setError("Erreur lors de la sauvegarde");
    }
    setLoading(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => {
        if (!mustChooseUsername) setShowUsernameModal(false);
      }}
    >
      <div 
        className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
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
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/50"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Photo de profil</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <Upload className="h-4 w-4" />
                Uploader une image
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
              />
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Ou collez une URL"
                className="flex-[2] rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </div>
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
