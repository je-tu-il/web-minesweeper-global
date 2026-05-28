import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  query,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import { ref as rtdbRef, remove, onValue } from "firebase/database";
import { firestore, rtdb } from "./firebase";
import type { UserProfile, Room, RoomPlayer, LeaderboardEntry, LiveRoom } from "@/types";
import { GRID_PRESETS } from "@/types";

/* ================================================================
   Users
   ================================================================ */

export async function createOrUpdateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const ref = doc(firestore, "users", uid);
  await setDoc(ref, data, { merge: true });
}

export async function addGameToHistory(uid: string, room: Room, game: any, time: number): Promise<void> {
  const ref = doc(firestore, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const user = snap.data() as UserProfile;
  const history = user.history || [];
  
  // Create history entry
  const entry = {
    id: crypto.randomUUID(),
    mode: room.mode,
    difficulty: Object.keys(GRID_PRESETS).find(k => JSON.stringify(GRID_PRESETS[k]) === JSON.stringify(room.gridConfig)) || "custom",
    result: game.result,
    time,
    date: Date.now(),
    seed: room.seed,
    firstClick: room.firstClick
  };
  
  // Update stats
  const stats = { ...user.stats };
  if (game.result === "won") {
    stats.totalWins++;
    stats.winStreak++;
    if (stats.winStreak > stats.bestWinStreak) stats.bestWinStreak = stats.winStreak;
  } else if (game.result === "lost") {
    stats.totalLosses++;
    stats.winStreak = 0;
  }
  
  await updateDoc(ref, {
    history: [entry, ...history].slice(0, 50), // keep last 50
    stats
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(firestore, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function checkUsernameExists(username: string): Promise<boolean> {
  const q = query(collection(firestore, "users"), where("username", "==", username), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(firestore, "users"));
  return snap.docs.map((d) => d.data() as UserProfile);
}

export async function updateStats(uid: string, won: boolean): Promise<void> {
  const ref = doc(firestore, "users", uid);
  if (won) {
    await updateDoc(ref, {
      "stats.totalWins": increment(1),
      "stats.winStreak": increment(1),
    });
    // Mettre à jour bestWinStreak si nécessaire (côté client, après lecture)
  } else {
    await updateDoc(ref, {
      "stats.totalLosses": increment(1),
      "stats.winStreak": 0,
    });
  }
}

export async function updateBestWinStreak(uid: string, streak: number): Promise<void> {
  const ref = doc(firestore, "users", uid);
  await updateDoc(ref, { "stats.bestWinStreak": streak });
}

export async function resetUserStats(uid: string): Promise<void> {
  const ref = doc(firestore, "users", uid);
  await updateDoc(ref, {
    "stats.totalWins": 0,
    "stats.totalLosses": 0,
    "stats.winStreak": 0,
    "stats.bestWinStreak": 0,
  });
}

export async function addAchievements(uid: string, achievementIds: string[]): Promise<void> {
  if (achievementIds.length === 0) return;
  const ref = doc(firestore, "users", uid);
  await updateDoc(ref, { achievements: arrayUnion(...achievementIds) });
}

export async function addGameToHistory(uid: string, entry: import("@/types").GameHistoryEntry): Promise<void> {
  const ref = doc(firestore, "users", uid);
  await updateDoc(ref, { history: arrayUnion(entry) });
}

/* ================================================================
   Follow system (unilatéral)
   ================================================================ */

export async function followUser(myUid: string, targetUid: string): Promise<void> {
  const myRef = doc(firestore, "users", myUid);
  const targetRef = doc(firestore, "users", targetUid);
  await updateDoc(myRef, { following: arrayUnion(targetUid) });
  await updateDoc(targetRef, { friends: arrayUnion(myUid) });
}

export async function unfollowUser(myUid: string, targetUid: string): Promise<void> {
  const myRef = doc(firestore, "users", myUid);
  const targetRef = doc(firestore, "users", targetUid);
  await updateDoc(myRef, { following: arrayRemove(targetUid) });
  await updateDoc(targetRef, { friends: arrayRemove(myUid) });
}

/* ================================================================
   Banned Users (config/bannedUsers)
   ================================================================ */

export async function getBannedUsernames(): Promise<string[]> {
  const snap = await getDoc(doc(firestore, "config", "bannedUsers"));
  if (!snap.exists()) return [];
  return (snap.data()?.usernames as string[]) ?? [];
}

export function subscribeBannedUsernames(callback: (usernames: string[]) => void): () => void {
  return onSnapshot(doc(firestore, "config", "bannedUsers"), (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    callback((snap.data()?.usernames as string[]) ?? []);
  });
}

export async function addBannedUsername(username: string): Promise<void> {
  const ref = doc(firestore, "config", "bannedUsers");
  await setDoc(ref, { usernames: arrayUnion(username) }, { merge: true });
}

export async function removeBannedUsername(username: string): Promise<void> {
  const ref = doc(firestore, "config", "bannedUsers");
  await updateDoc(ref, { usernames: arrayRemove(username) });
}

/* ================================================================
   Rooms
   ================================================================ */

export async function createRoom(room: Omit<Room, "roomId">): Promise<string> {
  const ref = doc(collection(firestore, "rooms"));
  const roomId = ref.id;
  await setDoc(ref, { ...room, roomId });
  return roomId;
}

export function subscribeRooms(callback: (rooms: Room[]) => void): () => void {
  const q = query(collection(firestore, "rooms"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Room));
  });
}

export function subscribeRoom(roomId: string, callback: (room: Room | null) => void): () => void {
  return onSnapshot(doc(firestore, "rooms", roomId), (snap) => {
    callback(snap.exists() ? (snap.data() as Room) : null);
  });
}

export function subscribeLiveRoom(roomId: string, callback: (data: LiveRoom | null) => void): () => void {
  const ref = rtdbRef(rtdb, `liveRoom/${roomId}`);
  return onValue(ref, (snap) => {
    callback(snap.exists() ? (snap.val() as LiveRoom) : null);
  });
}

/* ================================================================
   Presence (Online Status)
   ================================================================ */

export function setupPresence(uid: string): () => void {
  const connectedRef = rtdbRef(rtdb, ".info/connected");
  const userStatusRef = rtdbRef(rtdb, `status/${uid}`);
  
  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      import("firebase/database").then(({ onDisconnect, set }) => {
        onDisconnect(userStatusRef).set("offline").then(() => {
          set(userStatusRef, "online");
        });
      });
    }
  });

  return () => {
    unsub();
    import("firebase/database").then(({ set }) => {
      set(userStatusRef, "offline");
    });
  };
}

