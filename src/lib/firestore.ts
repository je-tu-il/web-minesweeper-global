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
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { firestore } from "./firebase";
import type { UserProfile, Room, RoomPlayer, LeaderboardEntry } from "@/types";

/* ================================================================
   Users
   ================================================================ */

export async function createOrUpdateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const ref = doc(firestore, "users", uid);
  await setDoc(ref, data, { merge: true });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(firestore, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
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

export async function addAchievements(uid: string, achievementIds: string[]): Promise<void> {
  if (achievementIds.length === 0) return;
  const ref = doc(firestore, "users", uid);
  await updateDoc(ref, { achievements: arrayUnion(...achievementIds) });
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
}

/** Sync le game state dans la room (pour reprendre + spectate) */
export async function syncGameState(
  roomId: string,
  revealedCells: string[],
  flaggedCells: string[],
  questionCells: string[],
  explodedCellId?: string,
): Promise<void> {
  const ref = doc(firestore, "rooms", roomId);
  const data: Record<string, unknown> = { revealedCells, flaggedCells, questionCells };
  if (explodedCellId) data.explodedCellId = explodedCellId;
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
