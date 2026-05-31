import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { createRoom, joinRoom } from "@/lib/firestore";
import { GRID_PRESETS, type RoomMode, type GridConfig } from "@/types";
import { Crosshair, Swords, Clock, X, Settings2, ShieldCheck, HelpCircle, Users } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { toast } from "sonner";

const modes: { value: RoomMode; label: string; desc: string; icon: typeof Crosshair }[] = [
  { value: "solo", label: "Solo", desc: "Seul contre le chronomètre", icon: Crosshair },
  { value: "duel", label: "Duel", desc: "Course contre un adversaire", icon: Swords },
  { value: "turn-based", label: "Tour par tour", desc: "Un clic chacun à tour de rôle", icon: Clock },
  { value: "coop", label: "Co-op", desc: "Déminer ensemble sur la même grille", icon: Users },
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
  const [duelMode, setDuelMode] = useState<"shared" | "separate">("shared");
  const [selectedDifficulty, setSelectedDifficulty] = useState("beginner");
  
  const [customWidth, setCustomWidth] = useState("10");
  const [customHeight, setCustomHeight] = useState("10");
  const [customMines, setCustomMines] = useState("15");
  const [pureLogic, setPureLogic] = useState(false);
  
  const [loading, setLoading] = useState(false);

  const config: GridConfig = useMemo(() => {
    let finalConfig = GRID_PRESETS[selectedDifficulty];
    if (selectedDifficulty === "custom") {
      const w = Math.max(5, Math.min(50, parseInt(customWidth) || 10));
      const h = Math.max(5, Math.min(50, parseInt(customHeight) || 10));
      // Max mines is width * height - 9 to ensure an opening click is possible
      const maxMines = (w * h) - 9;
      const m = Math.max(1, Math.min(maxMines, parseInt(customMines) || 15));
      finalConfig = { width: w, height: h, mines: m };
    }
    return { ...finalConfig, pureLogic };
  }, [selectedDifficulty, customWidth, customHeight, customMines, pureLogic]);

  const handleCreate = async () => {
    if (!userProfile) return;
    setLoading(true);

    try {
      const snap = await getDocs(query(collection(firestore, "rooms"), where("createdBy", "==", userProfile.uid), where("status", "in", ["waiting", "playing"]))); 
      if (snap.size >= 5) { 
        toast.error("Vous ne pouvez pas avoir plus de 5 parties en cours."); 
        setLoading(false); 
        return; 
      }

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
        ...(selectedMode === "duel" && { duelMode: duelMode }),
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
      } else if (selectedMode === "coop") {
        useGameStore.getState().initCoopGame(config, seed, trap);
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
          {modes.map((m) => {
            const isDisabled = false;
            return (
              <button
                key={m.value}
                onClick={() => !isDisabled && setSelectedMode(m.value)}
                disabled={isDisabled}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                  selectedMode === m.value
                    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                    : isDisabled 
                      ? "border-white/5 bg-white/[0.01] text-slate-600 cursor-not-allowed opacity-50"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                }`}
              >
                <m.icon className="h-5 w-5" />
                <span className="text-sm font-semibold">{m.label} {isDisabled && "(Bientôt)"}</span>
                <span className="text-center text-[10px] leading-tight text-slate-500 hidden sm:block">{m.desc}</span>
              </button>
            );
          })}
        </div>

        {selectedMode === "duel" && (
          <div className="mb-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Type de Duel</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDuelMode("shared")}
                className={`flex-1 flex flex-col items-center gap-1.5 rounded-lg border p-3 transition ${
                  duelMode === "shared"
                    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                }`}
              >
                <span className="text-sm font-semibold">Même grille</span>
                <span className="text-center text-[10px] text-slate-500">Bataille Royale</span>
              </button>
              <button
                onClick={() => setDuelMode("separate")}
                className={`flex-1 flex flex-col items-center gap-1.5 rounded-lg border p-3 transition ${
                  duelMode === "separate"
                    ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                }`}
              >
                <span className="text-sm font-semibold">Côte à côte</span>
                <span className="text-center text-[10px] text-slate-500">Course de vitesse</span>
              </button>
            </div>
          </div>
        )}

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
          <div className="mb-5 space-y-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
              <Settings2 className="h-4 w-4 text-slate-400" />
              Paramètres personnalisés
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                <span>Largeur</span>
                <input 
                  type="number" min="5" max="50" value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  className="w-16 bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-right outline-none focus:border-cyan-300/50"
                />
              </div>
              <input 
                type="range" min="5" max="50" value={customWidth} 
                onChange={(e) => setCustomWidth(e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                <span>Hauteur</span>
                <input 
                  type="number" min="5" max="50" value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  className="w-16 bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-right outline-none focus:border-cyan-300/50"
                />
              </div>
              <input 
                type="range" min="5" max="50" value={customHeight} 
                onChange={(e) => setCustomHeight(e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                <span>Mines (max {Math.max(1, (parseInt(customWidth) || 10) * (parseInt(customHeight) || 10) - 9)})</span>
                <input 
                  type="number" min="1" max={Math.max(1, (parseInt(customWidth) || 10) * (parseInt(customHeight) || 10) - 9)} value={customMines}
                  onChange={(e) => setCustomMines(e.target.value)}
                  className="w-16 bg-black/40 border border-white/10 rounded-md px-2 py-1 text-red-300 text-right outline-none focus:border-red-400/50"
                />
              </div>
              <input 
                type="range" min="1" max={Math.max(1, (parseInt(customWidth) || 10) * (parseInt(customHeight) || 10) - 9)} value={customMines} 
                onChange={(e) => setCustomMines(e.target.value)}
                className="w-full accent-red-400 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Options additionnelles */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              Mode Pure Logique
            </span>
            <span className="text-xs text-slate-500">Pas de hasard (1 chance sur 2). 100% logique.</span>
          </div>
          <button
            onClick={() => setPureLogic(!pureLogic)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              pureLogic ? "bg-cyan-400" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                pureLogic ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

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
