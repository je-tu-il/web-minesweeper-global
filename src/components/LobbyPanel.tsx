import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { subscribeRooms, joinRoom, deleteRoom, leaveRoom, addGameToHistory } from "@/lib/firestore";
import type { Room } from "@/types";
import { createEmptyGame } from "@/lib/gameEngine";
import { Plus, Users, Crosshair, Swords, Clock, Trash2, LogIn, LogOut, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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

    const playerCount = Object.keys(room.players || {}).length;
    const isAlreadyIn = room.players && room.players[userProfile.uid];

    // Si déjà dans la room, juste naviguer et restaurer l'état
    if (isAlreadyIn) {
      if (room.status === "playing" || room.status === "finished") {
        restoreFromSync(
          room.gridConfig,
          room.seed,
          room.mode,
          room.players[userProfile.uid]?.revealedCells || [],
          room.players[userProfile.uid]?.flaggedCells || [],
          room.players[userProfile.uid]?.questionCells || [],
          room.players[userProfile.uid]?.explodedCellId,
          room.firstClick
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
    try {
      const room = activeRooms.find((r) => r.roomId === roomId);
      if (room && userProfile) {
        const hasStarted = room.firstClick || (room.players[userProfile.uid]?.revealedCells?.length ?? 0) > 0;
        if (hasStarted) {
          if (!window.confirm("Attention ! Vous avez déjà commencé cette partie. La supprimer comptera comme une DÉFAITE. Continuer ?")) {
            return;
          }
          await addGameToHistory(userProfile.uid, room, { ...createEmptyGame(room.gridConfig), result: "lost" }, 0);
        }
      }

      // If deleting the currently active room, go back to lobby
      const currentRoomId = useUiStore.getState().selectedRoomId;
      if (currentRoomId === roomId) {
        setSelectedRoomId(null);
        setActivePanel("lobby");
      }
      await deleteRoom(roomId);
    } catch (e) {
      toast.error("Impossible de supprimer la partie (Permissions insuffisantes ?)");
      console.error(e);
    }
  };

  const handleLeave = async (roomId: string) => {
    if (userProfile) {
      await leaveRoom(roomId, userProfile.uid);
    }
  };

  const renderRoom = (room: Room) => {
    const ModeIcon = modeIcons[room.mode] || Crosshair;
    const playerCount = Object.keys(room.players || {}).length;
    const isCreator = room.createdBy === userProfile?.uid;
    const isInRoom = userProfile ? !!(room.players && room.players[userProfile.uid]) : false;
    const canJoin = room.status === "waiting" && playerCount < room.maxPlayers && !isInRoom;
    const creator = Object.values(room.players || {}).find((p) => p.uid === room.createdBy);

    return (
      <div
        key={room.roomId}
        className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition hover:bg-white/[0.06] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
            <ModeIcon className="h-4 w-4 text-cyan-200" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">{modeLabels[room.mode]}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[room.status]}`}>
                {statusLabels[room.status]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
              {creator ? (
                <Link to={`/profile/${creator.uid}`} className="truncate text-cyan-300 hover:underline max-w-[100px]">
                  {creator.username}
                </Link>
              ) : (
                "?"
              )}
              <span>·</span>
              <span className="shrink-0">{room.gridConfig.width}×{room.gridConfig.height}</span>
              <span>·</span>
              <span className="shrink-0">{playerCount}/{room.maxPlayers}</span>
              <span>·</span>
              <span className="shrink-0">{new Date(room.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
          {(canJoin || isInRoom) && (
            <button
              onClick={() => handleJoin(room)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                isInRoom
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                  : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200 hover:bg-cyan-300/20"
              }`}
            >
              {isInRoom ? (
                <span className="flex items-center gap-1">
                  <LogIn className="h-3 w-3" />
                  Reprendre
                </span>
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
          {room.status === "playing" && !isInRoom && (
            <Link
              to={`/spectate/${room.roomId}`}
              className="rounded-lg border border-slate-400/20 bg-slate-400/10 p-1.5 text-slate-300 transition hover:bg-slate-400/20"
              title="Spectateur"
            >
              <Eye className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    );
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
          Object.entries((Object as any).groupBy(activeRooms, (r: Room) => r.createdBy)).map(([creatorId, creatorRooms]: [string, any]) => {
            if (!creatorRooms) return null;
            if (creatorRooms.length > 2) {
              const username = Object.values(creatorRooms[0].players || {}).find((p: any) => p.uid === creatorId)?.username || "Joueur";
              return (
                <details key={creatorId} className="group rounded-xl border border-white/5 bg-white/[0.03]">
                  <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold text-white hover:bg-white/[0.03]">
                    <span>Parties de {username} ({creatorRooms.length})</span>
                    <span className="text-xs text-slate-500 transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  <div className="flex flex-col gap-2 p-2 pt-0">
                    {creatorRooms.map((room: Room) => renderRoom(room))}
                  </div>
                </details>
              );
            }
            return creatorRooms.map((room: Room) => renderRoom(room));
          })
        )}
      </div>
    </section>
  );
}
