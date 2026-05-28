export const nextJsArchitecture = {
  folders: [
    "app/(game)/rooms/[roomId]/page.tsx",
    "app/admin/page.tsx",
    "app/api/auth/session/route.ts",
    "app/actions/admin.ts",
    "components/game/GameBoard.tsx",
    "components/chat/RoomChat.tsx",
    "hooks/useAuthSession.ts",
    "lib/firebase/client.ts",
    "lib/firebase/admin.ts",
    "lib/game/GameEngine.ts",
    "types/index.ts",
  ],
  firestore: {
    users: "{ uid, username, role, stats, achievements, friends }",
    rooms: "{ roomId, mode, status, isTrap, gridConfig, players, turn }",
    config: "bannedUsers: { usernames: string[] }",
  },
  rtdb: {
    liveRoom: "{ roomId: { cursors, chat } }",
  },
};

export const authCookieRouteExample = `
// app/api/auth/session/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  const { idToken } = await request.json();
  const decoded = await adminAuth.verifyIdToken(idToken);
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: 60 * 60 * 24 * 5 * 1000 });
  cookies().set("__session", sessionCookie, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  return NextResponse.json({ uid: decoded.uid });
}

export async function DELETE() {
  cookies().delete("__session");
  return NextResponse.json({ ok: true });
}
`;

export const adminServerActionExample = `
// app/actions/admin.ts
"use server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

export async function loginAdmin(_: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password !== ADMIN_PASSWORD) return { ok: false, error: "Mot de passe invalide" };
  cookies().set("admin_session", "verified", { httpOnly: true, secure: true, sameSite: "strict", path: "/admin" });
  return { ok: true };
}
`;
