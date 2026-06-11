import { onValue, push, ref, serverTimestamp, set } from "firebase/database";
import { Send, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { rtdb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeRoom } from "@/lib/firestore";
import type { ChatMessage, Room } from "@/types";

interface RoomChatProps {
  roomId: string;
}

export function RoomChat({ roomId }: RoomChatProps) {
  const { user, userProfile } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatRef = useMemo(() => ref(rtdb, `liveRoom/${roomId}/chat`), [roomId]);

  useEffect(() => {
    return subscribeRoom(roomId, setRoom);
  }, [roomId]);

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
    await set(push(chatRef), {
      sender: userProfile.username,
      uid: userProfile.uid,
      text: cleanText,
      timestamp: serverTimestamp(),
    });
  };

  // Non connecté → message d'info
  if (!user || !userProfile) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
        Connectez-vous pour utiliser le chat.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto p-3 scrollbar-thin">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-600">Aucun message. Envoie le premier !</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === userProfile.username;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <Link to={"/profile/" + msg.uid} className="mb-0.5 px-1 text-[10px] text-slate-600 hover:underline">{msg.sender}</Link>
                <div
                  className={`max-w-[85%] break-words rounded-xl px-3 py-1.5 text-sm ${
                    isMe
                      ? "bg-amber-500/20 text-amber-100"
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
          placeholder="Signal tactique..."
          maxLength={250}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300/50 font-sans"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-xl bg-amber-400 px-3 text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
