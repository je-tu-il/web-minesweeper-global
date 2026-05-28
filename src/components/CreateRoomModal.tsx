import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { createRoom, joinRoom } from "@/lib/firestore";
import { GRID_PRESETS, type RoomMode, type GridConfig } from "@/types";
import { Crosshair, Swords, Clock, X, Settings2 } from "lucide-react";

const modes: { value: RoomMode; label: string; desc: string; icon: typeof Crosshair }[] = [
  { value: "solo", label: "Solo", desc: "Seul contre le chronomètre", icon: Crosshair },
  { value: "duel", label: "Duel", desc: "Course contre un adversaire", icon: Swords },
  { value: "turn-based", label: "Tour par tour", desc: "Un clic chacun à tour de rôle", icon: Clock },
];

const difficulties = Object.entries(GRID_PRESETS).map(([key, value]) => ({
  key,
  label: value.label,
}));
difficulties.push({ key: "custom", label: "Personnalisé" });

export function CreateRoomModal() {
  const { userProfile, isBanned } = useAuth();
  const { setShowCreateRoomModal, setSelectedRoomId, setActivePanel } = useUiStore();
  const { initSoloGame, initDuelGame, initTurnBasedGame } = useGameStore();

  const [selectedMode, setSelectedMode] = useState<RoomMode>("solo");
  const [selectedDifficulty, setSelectedDifficulty] = useState("beginner");
  
  const [customWidth, setCustomWidth] = useState(10);
  const [customHeight, setCustomHeight] = useState(10);
  const [customMines, setCustomMines] = useState(15);
  
  const [loading, setLoading] = useState(false);

  const config: GridConfig = useMemo(() => {
    if (selectedDifficulty === "custom") {
      const maxMines = Math.max(1, customWidth * customHeight - 9);
      return { width: customWidth, height: customHeight, mines: Math.min(customMines, maxMines) };
    }
    return GRID_PRESETS[selectedDifficulty];
  }, [selectedDifficulty, customWidth, customHeight, customMines]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
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
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <span className="text-center text-[10px] leading-tight text-slate-500 hidden sm:block">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Difficulté */}
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Difficulté</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {difficulties.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDifficulty(d.key)}
              className={`flex-1 min-w-[80px] rounded-xl border px-3 py-2 text-sm font-medium transition ${
                selectedDifficulty === d.key
                  ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Custom Grid Controls */}
        {selectedDifficulty === "custom" && (
          <div className="mb-5 space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
              <Settings2 className="h-4 w-4 text-slate-400" />
              Paramètres personnalisés
            </div>
            <div>
              <label className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                <span>Largeur</span>
                <span className="text-white">{customWidth}</span>
              </label>
              <input 
                type="range" min="5" max="50" value={customWidth} 
                onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                className="w-full accent-cyan-300"
              />
            </div>
            <div>
              <label className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                <span>Hauteur</span>
                <span className="text-white">{customHeight}</span>
              </label>
              <input 
                type="range" min="5" max="50" value={customHeight} 
                onChange={(e) => setCustomHeight(parseInt(e.target.value))}
                className="w-full accent-cyan-300"
              />
            </div>
            <div>
              <label className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                <span>Mines</span>
                <span className="text-white">{Math.min(customMines, Math.max(1, customWidth * customHeight - 9))}</span>
              </label>
              <input 
                type="range" min="1" max={Math.max(1, customWidth * customHeight - 9)} value={customMines} 
                onChange={(e) => setCustomMines(parseInt(e.target.value))}
                className="w-full accent-red-400"
              />
            </div>
          </div>
        )}

        {/* Résumé */}
        <div className="mb-5 rounded-xl bg-white/[0.04] p-3 text-sm text-slate-400 text-center">
          <span className="font-bold text-white">{config.width}×{config.height}</span> — <span className="font-bold text-red-300">{config.mines} mines</span>
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
