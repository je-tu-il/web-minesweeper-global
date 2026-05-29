import { useState, useEffect, useRef, useMemo, FormEvent } from "react";
import { onValue, push, ref, set, serverTimestamp } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile } from "@/lib/firestore";
import { RoomChat } from "@/components/RoomChat";
import { useUiStore } from "@/store/uiStore";
import type { ChatMessage, UserProfile } from "@/types";
import {
  MessageCircle,
  X,
  ArrowLeft,
  Send,
  Globe,
  Hash,
  Users as UsersIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   ChatPanel – sliding side-panel with Global / Room tabs
   + "Suggestions" friend list at the bottom
   ═══════════════════════════════════════════════════════════ */

interface ChatPanelProps {
  roomId: string | null;
}

// ── Global Chat (inline) ──────────────────────────────────
function GlobalChatInline() {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatRef = useMemo(() => ref(rtdb, "globalChat"), []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<ChatMessage, "id">> | null;
      const msgs = Object.entries(value ?? {})
        .map(([id, m]) => ({ id, ...m, timestamp: Number(m.timestamp ?? Date.now()) }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-80);
      setMessages(msgs);
    });
    return unsubscribe;
  }, [chatRef, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || !userProfile?.username) return;
    setText("");
    await set(push(chatRef), {
      sender: userProfile.username,
      text: clean,
      timestamp: serverTimestamp(),
    });
  };

  if (!user || !userProfile) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
        Connectez-vous pour chatter.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto p-3 scrollbar-thin">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-600">Pas encore de messages…</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === userProfile.username;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="mb-0.5 px-1 text-[10px] text-slate-600">{msg.sender}</span>
                <div
                  className={`max-w-[85%] break-words rounded-xl px-3 py-1.5 text-sm ${
                    isMe
                      ? "bg-cyan-500/20 text-cyan-100"
                      : "bg-white/[0.06] text-slate-200"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/[0.06] px-3 py-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message global…"
          maxLength={250}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/50 font-sans"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-xl bg-cyan-300 px-3 text-slate-950 transition hover:bg-cyan-200 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// ── Friend suggestion row ─────────────────────────────────
function FriendSuggestionRow({ uid }: { uid: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getUserProfile(uid).then(setProfile);
  }, [uid]);

  if (!profile) return null;

  const initial = (profile.username || "?")[0].toUpperCase();

  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition hover:bg-white/[0.04]">
      <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-bold text-white">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <span className="truncate text-sm text-slate-300">{profile.username}</span>
    </div>
  );
}

// ── Main ChatPanel ────────────────────────────────────────
export function ChatPanel({ roomId }: ChatPanelProps) {
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"global" | "room">(roomId ? "room" : "global");

  // Sync tab when roomId changes
  useEffect(() => {
    if (roomId) setActiveTab("room");
    else setActiveTab("global");
  }, [roomId]);

  const following = userProfile?.following ?? [];

  return (
    <>
      {/* Toggle button — fixed right edge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 top-1/2 z-40 -translate-y-1/2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-2.5 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur transition hover:bg-cyan-300/20"
        title="Chat"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#060e1e]/95 shadow-2xl shadow-black/60 backdrop-blur-xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-200/70">
            Communications
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          <button
            onClick={() => setActiveTab("global")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "global"
                ? "border-b-2 border-cyan-400 text-cyan-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Global
          </button>
          <button
            onClick={() => setActiveTab("room")}
            disabled={!roomId}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "room"
                ? "border-b-2 border-amber-400 text-amber-200"
                : roomId
                ? "text-slate-500 hover:text-slate-300"
                : "cursor-not-allowed text-slate-700"
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            Room
          </button>
        </div>

        {/* Chat body */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeTab === "global" ? (
            <GlobalChatInline />
          ) : roomId ? (
            <div className="flex-1 overflow-y-auto">
              <RoomChat roomId={roomId} />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
              Rejoignez une room pour voir le chat
            </div>
          )}
        </div>

        {/* Friend suggestions */}
        {following.length > 0 && (
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Suggestions
              </span>
            </div>
            <div className="max-h-28 space-y-0.5 overflow-y-auto scrollbar-thin">
              {following.map((uid) => (
                <FriendSuggestionRow key={uid} uid={uid} />
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
