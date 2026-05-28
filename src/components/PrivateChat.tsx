import { useState, useEffect, useRef, useMemo, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { rtdb } from "@/lib/firebase";
import { ref, push, onValue, set, serverTimestamp } from "firebase/database";
import { Send, X, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import type { ChatMessage } from "@/types";

export function PrivateChat() {
  const { user, userProfile } = useAuth();
  const { activePrivateChat, setActivePrivateChat } = useUiStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Génère un ID de chat unique basé sur les deux UIDs
  const chatId = useMemo(() => {
    if (!userProfile?.uid || !activePrivateChat?.uid) return null;
    const ids = [userProfile.uid, activePrivateChat.uid].sort();
    return `${ids[0]}_${ids[1]}`;
  }, [userProfile?.uid, activePrivateChat?.uid]);

  const chatRef = useMemo(() => {
    if (!chatId) return null;
    return ref(rtdb, `privateChats/${chatId}`);
  }, [chatId]);

  // Écoute les messages en temps réel
  useEffect(() => {
    if (!chatRef) return;
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<ChatMessage, "id">> | null;
      const nextMessages = Object.entries(value ?? {})
        .map(([id, message]) => ({ id, ...message, timestamp: Number(message.timestamp ?? Date.now()) }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-50);
      setMessages(nextMessages);
    });
    return unsubscribe;
  }, [chatRef]);

  // Auto-scroll vers le bas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || !userProfile?.username || !chatRef) return;
    setText("");
    await set(push(chatRef), {
      sender: userProfile.username,
      text: cleanText,
      timestamp: serverTimestamp(),
    });
  };

  if (!activePrivateChat) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[400px] w-80 flex-col overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-[#03070c]/95 shadow-2xl shadow-black backdrop-blur-xl">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">{activePrivateChat.username}</h3>
        </div>
        <button onClick={() => setActivePrivateChat(null)} className="text-slate-400 hover:text-white transition">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Liste des messages */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
            Dites bonjour à {activePrivateChat.username} !
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMe = msg.sender === userProfile?.username;
              const date = typeof msg.timestamp === "number" ? new Date(msg.timestamp) : new Date();

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="text-slate-600">{format(date, "HH:mm")}</span>
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      isMe
                        ? "rounded-tr-sm bg-cyan-500/20 text-cyan-100"
                        : "rounded-tl-sm bg-white/5 text-slate-200"
                    }`}
                    style={{ wordBreak: "break-word" }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulaire */}
      <form onSubmit={sendMessage} className="border-t border-white/5 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-1 focus-within:border-cyan-500/50">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire..."
            className="w-full bg-transparent px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500/20 text-cyan-300 transition hover:bg-cyan-500/40 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
