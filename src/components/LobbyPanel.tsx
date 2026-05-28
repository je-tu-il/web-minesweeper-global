import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { subscribeRooms, joinRoom, deleteRoom, leaveRoom } from "@/lib/firestore";
import type { Room } from "@/types";
import { Plus, Users, Crosshair, Swords, Clock, Trash2, LogIn, LogOut } from "lucide-react";

const modeIcons: Record<string, typeof Crosshair> = {
  solo: Crosshair,
  duel: Swords,
  "turn-based": Clock,
};

const modeLabels: Record<string, string> = {
  solo: "Solo",
  duel: "Duel",
  "turn-based": "Tour par tour",
};

const statusLabels: Record<string, string> = {
  waiting: "En attente",
  playing: "En cours",
  finished: "Terminée",
};

const statusColors: Record<string, string> = {
  waiting: "bg-amber-400/15 text-amber-200",
  playing: "bg-emerald-400/15 text-emerald-200",
  finished: "bg-slate-400/15 text-slate-400",
};

export function LobbyPanel() {
  const { userProfile, isBanned } = useAuth();
  const { setSelectedRoomId, setActivePanel, setShowCreateRoomModal } = useUiStore();
  const { initSoloGame, initDuelGame, initTurnBasedGame, restoreFromSync } = useGameStore();
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const unsub = subscribeRooms(setRooms);
    return unsub;
  }, []);

  const activeRooms = rooms.filter((r) => r.status !== "finished");

  const handleJoin = async (room: Room) => {
    if (!userProfile) return;

    const playerCount = Object.keys(room.players).length;
    const isAlreadyIn = room.players[userProfile.uid];

    // Si déjà dans la room, juste naviguer et restaurer l'état
    if (isAlreadyIn) {
      if (room.status === "playing" || room.status === "finished") {
        restoreFromSync(
          room.gridConfig,
          room.seed,
          room.mode,
          room.revealedCells || [],
          room.flaggedCells || [],
          room.questionCells || [],
          room.explodedCellId
        );
      } else {
        // En attente
        const trap = isBanned;
        if (room.mode === "duel") initDuelGame(room.gridConfig, room.seed, trap);
        else initTurnBasedGame(room.gridConfig, trap);
      }
      setSelectedRoomId(room.roomId);
      setActivePanel("game");
      return;
    }

    // Rejoindre la room
    if (room.status !== "waiting" || playerCount >= room.maxPlayers) return;

    await joinRoom(room.roomId, userProfile.uid, {
      uid: userProfile.uid,
      username: userProfile.username,
      score: 0,
      revealedCount: 0,
      result: "playing",
    });

    const trap = isBanned;
    if (room.mode === "duel") initDuelGame(room.gridConfig, room.seed, trap);
    else initTurnBasedGame(room.gridConfig, trap);

    setSelectedRoomId(room.roomId);
    setActivePanel("game");
  };

  const handleDelete = async (roomId: string) => {
    await deleteRoom(roomId);
  };

  const handleLeave = async (roomId: string) => {
    if (userProfile) {
      await leaveRoom(roomId, userProfile.uid);
    }
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-200" />
          <h2 className="text-lg font-bold text-white">Salon de jeu</h2>
        </div>
        <button
          onClick={() => setShowCreateRoomModal(true)}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
        >
          <Plus className="h-4 w-4" />
          Créer
        </button>
      </div>

      <div className="space-y-2">
        {activeRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
            Aucune partie en cours.
            <br />
            Crée la première !
          </div>
        ) : (
          activeRooms.map((room) => {
            const ModeIcon = modeIcons[room.mode] || Crosshair;
            const playerCount = Object.keys(room.players).length;
            const isCreator = room.createdBy === userProfile?.uid;
            const isInRoom = userProfile ? !!room.players[userProfile.uid] : false;
            const canJoin = room.status === "waiting" && playerCount < room.maxPlayers && !isInRoom;
            const creatorName = Object.values(room.players).find((p) => p.uid === room.createdBy)?.username || "?";

            return (
              <div
                key={room.roomId}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06]">
                    <ModeIcon className="h-4 w-4 text-cyan-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{modeLabels[room.mode]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[room.status]}`}>
                        {statusLabels[room.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {creatorName} · {room.gridConfig.width}×{room.gridConfig.height} · {playerCount}/{room.maxPlayers}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {(canJoin || isInRoom) && (
                    <button
                      onClick={() => handleJoin(room)}
                      className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/20"
                    >
                      {isInRoom ? (
                        "Reprendre"
                      ) : (
                        <span className="flex items-center gap-1">
                          <LogIn className="h-3 w-3" />
                          Rejoindre
                        </span>
                      )}
                    </button>
                  )}
                  {isCreator ? (
                    <button
                      onClick={() => handleDelete(room.roomId)}
                      className="rounded-lg border border-red-400/20 bg-red-400/10 p-1.5 text-red-300 transition hover:bg-red-400/20"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : isInRoom ? (
                    <button
                      onClick={() => handleLeave(room.roomId)}
                      className="rounded-lg border border-red-400/20 bg-red-400/10 p-1.5 text-red-300 transition hover:bg-red-400/20"
                      title="Quitter"
                    >
                      <LogOut className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
