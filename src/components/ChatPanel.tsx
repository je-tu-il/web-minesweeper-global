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
import { Link } from "react-router-dom";

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
        .map(([id, m]) => {
          const ts = typeof m.timestamp === 'number' ? m.timestamp : Date.now();
          return { id, ...m, timestamp: ts };
        })
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
      uid: userProfile.uid,
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
                <Link to={"/profile/" + msg.uid} className="mb-0.5 px-1 text-[10px] text-slate-600 hover:underline">{msg.sender}</Link>
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

// ── Private Chat (inline) ──────────────────────────────────
function PrivateChatInline({ targetUser }: { targetUser: { uid: string, username: string } }) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatId = useMemo(() => {
    if (!userProfile?.uid || !targetUser.uid) return null;
    return [userProfile.uid, targetUser.uid].sort().join("_");
  }, [userProfile?.uid, targetUser.uid]);

  const chatRef = useMemo(() => {
    if (!chatId) return null;
    return ref(rtdb, `privateChats/${chatId}/messages`);
  }, [chatId]);

  useEffect(() => {
    if (!chatRef || !user) return;
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<ChatMessage, "id">> | null;
      const msgs = Object.entries(value ?? {})
        .map(([id, m]) => {
          const ts = typeof m.timestamp === 'number' ? m.timestamp : Date.now();
          return { id, ...m, timestamp: ts };
        })
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
    if (!clean || !userProfile?.username || !chatRef || !chatId) return;
    setText("");
    
    // Send message
    await set(push(chatRef), {
      sender: userProfile.username,
      uid: userProfile.uid,
      text: clean,
      timestamp: serverTimestamp(),
    });

    // Update unread status for target user
    const targetUnreadRef = ref(rtdb, `userPrivateUnread/${targetUser.uid}/${chatId}`);
    set(targetUnreadRef, true);
  };

  // Clear unread for this chat while we have it open
  useEffect(() => {
    if (!userProfile?.uid || !chatId) return;
    const myUnreadRef = ref(rtdb, `userPrivateUnread/${userProfile.uid}/${chatId}`);
    set(myUnreadRef, null); // Clear it
  }, [chatId, userProfile?.uid, messages.length]);

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-500 mt-4">Aucun message. Dites bonjour !</p>
        )}
        {messages.map((m) => {
          const isMe = m.uid === user?.uid;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-[13px] leading-relaxed ${
                  isMe ? "bg-cyan-500/20 text-cyan-100 rounded-tr-sm" : "bg-white/10 text-slate-200 rounded-tl-sm"
                }`}
                style={{ wordBreak: "break-word" }}
              >
                {m.text}
              </div>
              <span className="mt-1 text-[10px] text-slate-500">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-white/10 p-3 bg-white/[0.02]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message @${targetUser.username}…`}
          maxLength={250}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/50 font-sans"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-xl bg-cyan-300 px-3 text-slate-950 transition hover:bg-cyan-200 disabled:opacity-30 h-9 flex items-center justify-center"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// ── Friend suggestion row ─────────────────────────────────
function FriendSuggestionRow({ uid, onClick }: { uid: string; onClick: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getUserProfile(uid).then(setProfile);
  }, [uid]);

  if (!profile) return null;

  const initial = (profile.username || "?")[0].toUpperCase();

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.06] text-left"
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-bold text-white">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium text-slate-200 block">{profile.username}</span>
        <span className="text-[10px] text-slate-500">Envoyer un message</span>
      </div>
    </button>
  );
}

// ── Conversation list item ────────────────────────────────
function ConversationItem({ icon, label, sublabel, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.06] hover:border-white/[0.12] text-left`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-white block">{label}</span>
        <span className="text-[10px] text-slate-500">{sublabel}</span>
      </div>
    </button>
  );
}

// ── Main ChatPanel ────────────────────────────────────────
export function ChatPanel({ roomId }: ChatPanelProps) {
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<"list" | "global" | "room" | "private">("list");
  const { activePrivateChat, setActivePrivateChat } = useUiStore();
  const [hasUnread, setHasUnread] = useState(false);

  // Listen for unread messages globally
  useEffect(() => {
    if (!userProfile?.uid) return;
    const unreadRef = ref(rtdb, `userPrivateUnread/${userProfile.uid}`);
    const unsub = onValue(unreadRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const hasNewUnread = Object.values(data).some(v => v === true);
        
        setHasUnread((prev) => {
          if (!prev && hasNewUnread && !isOpen) {
            import("sonner").then(module => {
              module.toast("Nouveau message privé !", {
                icon: "💬"
              });
            });
          }
          return hasNewUnread;
        });
      } else {
        setHasUnread(false);
      }
    });
    return unsub;
  }, [userProfile?.uid, isOpen]);

  // When private chat is set from outside (e.g., profile page), open panel and show it
  useEffect(() => {
    if (activePrivateChat) {
      setIsOpen(true);
      setActiveView("private");
    }
  }, [activePrivateChat]);

  const following = userProfile?.following ?? [];

  const handleBack = () => {
    setActiveView("list");
    if (activeView === "private") setActivePrivateChat(null);
  };

  return (
    <>
      {/* Toggle button — fixed top right edge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-6 top-4 z-40 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-2.5 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur transition hover:bg-cyan-300/20"
        title="Chat"
      >
        <MessageCircle className="h-5 w-5" />
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-slate-900"></span>
          </span>
        )}
      </button>

      {/* Slide panel */}
      <aside
        className={`fixed top-20 right-6 z-50 flex h-[500px] max-h-[80vh] w-80 flex-col rounded-2xl border border-white/10 bg-[#060e1e]/95 shadow-2xl shadow-cyan-900/20 backdrop-blur-xl transition-all duration-300 ease-out ${
          isOpen ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          {activeView !== "list" ? (
            <button
              onClick={handleBack}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-200/70">
            {activeView === "global" ? "Chat Global" : activeView === "room" ? "Chat Room" : activeView === "private" ? (activePrivateChat?.username || "Message") : "Messages"}
          </h2>
          <button
            onClick={() => { setIsOpen(false); setActiveView("list"); }}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeView === "list" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Conversations */}
              <div className="space-y-1.5">
                <ConversationItem
                  icon={<Globe className="h-5 w-5 text-cyan-400" />}
                  label="Chat Global"
                  sublabel="Discuter avec tous les joueurs"
                  color="bg-cyan-400/10"
                  onClick={() => setActiveView("global")}
                />
                {roomId && (
                  <ConversationItem
                    icon={<Hash className="h-5 w-5 text-amber-400" />}
                    label="Chat Room"
                    sublabel="Discuter avec les joueurs de la room"
                    color="bg-amber-400/10"
                    onClick={() => setActiveView("room")}
                  />
                )}
              </div>

              {/* Suggestions / Amis */}
              {following.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <UsersIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                      Amis
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {following.map((uid) => (
                      <FriendSuggestionRow
                        key={uid}
                        uid={uid}
                        onClick={() => {
                          getUserProfile(uid).then(p => {
                            if (p) {
                              setActivePrivateChat({ uid: p.uid, username: p.username });
                              setActiveView("private");
                            }
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === "global" && <GlobalChatInline />}

          {activeView === "room" && roomId && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <RoomChat roomId={roomId} />
            </div>
          )}

          {activeView === "room" && !roomId && (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-600 px-4 text-center">
              Rejoignez une partie pour discuter
            </div>
          )}

          {activeView === "private" && activePrivateChat && (
            <PrivateChatInline targetUser={activePrivateChat} />
          )}
        </div>
      </aside>
    </>
  );
}
