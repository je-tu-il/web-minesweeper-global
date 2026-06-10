import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { subscribeRoom, updateRoom, updateStats, syncGameState, submitScore, addAchievements, addGameToHistory, leaveRoom, deleteRoom } from "@/lib/firestore";
import { checkAchievements } from "@/lib/achievements";
import { AuthBar } from "@/components/AuthBar";
import { GameBoard } from "@/components/GameBoard";
import { LobbyPanel } from "@/components/LobbyPanel";
import { RoomChat } from "@/components/RoomChat";

import { CreateRoomModal } from "@/components/CreateRoomModal";
import { UsernameModal } from "@/components/UsernameModal";
import { PlayerStats } from "@/components/PlayerStats";
import { Leaderboard } from "@/components/Leaderboard";
import { MiniBoard } from "@/components/MiniBoard";
import { AchievementToast } from "@/components/AchievementToast";
import { ChatPanel } from "@/components/ChatPanel";
import { Bomb, Swords, Clock, Crosshair, MessageCircle, LayoutGrid, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Flag, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Room } from "@/types";
import { rtdb } from "@/lib/firebase";
import { ref as rtdbRef, onValue } from "firebase/database";
import { Link } from "react-router-dom";

const Index = () => {
  const { user, userProfile, isLoading, isBanned, signInWithGoogle, refreshProfile } = useAuth();
  const { activePanel, selectedRoomId, showUsernameModal, showCreateRoomModal, setActivePanel, setSelectedRoomId, setShowUsernameModal } = useUiStore();
  const { game, timer, handleReveal, handleFlag, tickTimer, isTimerRunning, initSoloGame, initDuelGame, initTurnBasedGame } = useGameStore();

  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsUpdatedRef = useRef(false);
  const gameBoardRef = useRef<HTMLDivElement>(null);

  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Derived state
  const room = roomRef.current;
  const isInGame = activePanel === "game" && selectedRoomId;
  const isMyTurn = !room || room.mode !== "turn-based" || room.turn === userProfile?.uid;
  const opponentInfo = room
    ? Object.values(room.players || {}).find((p) => p.uid !== userProfile?.uid)
    : null;

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

      const currentGameState = useGameStore.getState().game;

      // Detect new game started by someone else
      if (room.status === "playing" && currentGameState.result !== "playing" && room.seed !== currentGameState.seed) {
         if (room.mode === "coop") {
           useGameStore.getState().initCoopGame(room.gridConfig, room.seed, isBanned);
         } else if (room.mode === "duel") {
           initDuelGame(room.gridConfig, room.seed, isBanned);
         } else if (room.mode === "turn-based") {
           initTurnBasedGame(room.gridConfig, isBanned);
         }
         // Wait for the next tick to evaluate with the new game state
         return;
      }

      // Cross-victory / End Game sync in Duel & Coop
      const currentGame = useGameStore.getState().game;
      if (room.mode !== "solo" && room.status === "finished" && currentGame.result === "playing") {
        const isCoop = room.mode === "coop";
        const wonByMe = isCoop ? (room.winner !== null && room.winner !== undefined) : (room.winner === userProfile.uid);
        
        useGameStore.setState({
          game: {
            ...currentGame,
            result: wonByMe ? "won" : "lost",
            cells: wonByMe ? currentGame.cells : currentGame.cells.map(c => c.hasMine ? { ...c, status: "revealed" } : c)
          },
          isTimerRunning: false
        });

        let msg = wonByMe ? "Félicitations, vous avez gagné !" : "Défaite !";
        if (room.mode === "duel") {
           msg = wonByMe ? "Félicitations, vous avez gagné le duel !" : "L'adversaire a terminé en premier ! Partie perdue.";
        } else if (room.mode === "coop") {
           msg = wonByMe ? "Félicitations, vous avez déminé la grille ensemble !" : "Boum ! Quelqu'un a cliqué sur une mine !";
        }
        toast.info(msg);
      }

      const playerCount = Object.keys(room.players || {}).length;

      // Duel/Turn-based: quand le 2e joueur rejoint, passer en "playing"
      if (room.status === "waiting" && playerCount >= room.maxPlayers) {
        updateRoom(room.roomId, { status: "playing" });
        // Initialiser le jeu pour le joueur qui était en attente
        if (room.mode === "duel") {
          initDuelGame(room.gridConfig, room.duelMode === "separate" ? room.seed + (room.createdBy === userProfile.uid ? 0 : 1) : room.seed, isBanned);
        } else if (room.mode === "turn-based") {
          initTurnBasedGame(room.gridConfig, isBanned);
        } else if (room.mode === "coop") {
          useGameStore.getState().initCoopGame(room.gridConfig, room.seed, isBanned);
        }
      }

      // Restore personal game state if reconnecting
      // (Using currentGameState declared at the top of the subscription)
      if ((room.status === "playing" || room.status === "finished") && !currentGameState.firstClickDone) {
        const p = room.players[userProfile.uid];
        const isSharedBoard = room.mode === "turn-based" || room.mode === "coop";
        
        if ((p?.revealedCells && p.revealedCells.length > 0) || (isSharedBoard && room.firstClick)) {
          useGameStore.getState().restoreFromSync(
            room.gridConfig,
            room.mode === "duel" && room.duelMode === "separate" ? room.seed + (room.createdBy === userProfile.uid ? 0 : 1) : room.seed,
            room.mode,
            p?.revealedCells || [],
            p.flaggedCells || [],
            p.questionCells || [],
            p.explodedCellId,
            room.firstClick
          );
        }
      }

      // Sync opponent's state to local board (if shared board)
      if (room.status === "playing" || room.status === "finished") {
        const isSharedBoard = room.mode === "turn-based" || room.mode === "coop";
        if (isSharedBoard) {
          const myUid = userProfile.uid;
          const otherPlayers = Object.values(room.players).filter(p => p.uid !== myUid);
          if (otherPlayers.length > 0) {
            const allRevealed = new Set<string>();
            const allFlagged = new Set<string>();
            const allQuestion = new Set<string>();
            let explodedId: string | undefined;

            otherPlayers.forEach(p => {
              p.revealedCells?.forEach(c => allRevealed.add(c));
              p.flaggedCells?.forEach(c => allFlagged.add(c));
              p.questionCells?.forEach(c => allQuestion.add(c));
              if (p.explodedCellId) explodedId = p.explodedCellId;
            });

            useGameStore.getState().mergeOpponentState(
              Array.from(allRevealed),
              Array.from(allFlagged),
              Array.from(allQuestion),
              explodedId
            );
          }
        }
      }
    });
    return unsub;
  }, [selectedRoomId, userProfile, isBanned, initDuelGame, initTurnBasedGame]);

  // Track spectators
  useEffect(() => {
    if (!selectedRoomId) {
      setSpectatorCount(0);
      return;
    }
    const specRef = rtdbRef(rtdb, `liveRoom/${selectedRoomId}/spectators`);
    const unsub = onValue(specRef, (snap) => {
      setSpectatorCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });
    return () => unsub();
  }, [selectedRoomId]);

  // Update stats, achievements, leaderboard when game ends
  useEffect(() => {
    if (game.result !== "playing" && userProfile && selectedRoomId && !statsUpdatedRef.current) {
      statsUpdatedRef.current = true;
      const room = roomRef.current;
      const won = game.result === "won";
      
      const mockRoomForHistory = room || {
        mode: "solo" as const,
        gridConfig: game.config,
        seed: 0,
        players: {}
      } as Room;

      // Ajouter à l'historique de manière universelle (met à jour aussi les stats de façon unifiée)
      addGameToHistory(userProfile.uid, mockRoomForHistory, game, timer).catch(console.error);

      // Vérifier les succès
      const mode = room ? room.mode : "solo";
      const unlocked = checkAchievements(userProfile, game, timer, mode);
      if (unlocked.length > 0) {
        addAchievements(userProfile.uid, unlocked);
        setNewAchievements(unlocked);
      }

      // Soumettre au leaderboard si victoire solo et pas custom
      if (won && mockRoomForHistory.mode === "solo") {
        // Déterminer la difficulté en fonction de la taille
        let diffKey = "custom";
        if (game.config.width === 9 && game.config.height === 9 && game.config.mines === 10) diffKey = "beginner";
        else if (game.config.width === 16 && game.config.height === 16 && game.config.mines === 40) diffKey = "intermediate";
        else if (game.config.width === 30 && game.config.height === 16 && game.config.mines === 99) diffKey = "expert";
        if (diffKey !== "custom" && mockRoomForHistory.mode !== "duel") {
          submitScore({
            uid: userProfile.uid,
            username: userProfile.username,
            time: timer,
            difficulty: diffKey,
            gridConfig: game.config,
            date: Date.now()
          }).then(() => {
            toast.success(`Score de ${timer}s ajouté au Leaderboard !`);
          }).catch((err) => {
            console.error("Score submission error:", err);
            toast.error("Erreur lors de la soumission du score.");
          });
        }
      }

      // Update room
      const isSolo = room ? room.mode === "solo" : true;
      const isDuel = room ? room.mode === "duel" : false;
      
      let winnerUid = won ? userProfile.uid : null;
      let statusToSet = (won || isSolo) ? "finished" : room?.status || "playing";

      if (room?.mode === "duel" && !won) {
        // If I lost in a duel, the other player is the winner
        const otherPlayer = Object.keys(room.players).find(uid => uid !== userProfile.uid);
        if (otherPlayer) {
          winnerUid = otherPlayer;
          statusToSet = "finished";
        }
      } else if (room?.mode === "coop" && !won) {
        // If I lost in coop, everyone loses
        winnerUid = null;
        statusToSet = "finished";
      }

      const updates: Record<string, unknown> = {
        [`players.${userProfile.uid}.result`]: game.result,
        [`players.${userProfile.uid}.revealedCount`]: game.cells.filter((c) => c.status === "revealed").length,
      };

      if (winnerUid) updates.winner = winnerUid;
      if (statusToSet) updates.status = statusToSet;
      if (game.explodedCellId) updates[`players.${userProfile.uid}.explodedCellId`] = game.explodedCellId;

      updateRoom(selectedRoomId, updates);

      refreshProfile();
    }
  }, [game.result, userProfile, selectedRoomId, game, timer, refreshProfile]);

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

  // Timeout for rematch proposal
  useEffect(() => {
    const room = roomRef.current;
    if (room?.rematchProposal === userProfile?.uid && selectedRoomId) {
      const timeout = setTimeout(() => {
        updateRoom(selectedRoomId, { rematchProposal: null }).catch(() => {});
      }, 30000);
      return () => clearTimeout(timeout);
    }
  }, [roomRef.current?.rematchProposal, userProfile?.uid, selectedRoomId]);

  // Scroll to game board when game starts
  useEffect(() => {
    if (isInGame && game.result === "playing" && gameBoardRef.current) {
      gameBoardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isInGame, game.result, game.firstClickDone]);

  const handleRefuseRematch = () => {
    if (selectedRoomId && userProfile) {
      updateRoom(selectedRoomId, { status: "waiting", rematchProposal: null }).catch(console.error);
      leaveRoom(selectedRoomId, userProfile.uid).catch(console.error);
    }
    handleBackToLobby();
  };

  // Helper pour sync Firestore
  const pushGameStateToFirestore = (newGame: typeof game) => {
    if (!selectedRoomId || !userProfile) return;
    const revealed = newGame.cells.filter(c => c.status === "revealed").map(c => c.id);
    const flagged = newGame.cells.filter(c => c.mark === "flag").map(c => c.id);
    const question = newGame.cells.filter(c => c.mark === "question").map(c => c.id);
    syncGameState(selectedRoomId, userProfile.uid, revealed, flagged, question, newGame.explodedCellId);
  };

  const onCellClick = useCallback(
    (cellId: string) => {
      if (!userProfile || !selectedRoomId) return;
      const room = roomRef.current;

      // Turn-based: vérifier que c'est le tour du joueur
      if (room?.mode === "turn-based" && room.turn !== userProfile.uid) return;

      const targetCell = game.cells.find(c => c.id === cellId);

      if (!game.firstClickDone && room && !room.firstClick && targetCell) {
        updateRoom(selectedRoomId, { firstClick: { x: targetCell.x, y: targetCell.y } });
      }
    
    const newGame = handleReveal(cellId);
      pushGameStateToFirestore(newGame);

      // Turn-based: passer le tour
      if (room?.mode === "turn-based" && newGame.result === "playing") {
        const otherPlayer = Object.keys(room.players || {}).find((uid) => uid !== userProfile.uid);
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
      const newGame = handleFlag(cellId);
      pushGameStateToFirestore(newGame);
    },
    [userProfile, handleFlag],
  );

  const handleBackToLobby = () => {
    const room = roomRef.current;
    if (room && (room.status === "finished" || room.mode === "solo")) {
      if (userProfile && selectedRoomId) {
        deleteRoom(selectedRoomId).catch(console.error);
      }
    }
    setSelectedRoomId(null);
    setActivePanel("lobby");
  };

  const handleNewGame = () => {
    const room = roomRef.current;
    if (!room) return;
    statsUpdatedRef.current = false;

    const newSeed = room.seed + 1;

    // If multiplayer and not already proposing, send proposal
    if (room.mode !== "solo") {
      if (!room.rematchProposal) {
        if (selectedRoomId && userProfile) {
          updateRoom(selectedRoomId, { rematchProposal: userProfile.uid }).catch(console.error);
          toast.info("Proposition de revanche envoyée");
        }
        return;
      } else if (room.rematchProposal === userProfile?.uid) {
        // We already proposed, waiting for others...
        return;
      }
      // Otherwise, we are accepting someone else's proposal! Fall through to reset game.
    }

    // Reset room status for multiplayer replays (or solo)
    if (selectedRoomId) {
      const updates: Record<string, any> = {
        status: "playing",
        winner: null,
        firstClick: null,
        seed: newSeed,
        rematchProposal: null,
      };
      
      Object.keys(room.players || {}).forEach(uid => {
        updates[`players.${uid}.result`] = "playing";
        updates[`players.${uid}.revealedCount`] = 0;
        updates[`players.${uid}.revealedCells`] = [];
        updates[`players.${uid}.flaggedCells`] = [];
        updates[`players.${uid}.questionCells`] = [];
        updates[`players.${uid}.explodedCellId`] = null;
      });

      updateRoom(selectedRoomId, updates).catch(console.error);
    }

    if (room.mode === "solo") {
      initSoloGame(room.gridConfig, newSeed, isBanned);
    } else if (room.mode === "duel") {
      initDuelGame(room.gridConfig, room.duelMode === "separate" ? newSeed + (room.createdBy === userProfile.uid ? 0 : 1) : newSeed, isBanned);
    } else if (room.mode === "coop") {
      useGameStore.getState().initCoopGame(room.gridConfig, newSeed, isBanned);
    } else {
      initTurnBasedGame(room.gridConfig, isBanned);
    }
  };

  const handleSurrenderClick = () => {
    const room = roomRef.current;
    // Si aucun clic n'a été fait en multi, on peut quitter sans pénalité
    if (room && room.mode !== "solo" && !game.firstClickDone) {
      if (selectedRoomId && userProfile) {
        leaveRoom(selectedRoomId, userProfile.uid);
        updateRoom(selectedRoomId, { status: "waiting" }).catch(() => {});
      }
      handleBackToLobby();
      return;
    }
    
    // Sinon, on affiche la modale
    setShowSurrenderConfirm(true);
  };

  const confirmSurrender = () => {
    setShowSurrenderConfirm(false);
    const room = roomRef.current;
    if (room && userProfile) {
      const endedGame = { ...game, result: "lost" as const };
      useGameStore.setState({ game: endedGame, isTimerRunning: false });
      
      addGameToHistory(userProfile.uid, room, endedGame, timer).catch(console.error);
      if (Object.keys(room.players).length <= 1) {
        deleteRoom(selectedRoomId!).catch(console.error);
      } else {
        leaveRoom(selectedRoomId!, userProfile.uid).catch(console.error);
      }
      
      handleBackToLobby();
    }
  };

  const cancelSurrender = () => {
    setShowSurrenderConfirm(false);
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
            className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-8 py-4 font-bold text-cyan-100 shadow-[0_0_40px_rgba(34,211,238,0.2)] transition hover:bg-cyan-400/20 hover:shadow-[0_0_60px_rgba(34,211,238,0.4)]"
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

          <div className="absolute bottom-6 text-xs text-slate-500 font-medium">
            This site is powered by Netlify
          </div>
        </div>
      </main>
    );
  }

  // ── Logged in ──

  return (
    <main className="min-h-screen overflow-hidden bg-[#03070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.15),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(245,158,11,0.10),transparent_25%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className={`relative mx-auto px-4 py-4 sm:px-6 max-w-7xl`}>
        <AuthBar />
        {newAchievements.length > 0 && (
          <AchievementToast achievementIds={newAchievements} onDone={() => setNewAchievements([])} />
        )}

        {/* UI Modals */}
        {showUsernameModal && <UsernameModal />}
        {showCreateRoomModal && <CreateRoomModal />}
        
        {/* Surrender Confirm Modal */}
        {showSurrenderConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-[2rem] border border-red-500/30 bg-slate-950 p-6 shadow-2xl shadow-red-500/20 text-center">
              <h3 className="mb-2 text-xl font-bold text-white">Abandonner la partie ?</h3>
              <p className="mb-6 text-sm text-slate-400">
                Attention ! Vous avez déjà commencé cette partie. La quitter comptera comme une <strong className="text-red-400">DÉFAITE</strong>.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={cancelSurrender}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmSurrender}
                  className="rounded-xl bg-red-500/20 px-5 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/30 border border-red-500/30"
                >
                  Oui, abandonner
                </button>
              </div>
            </div>
          </div>
        )}

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

        <div className={`grid gap-4 lg:grid-cols-[${isLeftOpen ? "320px" : "auto"}_minmax(0,1fr)]`}>
          {/* Left: Lobby */}
          <aside className={`space-y-4 ${activePanel !== "lobby" ? "hidden lg:block" : ""}`}>
              {isLeftOpen ? (
                <>
                  <LobbyPanel />
                  <PlayerStats profile={userProfile} />
                  <Leaderboard />
                </>
              ) : (
                <div className="h-full w-12 flex flex-col items-center py-4 rounded-[2rem] border border-white/10 bg-slate-950/70 backdrop-blur-xl">
                  {/* Collapsed view, just taking minimal space */}
                </div>
              )}
            </aside>

          {/* Center: Game */}
          <div className={`min-w-0 ${activePanel !== "game" && activePanel !== "lobby" ? "hidden lg:block" : activePanel === "lobby" ? "hidden lg:block" : ""}`}>
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
                        <Link to={`/profile/${Object.keys(room.players).find(uid => uid !== userProfile.uid)}`} className="font-semibold text-cyan-200 hover:text-cyan-100 hover:underline transition-colors">{opponentInfo.username}</Link>
                        <span className="text-slate-500">{opponentInfo.result !== "playing" ? "(Terminé)" : "(En jeu)"}</span>
                      </div>
                    )}
                    
                  </div>
                )}

                {/* Spectator Global Counter */}
                {room && spectatorCount > 0 && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-sm font-semibold text-white shadow-xl backdrop-blur-md">
                    <span className="text-base">👀</span>
                    <span>{spectatorCount}</span>
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
                  <div ref={gameBoardRef} className={`flex flex-col items-center gap-6 xl:flex-row xl:items-start xl:justify-center min-w-0 max-w-full`}>
                    <div className="min-w-0 max-w-full">
                      <GameBoard
                        onCellClick={onCellClick}
                        onCellRightClick={onCellRightClick}
                        disabled={!isMyTurn}
                      />
                    </div>
                    {/* Opponent Progress in Duel (Shared) */}
                    {room?.mode === "duel" && room.duelMode === "shared" && opponentInfo && (
                      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur-xl xl:self-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avancée de {opponentInfo.username}</span>
                        <div className="flex gap-4 text-sm font-bold">
                          <span className="flex items-center gap-1 text-amber-300"><Flag className="h-4 w-4" /> {(opponentInfo.flaggedCells || []).length}</span>
                          <span className="flex items-center gap-1 text-emerald-300"><Zap className="h-4 w-4" /> {(opponentInfo.revealedCells || []).length}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Opponent MiniMap in Duel (Separate only) */}
                    {room?.mode === "duel" && room.duelMode === "separate" && opponentInfo && (
                      <div className="flex flex-col items-center gap-3 rounded-[2rem] border border-white/10 bg-slate-950/40 p-5 backdrop-blur-xl">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Progression de {opponentInfo.username}</span>
                          <div className="flex gap-4 text-xs font-bold">
                            <span className="text-amber-300">{(opponentInfo.flaggedCells || []).length} 🚩</span>
                            <span className="text-emerald-300">{(opponentInfo.revealedCells || []).length} ⚡</span>
                          </div>
                        </div>
                        <MiniBoard
                          config={room.gridConfig}
                          revealedCells={opponentInfo.revealedCells || []}
                          flaggedCells={opponentInfo.flaggedCells || []}
                          explodedCellId={opponentInfo.explodedCellId}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Game actions */}
                {game.result !== "playing" ? (
                  room?.mode !== "solo" && room?.rematchProposal ? (
                    room.rematchProposal === userProfile?.uid ? (
                      <div className="flex justify-center gap-3">
                        <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-200">
                          ⏳ En attente de l'adversaire... (30s)
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm font-bold text-cyan-200">L'adversaire propose une revanche !</p>
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={handleNewGame}
                            className="rounded-xl bg-emerald-500/20 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 border border-emerald-500/30"
                          >
                            Accepter
                          </button>
                          <button
                            onClick={handleRefuseRematch}
                            className="rounded-xl bg-red-500/20 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 border border-red-500/30"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
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
                  )
                ) : (
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleSurrenderClick}
                      className="flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/20"
                    >
                      <Flag className="h-4 w-4" />
                      Abandonner
                    </button>
                  </div>
                )}
                

              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500 font-medium">
          This site is powered by Netlify
        </div>
      </div>

      {/* ChatPanel – sliding side panel */}
      <ChatPanel roomId={selectedRoomId} />
    </main>
  );
};

export default Index;
