import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { createRoom, joinRoom } from "@/lib/firestore";
import { GRID_PRESETS, type RoomMode, type GridConfig } from "@/types";
import { Crosshair, Swords, Clock, X } from "lucide-react";

const modes: { value: RoomMode; label: string; desc: string; icon: typeof Crosshair }[] = [
  { value: "solo", label: "Solo", desc: "Seul contre le chronomètre", icon: Crosshair },
  { value: "duel", label: "Duel", desc: "Course contre un adversaire", icon: Swords },
  { value: "turn-based", label: "Tour par tour", desc: "Un clic chacun à tour de rôle", icon: Clock },
];

const difficulties: { key: string; label: string }[] = [
  { key: "beginner", label: "Débutant" },
  { key: "intermediate", label: "Intermédiaire" },
  { key: "expert", label: "Expert" },
];

export function CreateRoomModal() {
  const { userProfile, isBanned } = useAuth();
  const { setShowCreateRoomModal, setSelectedRoomId, setActivePanel } = useUiStore();
  const { initSoloGame, initDuelGame, initTurnBasedGame } = useGameStore();

  const [selectedMode, setSelectedMode] = useState<RoomMode>("solo");
  const [selectedDifficulty, setSelectedDifficulty] = useState("beginner");
  const [loading, setLoading] = useState(false);

  const config: GridConfig = GRID_PRESETS[selectedDifficulty];

  const handleCreate = async () => {
    if (!userProfile) return;
    setLoading(true);

    try {
      const seed = Math.floor(Math.random() * 2147483647);
      const maxPlayers = selectedMode === "solo" ? 1 : 2;

      const roomId = await createRoom({
        mode: selectedMode,
        status: selectedMode === "solo" ? "playing" : "waiting",
        gridConfig: config,
        seed,
        players: {},
        turn: userProfile.uid,
        createdBy: userProfile.uid,
        createdAt: Date.now(),
        maxPlayers,
        winner: null,
      });

      // Auto-join
      await joinRoom(roomId, userProfile.uid, {
        uid: userProfile.uid,
        username: userProfile.username,
        score: 0,
        revealedCount: 0,
        result: "playing",
      });

      // Initialiser le jeu localement
      const trap = isBanned;
      if (selectedMode === "solo") {
        initSoloGame(config, trap);
      } else if (selectedMode === "duel") {
        initDuelGame(config, seed, trap);
      } else {
        initTurnBasedGame(config, trap);
      }

      setSelectedRoomId(roomId);
      setActivePanel("game");
      setShowCreateRoomModal(false);
    } catch (err) {
      console.error("Erreur création room:", err);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Créer une partie</h2>
          <button
            onClick={() => setShowCreateRoomModal(false)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode */}
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Mode de jeu</p>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => setSelectedMode(m.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                selectedMode === m.value
                  ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
              }`}
            >
              <m.icon className="h-5 w-5" />
              <span className="text-sm font-semibold">{m.label}</span>
              <span className="text-center text-[10px] leading-tight text-slate-500">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Difficulté */}
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Difficulté</p>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {difficulties.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDifficulty(d.key)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                selectedDifficulty === d.key
                  ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Résumé */}
        <div className="mb-5 rounded-xl bg-white/[0.04] p-3 text-sm text-slate-400">
          {config.width}×{config.height} — {config.mines} mines
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full rounded-xl bg-cyan-300 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Création…" : "Lancer la partie"}
        </button>
      </div>
    </div>
  );
}
