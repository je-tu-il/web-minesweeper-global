import { useEffect, useState } from "react";
import { ref as rtdbRef, set, remove, onValue, onDisconnect } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { useParams, Link } from "react-router-dom";
import { subscribeRoom, addAchievements } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { GameBoard } from "@/components/GameBoard";
import { createEmptyGame, generateDuelBoard, generateSafeBoardSeeded } from "@/lib/gameEngine";
import type { Room, RoomPlayer } from "@/types";
import { ArrowLeft, Eye, Users } from "lucide-react";
import { useUiStore } from "@/store/uiStore";

export default function Spectate() {
  const { roomId } = useParams();
  const { userProfile, refreshProfile } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [timer, setTimer] = useState(0);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const { setSelectedRoomId } = useUiStore();

  useEffect(() => {
    if (roomId) setSelectedRoomId(roomId);
  }, [roomId, setSelectedRoomId]);

  // Subscribe to room
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeRoom(roomId, (r) => {
      setRoom(r);
    });
    return () => {
      unsub();
    };
  }, [roomId]);

  // Track spectator presence
  useEffect(() => {
    if (!roomId || !userProfile) return;
    const myRef = rtdbRef(rtdb, `liveRoom/${roomId}/spectators/${userProfile.uid}`);
    set(myRef, { username: userProfile.username, joinedAt: Date.now() });
    onDisconnect(myRef).remove();

    // Listen to spectator count
    const specRef = rtdbRef(rtdb, `liveRoom/${roomId}/spectators`);
    const unsub = onValue(specRef, (snap) => {
      setSpectatorCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });

    return () => {
      remove(myRef).catch(() => {});
      unsub();
    };
  }, [roomId, userProfile]);

  // Unlock "Voyeur" achievement
  useEffect(() => {
    if (userProfile && !userProfile.achievements?.includes("first_spectate")) {
      addAchievements(userProfile.uid, ["first_spectate"]).then(() => {
        refreshProfile();
      });
    }
  }, [userProfile, refreshProfile]);

  // Dynamic spectator timer
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (room && room.status === "playing") {
      intervalId = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [room?.status]);

  // Reset timer on fresh room play
  useEffect(() => {
    if (room && room.status === "waiting") {
      setTimer(0);
    }
  }, [room?.status]);

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

  const players = Object.values(room.players || {});

  // Reconstruct board state for a single player
  const getPlayerBoardState = (p: RoomPlayer) => {
    let base = createEmptyGame(room.gridConfig);
    
    // Rebuild the board with the same seed
    if (room.mode === "duel") {
      base = generateDuelBoard(room.gridConfig, room.seed);
    } else if (room.firstClick) {
      base = generateSafeBoardSeeded(base, room.firstClick.x, room.firstClick.y, room.seed);
    } else {
      // No firstClick yet = game hasn't started, show empty board
      return {
        cells: base.cells,
        config: room.gridConfig,
        result: "playing" as const,
        explodedCellId: undefined,
      };
    }

    const revealedSet = new Set(p.revealedCells || []);
    const flaggedSet = new Set(p.flaggedCells || []);
    const questionSet = new Set(p.questionCells || []);

    const cells = base.cells.map((cell) => ({
      ...cell,
      status: revealedSet.has(cell.id) ? ("revealed" as const) : ("hidden" as const),
      mark: flaggedSet.has(cell.id) ? ("flag" as const) : questionSet.has(cell.id) ? ("question" as const) : null,
    }));

    const safeCells = cells.filter((c) => !c.hasMine);
    const won = safeCells.every((c) => c.status === "revealed");
    const lost = !!p.explodedCellId || p.result === "lost";
    const result = won ? "won" : lost ? "lost" : "playing";

    // If lost, reveal all mines on their board
    const finalCells = lost
      ? cells.map(c => c.hasMine ? { ...c, status: "revealed" as const } : c)
      : cells;

    return {
      cells: finalCells,
      config: room.gridConfig,
      result,
      explodedCellId: p.explodedCellId,
    };
  };

  const isDuelSeparate = room.mode === "duel" && room.duelMode === "separate";

  return (
    <main className="min-h-screen overflow-hidden bg-[#03070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />
      
      <div className="relative mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <div className="flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-sm font-bold text-cyan-200">
            <Eye className="h-4 w-4" />
            Mode Spectateur
            <span className="flex items-center gap-1 rounded-full bg-cyan-300/20 px-2 py-0.5 text-xs">
              👀 {spectatorCount}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Area */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-400" />
                <span className="font-semibold text-white">
                  {players.length > 0 ? players.map((p) => p.username).join(" vs ") : "Attente joueurs..."}
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

            {players.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-16 text-center backdrop-blur-xl">
                <p className="text-slate-500">Aucun joueur n'est connecté.</p>
              </div>
            ) : isDuelSeparate ? (
              /* Side-by-side layout in 1v1 separate duels */
              <div className="flex flex-col gap-6 xl:flex-row xl:justify-center items-center">
                {players.map((p) => {
                  const boardState = getPlayerBoardState(p);
                  return (
                    <div key={p.uid} className="flex flex-col items-center gap-3 w-full max-w-lg">
                      <div className="text-sm font-bold text-cyan-300 uppercase tracking-wider">
                        Plateau de {p.username} :{" "}
                        <span className={boardState.result === "won" ? "text-emerald-400" : boardState.result === "lost" ? "text-red-400" : "text-amber-300"}>
                          {boardState.result === "won" ? "Victoire" : boardState.result === "lost" ? "Échec" : "En cours"}
                        </span>
                      </div>
                      <GameBoard
                        onCellClick={() => {}}
                        onCellRightClick={() => {}}
                        disabled={true}
                        isSpectator={true}
                        customCells={boardState.cells}
                        customConfig={boardState.config}
                        customResult={boardState.result}
                        customExplodedCellId={boardState.explodedCellId}
                        customTimer={timer}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Standard merged single-board spectator layout */
              <div className="flex justify-center">
                {(() => {
                  const p = players[0];
                  const boardState = getPlayerBoardState(p);
                  return (
                    <GameBoard
                      onCellClick={() => {}}
                      onCellRightClick={() => {}}
                      disabled={true}
                      isSpectator={true}
                      customCells={boardState.cells}
                      customConfig={boardState.config}
                      customResult={boardState.result}
                      customExplodedCellId={boardState.explodedCellId}
                      customTimer={timer}
                    />
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