export function subscribeUserPresence(uid: string, callback: (status: "online" | "offline") => void): () => void {
  const ref = rtdbRef(rtdb, `status/${uid}`);
  return onValue(ref, (snap) => {
    callback(snap.val() === "online" ? "online" : "offline");
  });
}

export async function joinRoom(roomId: string, uid: string, player: RoomPlayer): Promise<void> {
  const ref = doc(firestore, "rooms", roomId);
  await updateDoc(ref, { [`players.${uid}`]: player });
}

export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  const ref = doc(firestore, "rooms", roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const room = snap.data() as Room;
  const players = { ...room.players };
  delete players[uid];
  if (Object.keys(players).length === 0) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, { players });
  }
}

export async function updateRoom(roomId: string, data: Record<string, unknown>): Promise<void> {
  const ref = doc(firestore, "rooms", roomId);
  await updateDoc(ref, data);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await deleteDoc(doc(firestore, "rooms", roomId));
  try {
    await remove(rtdbRef(rtdb, `liveRoom/${roomId}`));
  } catch (err) {
    console.warn("RTDB liveRoom cleanup failed (ignored)", err);
  }
}

/** Sync le game state dans la room (pour reprendre + spectate) */
export async function syncGameState(
  roomId: string,
  uid: string,
  revealedCells: string[],
  flaggedCells: string[],
  questionCells: string[],
  explodedCellId?: string,
): Promise<void> {
  const ref = doc(firestore, "rooms", roomId);
  const data: Record<string, unknown> = {
    [`players.${uid}.revealedCells`]: revealedCells,
    [`players.${uid}.flaggedCells`]: flaggedCells,
    [`players.${uid}.questionCells`]: questionCells,
  };
  if (explodedCellId) data[`players.${uid}.explodedCellId`] = explodedCellId;
  await updateDoc(ref, data);
}

/* ================================================================
   Leaderboard
   ================================================================ */

export async function submitScore(entry: Omit<LeaderboardEntry, "id">): Promise<void> {
  const ref = doc(collection(firestore, "leaderboard"));
  await setDoc(ref, { ...entry, id: ref.id });
}

export async function getLeaderboard(difficulty: string, max = 50): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(firestore, "leaderboard"),
    where("difficulty", "==", difficulty),
    orderBy("time", "asc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LeaderboardEntry);
}

export function subscribeLeaderboard(
  difficulty: string,
  callback: (entries: LeaderboardEntry[]) => void,
  max = 20,
): () => void {
  const q = query(
    collection(firestore, "leaderboard"),
    where("difficulty", "==", difficulty),
    orderBy("time", "asc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as LeaderboardEntry));
  });
}
