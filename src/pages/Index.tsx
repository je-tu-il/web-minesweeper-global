import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { subscribeRoom, updateRoom, updateStats } from "@/lib/firestore";
import { AuthBar } from "@/components/AuthBar";
import { GameBoard } from "@/components/GameBoard";
import { LobbyPanel } from "@/components/LobbyPanel";
import { RoomChat } from "@/components/RoomChat";
import { UsernameModal } from "@/components/UsernameModal";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import { PlayerStats } from "@/components/PlayerStats";
import { Bomb, Swords, Clock, Crosshair, MessageCircle, LayoutGrid } from "lucide-react";
import type { Room } from "@/types";

const Index = () => {
  const { user, userProfile, isLoading, isBanned, signInWithGoogle, refreshProfile } = useAuth();
  const { activePanel, selectedRoomId, showUsernameModal, showCreateRoomModal, setActivePanel, setSelectedRoomId, setShowUsernameModal } = useUiStore();
  const { game, handleReveal, handleFlag, tickTimer, isTimerRunning, initSoloGame, initDuelGame, initTurnBasedGame } = useGameStore();

  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsUpdatedRef = useRef(false);

  // Timer
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(tickTimer, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, tickTimer]);

  // Subscribe to room changes
  useEffect(() => {
    if (!selectedRoomId) {
      roomRef.current = null;
      return;
    }
    const unsub = subscribeRoom(selectedRoomId, (room) => {
      roomRef.current = room;

      if (!room || !userProfile) return;

      const playerCount = Object.keys(room.players).length;

      // Duel/Turn-based: quand le 2e joueur rejoint, passer en "playing"
      if (room.status === "waiting" && playerCount >= room.maxPlayers) {
        updateRoom(room.roomId, { status: "playing" });
        // Initialiser le jeu pour le joueur qui était en attente
        if (room.mode === "duel") {
          initDuelGame(room.gridConfig, room.seed, isBanned);
        } else if (room.mode === "turn-based") {
          initTurnBasedGame(room.gridConfig, isBanned);
        }
      }
    });
    return unsub;
  }, [selectedRoomId, userProfile, isBanned, initDuelGame, initTurnBasedGame]);

  // Update stats when game ends
  useEffect(() => {
    if (game.result !== "playing" && userProfile && selectedRoomId && !statsUpdatedRef.current) {
      statsUpdatedRef.current = true;
      const won = game.result === "won";
      updateStats(userProfile.uid, won);

      // Update room
      updateRoom(selectedRoomId, {
        [`players.${userProfile.uid}.result`]: game.result,
        [`players.${userProfile.uid}.revealedCount`]: game.cells.filter((c) => c.status === "revealed").length,
        ...(won ? { winner: userProfile.uid, status: "finished" } : {}),
      });

      refreshProfile();
    }
  }, [game.result, userProfile, selectedRoomId, game.cells, refreshProfile]);

  // Reset stats flag when starting new game
  useEffect(() => {
    if (game.result === "playing") {
      statsUpdatedRef.current = false;
    }
  }, [game.result]);

  // Prompt for username on first login
  useEffect(() => {
    if (userProfile && !userProfile.username) {
      setShowUsernameModal(true);
    }
  }, [userProfile, setShowUsernameModal]);

  const onCellClick = useCallback(
    (cellId: string) => {
      if (!userProfile || !selectedRoomId) return;
      const room = roomRef.current;

      // Turn-based: vérifier que c'est le tour du joueur
      if (room?.mode === "turn-based" && room.turn !== userProfile.uid) return;

      const newGame = handleReveal(cellId);

      // Turn-based: passer le tour
      if (room?.mode === "turn-based" && newGame.result === "playing") {
        const otherPlayer = Object.keys(room.players).find((uid) => uid !== userProfile.uid);
        if (otherPlayer) {
          updateRoom(selectedRoomId, { turn: otherPlayer });
        }
      }
    },
    [userProfile, selectedRoomId, handleReveal],
  );

  const onCellRightClick = useCallback(
    (cellId: string) => {
      const room = roomRef.current;
      if (room?.mode === "turn-based" && room.turn !== userProfile?.uid) return;
      handleFlag(cellId);
    },
    [userProfile, handleFlag],
  );

  const handleBackToLobby = () => {
    setSelectedRoomId(null);
    setActivePanel("lobby");
  };

  const handleNewGame = () => {
    const room = roomRef.current;
    if (!room) return;
    statsUpdatedRef.current = false;
    if (room.mode === "solo") {
      initSoloGame(room.gridConfig, isBanned);
    } else if (room.mode === "duel") {
      initDuelGame(room.gridConfig, room.seed + 1, isBanned);
    } else {
      initTurnBasedGame(room.gridConfig, isBanned);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#03070c]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
      </main>
    );
  }

  // ── Not logged in ──
  if (!user || !userProfile) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#03070c] text-slate-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(245,158,11,0.16),transparent_25%),linear-gradient(135deg,rgba(15,23,42,0.2),rgba(2,6,23,0.95))]" />
        <div className="pointer-events-none fixed inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
          <div className="mb-8 grid h-20 w-20 place-items-center rounded-3xl bg-cyan-300 text-slate-950 shadow-2xl shadow-cyan-300/30">
            <Bomb className="h-10 w-10" />
          </div>
          <p className="mb-2 text-xs uppercase tracking-[0.5em] text-cyan-200/60">Minesweeper Global</p>
          <h1 className="mb-4 text-center text-4xl font-black tracking-tight text-white sm:text-6xl">
            Competitive Minefield Protocol
          </h1>
          <p className="mb-10 max-w-md text-center text-slate-400">
            Démineur compétitif en temps réel. Solo, duel ou tour par tour. Chat en direct. Classement global.
          </p>

          <button
            onClick={signInWithGoogle}
            className="rounded-2xl bg-cyan-300 px-8 py-4 text-lg font-bold text-slate-950 shadow-lg shadow-cyan-300/20 transition hover:bg-cyan-200 hover:shadow-cyan-300/30"
          >
            Se connecter avec Google
          </button>

          <div className="mt-16 grid grid-cols-3 gap-6 text-center">
            {[
              { icon: Crosshair, label: "3 Modes", desc: "Solo · Duel · Tour par tour" },
              { icon: MessageCircle, label: "Chat live", desc: "Communication en temps réel" },
              { icon: Swords, label: "Compétitif", desc: "Stats et classement" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-2">
                <f.icon className="h-6 w-6 text-cyan-200/40" />
                <span className="text-sm font-semibold text-white">{f.label}</span>
                <span className="text-xs text-slate-500">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Logged in ──
  const room = roomRef.current;
  const isInGame = activePanel === "game" && selectedRoomId;
  const isMyTurn = !room || room.mode !== "turn-based" || room.turn === userProfile.uid;
  const opponentInfo = room
    ? Object.values(room.players).find((p) => p.uid !== userProfile.uid)
    : null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#03070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.15),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(245,158,11,0.10),transparent_25%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <AuthBar />

        {/* Modals */}
        {showUsernameModal && <UsernameModal />}
        {showCreateRoomModal && <CreateRoomModal />}

        {/* Mobile tabs */}
        <div className="mb-4 flex gap-2 lg:hidden">
          <button
            onClick={() => setActivePanel("lobby")}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              activePanel === "lobby" ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-500"
            }`}
          >
            <LayoutGrid className="mr-1.5 inline h-4 w-4" />
            Lobby
          </button>
          <button
            onClick={() => setActivePanel("game")}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              activePanel === "game" ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-500"
            }`}
          >
            <Bomb className="mr-1.5 inline h-4 w-4" />
            Partie
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr_320px]">
          {/* Left: Lobby */}
          <aside className={`space-y-4 ${activePanel !== "lobby" ? "hidden lg:block" : ""}`}>
            <LobbyPanel />
            <PlayerStats profile={userProfile} />
          </aside>

          {/* Center: Game */}
          <div className={`${activePanel !== "game" && activePanel !== "lobby" ? "hidden lg:block" : activePanel === "lobby" ? "hidden lg:block" : ""}`}>
            {!isInGame ? (
              <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur">
                <Bomb className="mb-4 h-12 w-12 text-cyan-200/30" />
                <h2 className="mb-2 text-xl font-bold text-white">Prêt à jouer ?</h2>
                <p className="mb-6 text-sm text-slate-500">Crée une partie ou rejoins une room dans le lobby.</p>
                <button
                  onClick={() => useUiStore.getState().setShowCreateRoomModal(true)}
                  className="rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200"
                >
                  Créer une partie
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Room info bar */}
                {room && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-xs uppercase tracking-widest text-slate-500">
                        {room.mode === "solo" ? "Solo" : room.mode === "duel" ? "Duel" : "Tour par tour"}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">
                        {room.gridConfig.width}×{room.gridConfig.height}
                      </span>
                    </div>

                    {room.mode === "turn-based" && room.status === "playing" && (
                      <div className={`rounded-full px-3 py-1 text-xs font-bold ${isMyTurn ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>
                        {isMyTurn ? "C'est votre tour" : `Tour de ${opponentInfo?.username || "..."}`}
                      </div>
                    )}

                    {room.mode !== "solo" && room.status === "waiting" && (
                      <div className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200 animate-pulse">
                        En attente d'un adversaire…
                      </div>
                    )}

                    {opponentInfo && room.mode === "duel" && room.status === "playing" && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">vs</span>
                        <span className="font-semibold text-cyan-200">{opponentInfo.username}</span>
                        <span className="text-slate-500">({opponentInfo.revealedCount} cellules)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Board */}
                {room?.status === "waiting" && room.mode !== "solo" ? (
                  <div className="flex flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-16 backdrop-blur">
                    <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                    <p className="text-lg font-bold text-white">En attente d'un adversaire</p>
                    <p className="mt-1 text-sm text-slate-500">Partagez le lien de votre room</p>
                  </div>
                ) : (
                  <GameBoard
                    onCellClick={onCellClick}
                    onCellRightClick={onCellRightClick}
                    disabled={!isMyTurn}
                  />
                )}

                {/* Game over actions */}
                {game.result !== "playing" && (
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleNewGame}
                      className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                    >
                      Nouvelle partie
                    </button>
                    <button
                      onClick={handleBackToLobby}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/10"
                    >
                      Retour au lobby
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Chat */}
          <aside className={`${activePanel !== "game" || !selectedRoomId ? "hidden lg:block" : ""}`}>
            {selectedRoomId ? (
              <RoomChat roomId={selectedRoomId} />
            ) : (
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 text-center text-sm text-slate-500 backdrop-blur-xl">
                Rejoignez une room pour accéder au chat.
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
};

export default Index;
