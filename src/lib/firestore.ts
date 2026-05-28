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
  limit,
} from "firebase/firestore";
import { firestore } from "./firebase";
import type { UserProfile, Room, RoomPlayer } from "@/types";

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
  await updateDoc(ref, {
    [won ? "stats.totalWins" : "stats.totalLosses"]: increment(1),
  });
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

export async function updateRoom(roomId: string, data: Record<string, unknown>): Promise<void> {
  const ref = doc(firestore, "rooms", roomId);
  await updateDoc(ref, data);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await deleteDoc(doc(firestore, "rooms", roomId));
}
