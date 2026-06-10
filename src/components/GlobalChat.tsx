import { useState, useEffect, useRef, useMemo, FormEvent } from "react";
import { onValue, push, ref, serverTimestamp, set } from "firebase/database";
import { Send, Globe } from "lucide-react";
import { format } from "date-fns";
import { rtdb } from "@/lib/firebase";
import { addAchievements } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatMessage } from "@/types";

export function GlobalChat() {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatRef = useMemo(() => ref(rtdb, `globalChat`), []);

  // Écoute les messages en temps réel
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<ChatMessage, "id">> | null;
      const nextMessages = Object.entries(value ?? {})
        .map(([id, message]) => {
          const ts = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
          return { id, ...message, timestamp: ts };
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-50);
      setMessages(nextMessages);
    });
    return unsubscribe;
  }, [chatRef, user]);
  // Auto-scroll vers le bas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || !userProfile?.username) return;
    setText("");

    // Succès uwu
    if (cleanText.toLowerCase().includes("uwu") && userProfile.uid) {
      if (!userProfile.achievements?.includes("mystere_egirl")) {
        await addAchievements(userProfile.uid, ["mystere_egirl"]);
      }
    }

    await set(push(chatRef), {
      sender: userProfile.username,
      text: cleanText,
      timestamp: serverTimestamp(),
    });
  };

  // Non connecté → message d'info
  if (!user || !userProfile) {
    return (
      <section className="flex h-full flex-col rounded-[2rem] border border-cyan-300/15 bg-black/35 p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-cyan-400" />
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Global Chat</p>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
          Connectez-vous pour participer au chat global.
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-black/35 backdrop-blur-xl">
      {/* En-tête */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-5 py-3">
        <Globe className="h-4 w-4 text-cyan-400" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-200/70">Global Chat</h3>
      </div>

      {/* Liste des messages */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
            Aucun message. Soyez le premier !
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMe = msg.sender === userProfile.username;
              const date = new Date(msg.timestamp);

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className={`font-bold ${isMe ? "text-cyan-300" : "text-amber-300"}`}>
                      {msg.sender}
                    </span>
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
            placeholder="Écrire un message..."
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
    </section>
  );
}
