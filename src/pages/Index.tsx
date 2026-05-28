import { Bomb, Crown, Flag, Gauge, LockKeyhole, Radar, ShieldAlert, Trophy, Users, Zap } from "lucide-react";
import { MouseEvent, useMemo, useState } from "react";
import { RoomChat } from "@/components/RoomChat";
import { cycleMark, createEmptyGame, resultLabel, revealCell } from "@/lib/gameEngine";
import { adminServerActionExample, authCookieRouteExample, nextJsArchitecture } from "@/lib/serverContracts";
import type { GridConfig, Room } from "@/types";

const gridConfig: GridConfig = { width: 12, height: 10, mines: 18 };

const demoRoom: Room = {
  roomId: "global-alpha",
  mode: "duel",
  status: "playing",
  isTrap: false,
  gridConfig,
  players: {
    nina: { username: "NinaFlux", score: 1240 },
    rift: { username: "RiftMiner", score: 1180 },
  },
  turn: "nina",
};

const bannedPreview = ["ghost_clicker", "MineLord404", "lag_sorcerer"];

const Index = () => {
  const [game, setGame] = useState(() => createEmptyGame(gridConfig));
  const [isTrap, setIsTrap] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(false);
  const revealedCount = useMemo(() => game.cells.filter((cell) => cell.status === "revealed").length, [game.cells]);
  const flagsCount = useMemo(() => game.cells.filter((cell) => cell.mark === "flag").length, [game.cells]);

  const onCellClick = (id: string): void => setGame((current) => revealCell(current, id, isTrap));
  const onCellContext = (event: MouseEvent<HTMLButtonElement>, id: string): void => {
    event.preventDefault();
    setGame((current) => cycleMark(current, id));
  };

  const resetGame = (trap = isTrap): void => {
    setIsTrap(trap);
    setGame(createEmptyGame(gridConfig));
  };

  const submitAdmin = (): void => setAdminUnlocked(adminPassword === ".1Azerty");

  return (
    <main className="min-h-screen overflow-hidden bg-[#03070c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(245,158,11,0.16),transparent_25%),linear-gradient(135deg,rgba(15,23,42,0.2),rgba(2,6,23,0.95))]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-300/20"><Bomb className="h-7 w-7" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-cyan-200/70">Minesweeper Global</p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Competitive minefield protocol</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => resetGame(false)} className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20">Safe Start</button>
            <button onClick={() => resetGame(true)} className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20">Simuler Piège</button>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          {[{ icon: Trophy, label: "Room", value: demoRoom.roomId }, { icon: Radar, label: "Statut", value: resultLabel(game.result) }, { icon: Flag, label: "Flags", value: `${flagsCount}/${gridConfig.mines}` }, { icon: ShieldAlert, label: "Shadowban", value: isTrap ? "Piège actif" : "Désactivé" }].map((item) => (
            <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4 backdrop-blur">
              <item.icon className="mb-3 h-5 w-5 text-amber-300" />
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-lg font-bold text-white">{item.value}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-[2.25rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-200">Premier clic : {isTrap ? "bombe instantanée sur la case cliquée" : "zone 3×3 garantie vide"}</p>
                <h2 className="mt-1 text-2xl font-black text-white">Live Board</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300"><Zap className="h-4 w-4 text-emerald-300" /> {revealedCount} cellules révélées</div>
            </div>
            <div className="mx-auto grid max-w-3xl gap-1.5" style={{ gridTemplateColumns: `repeat(${gridConfig.width}, minmax(0, 1fr))` }}>
              {game.cells.map((cell) => {
                const isExploded = game.explodedCellId === cell.id;
                const content = cell.status === "revealed" ? (cell.hasMine ? "●" : cell.adjacentMines || "") : cell.mark === "flag" ? "⚑" : cell.mark === "question" ? "?" : "";
                return (
                  <button
                    key={cell.id}
                    onClick={() => onCellClick(cell.id)}
                    onContextMenu={(event) => onCellContext(event, cell.id)}
                    className={`aspect-square rounded-xl border text-sm font-black transition duration-150 hover:scale-105 ${cell.status === "revealed" ? "border-white/10 bg-slate-900/90 text-cyan-100" : "border-cyan-300/15 bg-cyan-300/10 text-amber-200 shadow-inner shadow-cyan-300/10"} ${isExploded ? "bg-red-500 text-white shadow-lg shadow-red-500/40" : ""}`}
                    aria-label={`Cellule ${cell.x},${cell.y}`}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <RoomChat roomId={demoRoom.roomId} username="Architecte" />
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-3"><Users className="h-5 w-5 text-cyan-200" /><h2 className="text-xl font-bold">Lobby Firestore</h2></div>
              <div className="space-y-3">
                {Object.entries(demoRoom.players).map(([id, player]) => <div key={id} className="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3"><span>{player.username}</span><span className="text-amber-200">{player.score}</span></div>)}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-amber-300/15 bg-amber-300/[0.06] p-5">
            <div className="mb-4 flex items-center gap-3"><Crown className="h-5 w-5 text-amber-200" /><h2 className="text-xl font-bold">Architecture livrée</h2></div>
            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">{nextJsArchitecture.folders.map((folder) => <code key={folder} className="rounded-xl bg-black/30 p-2">/{folder}</code>)}</div>
          </div>
          <div className="rounded-[2rem] border border-red-300/15 bg-red-400/[0.05] p-5">
            <div className="mb-4 flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-red-200" /><h2 className="text-xl font-bold">Admin server action</h2></div>
            <div className="mb-4 flex gap-2"><input value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} type="password" placeholder="Mot de passe admin" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none" /><button onClick={submitAdmin} className="rounded-2xl bg-amber-300 px-4 font-bold text-slate-950">Entrer</button></div>
            <p className="text-sm text-slate-300">{adminUnlocked ? `Accès validé. Bannis: ${bannedPreview.join(", ")}` : "Dans Next.js, cette vérification est faite en Server Action HTTP-only, pas dans le client."}</p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-black/40 p-5">
          <div className="mb-3 flex items-center gap-3"><Gauge className="h-5 w-5 text-emerald-200" /><h2 className="text-xl font-bold">Extraits critiques prêts pour Next.js</h2></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <pre className="max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-cyan-100">{authCookieRouteExample}</pre>
            <pre className="max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-amber-100">{adminServerActionExample}</pre>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Index;
