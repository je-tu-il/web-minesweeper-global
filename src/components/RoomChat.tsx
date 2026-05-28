import { onValue, push, ref, serverTimestamp, set } from "firebase/database";
import { Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { rtdb } from "@/lib/firebase";
import type { ChatMessage } from "@/types";

interface RoomChatProps {
  roomId: string;
  username: string;
}

export const RoomChat = ({ roomId, username }: RoomChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState<string>("");

  const chatRef = useMemo(() => ref(rtdb, `liveRoom/${roomId}/chat`), [roomId]);

  useEffect(() => {
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<ChatMessage, "id">> | null;
      const nextMessages = Object.entries(value ?? {})
        .map(([id, message]) => ({ id, ...message, timestamp: Number(message.timestamp ?? Date.now()) }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-30);
      setMessages(nextMessages);
    });
    return unsubscribe;
  }, [chatRef]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText) return;
    setText("");
    await set(push(chatRef), { sender: username, text: cleanText, timestamp: serverTimestamp() });
  };

  return (
    <section className="rounded-[2rem] border border-cyan-300/15 bg-black/35 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">RTDB Chat</p>
          <h2 className="text-xl font-semibold text-white">Room radio</h2>
        </div>
        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">live</span>
      </div>
      <div className="mb-4 h-64 space-y-3 overflow-y-auto pr-2">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Aucun message. Le chat est synchronisé via Realtime Database.</div>
        ) : messages.map((message) => (
          <div key={message.id} className="rounded-2xl bg-white/[0.06] px-4 py-3">
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-cyan-200">{message.sender}</span>
              <span className="text-slate-500">{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="text-sm text-slate-200">{message.text}</p>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Signal tactique..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" />
        <button className="rounded-2xl bg-cyan-300 px-4 text-slate-950 transition hover:bg-cyan-200" type="submit" aria-label="Envoyer"><Send className="h-4 w-4" /></button>
      </form>
    </section>
  );
};
