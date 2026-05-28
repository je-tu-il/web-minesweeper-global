import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { subscribeRoom } from "@/lib/firestore";
import { useGameStore } from "@/store/gameStore";
import { GameBoard } from "@/components/GameBoard";
import { RoomChat } from "@/components/RoomChat";
import type { Room } from "@/types";
import { ArrowLeft, Eye, Users } from "lucide-react";

export default function Spectate() {
  const { roomId } = useParams();
  const [room, setRoom] = useState<Room | null>(null);
  const { restoreFromSync, resetGame } = useGameStore();

  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeRoom(roomId, (r) => {
      setRoom(r);
      if (r) {
        const firstPlayer = Object.values(r.players)[0];
        // Restaurer l'état du jeu localement à chaque mise à jour (lecture seule)
        restoreFromSync(
          r.gridConfig,
          r.seed,
          r.mode,
          firstPlayer?.revealedCells || [],
          firstPlayer?.flaggedCells || [],
          firstPlayer?.questionCells || [],
          firstPlayer?.explodedCellId,
          r.firstClick
        );
      }
    });
    return () => {
      unsub();
      resetGame();
    };
  }, [roomId, restoreFromSync, resetGame]);

  if (!room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#03070c] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        <p className="mt-4 text-slate-400">Connexion à la partie...</p>
        <Link to="/" className="mt-4 text-cyan-300 hover:underline">
          Retour au lobby
        </Link>
      </main>
    );
  }

  const players = Object.values(room.players);

  return (
    <main className="min-h-screen overflow-hidden bg-[#03070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />
      
      <div className="relative mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-sm font-bold text-cyan-200">
            <Eye className="h-4 w-4" />
            Mode Spectateur
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Area */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-400" />
                <span className="font-semibold text-white">
                  {players.map(p => p.username).join(" vs ")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xs uppercase tracking-widest text-slate-500">
                  {room.mode === "solo" ? "Solo" : room.mode === "duel" ? "Duel" : "Tour par tour"}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">
                  {room.gridConfig.width}×{room.gridConfig.height}
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              {/* Le plateau est toujours disabled en spectateur */}
              <GameBoard onCellClick={() => {}} onCellRightClick={() => {}} disabled={true} isSpectator={true} />
            </div>
          </div>

          {/* Chat Sidebar */}
          <aside className="h-[600px]">
            <RoomChat roomId={room.roomId} />
          </aside>
        </div>
      </div>
    </main>
  );
}
