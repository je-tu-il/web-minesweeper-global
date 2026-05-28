import { onValue, push, ref, serverTimestamp, set } from "firebase/database";
import { Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { rtdb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatMessage } from "@/types";

interface RoomChatProps {
  roomId: string;
}

export function RoomChat({ roomId }: RoomChatProps) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatRef = useMemo(() => ref(rtdb, `liveRoom/${roomId}/chat`), [roomId]);

  // Écoute les messages en temps réel
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<ChatMessage, "id">> | null;
      const nextMessages = Object.entries(value ?? {})
        .map(([id, message]) => ({ id, ...message, timestamp: Number(message.timestamp ?? Date.now()) }))
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
    await set(push(chatRef), {
      sender: userProfile.username,
      text: cleanText,
      timestamp: serverTimestamp(),
    });
  };

  // Non connecté → message d'info
  if (!user || !userProfile) {
    return (
      <section className="rounded-[2rem] border border-cyan-300/15 bg-black/35 p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Chat</p>
        </div>
        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
          Connectez-vous pour utiliser le chat.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-cyan-300/15 bg-black/35 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Chat de room</p>
          <h2 className="text-lg font-semibold text-white">Radio tactique</h2>
        </div>
        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-200">live</span>
      </div>

      <div ref={scrollRef} className="mb-3 h-56 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
            Aucun message. Envoie le premier !
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="rounded-xl bg-white/[0.06] px-3 py-2">
              <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-cyan-200">{msg.sender}</span>
                <span className="text-slate-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-slate-200">{msg.text}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Signal tactique..."
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/50"
        />
        <button
          type="submit"
          className="rounded-xl bg-cyan-300 px-3 text-slate-950 transition hover:bg-cyan-200"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
