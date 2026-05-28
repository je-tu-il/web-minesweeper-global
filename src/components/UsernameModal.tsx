import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { UserCircle } from "lucide-react";

export function UsernameModal() {
  const { updateUsername } = useAuth();
  const { setShowUsernameModal } = useUiStore();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = (value: string): string => {
    if (value.length < 3) return "Minimum 3 caractères";
    if (value.length > 20) return "Maximum 20 caractères";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Lettres, chiffres et _ uniquement";
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
      await updateUsername(username);
      setShowUsernameModal(false);
    } catch {
      setError("Erreur lors de la sauvegarde");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-300/15 text-cyan-300">
            <UserCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Choisissez votre pseudo</h2>
            <p className="text-sm text-slate-400">Ce nom sera visible par les autres joueurs</p>
          </div>
        </div>

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

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || username.length < 3}
          className="mt-4 w-full rounded-xl bg-cyan-300 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Enregistrement…" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
