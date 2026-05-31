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
import { ref as rtdbRef, remove, onValue, onDisconnect, set } from "firebase/database";
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
  let diff = "custom";
  const { width, height, mines } = room.gridConfig;
  if (width === 9 && height === 9 && mines === 10) diff = "beginner";
  else if (width === 16 && height === 16 && mines === 40) diff = "intermediate";
  else if (width === 30 && height === 16 && mines === 99) diff = "expert";
  else if (width === 6 && height === 6 && mines === 5) diff = "tiny";

  const entry = {
    id: crypto.randomUUID(),
    mode: room.mode,
    difficulty: diff,
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
  stats.playTime = (stats.playTime || 0) + time;
  
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

export async function updateStats(uid: string, won: boolean, playTime: number = 0): Promise<void> {
  const ref = doc(firestore, "users", uid);
  if (won) {
    await updateDoc(ref, {
      "stats.totalWins": increment(1),
      "stats.winStreak": increment(1),
      "stats.playTime": increment(playTime),
    });
    // Mettre à jour bestWinStreak si nécessaire (côté client, après lecture)
  } else {
    await updateDoc(ref, {
      "stats.totalLosses": increment(1),
      "stats.winStreak": 0,
      "stats.playTime": increment(playTime),
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
    "stats.playTime": 0,
    history: [],
  });
}

export async function addAchievements(uid: string, achievementIds: string[]): Promise<void> {
  if (achievementIds.length === 0) return;
  const ref = doc(firestore, "users", uid);
  await updateDoc(ref, { achievements: arrayUnion(...achievementIds) });
}

export async function resetUserAchievements(uid: string): Promise<void> {
  const ref = doc(firestore, "users", uid);
  await updateDoc(ref, { achievements: [] });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(firestore, "users", uid));
}

export async function updateUsername(uid: string, newUsername: string): Promise<void> {
  await updateDoc(doc(firestore, "users", uid), { username: newUsername });
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
    if (snap.exists()) {
      callback((snap.data().usernames as string[]) ?? []);
    } else {
      callback([]);
    }
  });
}

export async function getAdminPassword(): Promise<string | null> {
  const snap = await getDoc(doc(firestore, "config", "adminPassword"));
  if (snap.exists()) {
    return snap.data().password as string;
  }
  return null;
}

export async function updateAdminPassword(newPassword: string): Promise<void> {
  await setDoc(doc(firestore, "config", "adminPassword"), { password: newPassword });
}

export async function addBannedUsername(username: string): Promise<void> {
  const ref = doc(firestore, "config", "bannedUsers");
  await setDoc(ref, { usernames: arrayUnion(username) }, { merge: true });
}

export async function removeBannedUsername(username: string): Promise<void> {
  const ref = doc(firestore, "config", "bannedUsers");
  await updateDoc(ref, { usernames: arrayRemove(username) });
}

export async function getGlobalSettings(): Promise<{ maxActiveGames: number }> {
  const snap = await getDoc(doc(firestore, "config", "settings"));
  if (snap.exists() && typeof snap.data().maxActiveGames === "number") {
    return { maxActiveGames: snap.data().maxActiveGames as number };
  }
  return { maxActiveGames: 5 }; // default
}

export async function updateGlobalSettings(settings: { maxActiveGames: number }): Promise<void> {
  const ref = doc(firestore, "config", "settings");
  await setDoc(ref, settings, { merge: true });
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
  const isOnlineForDatabase = "online";
  const isOfflineForDatabase = "offline";
  
  const unsubscribe = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(userStatusRef).set(isOfflineForDatabase).then(() => {
        set(userStatusRef, isOnlineForDatabase).catch((err) => console.warn("RTDB set failed:", err.message));
      }).catch((err) => console.warn("RTDB onDisconnect failed:", err.message));
    }
  });

  return () => {
    unsubscribe();
    import("firebase/database").then(({ set }) => {
      set(userStatusRef, "offline").catch(() => {});
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
  // Strip potential undefined values like pureLogic
  const cleanConfig = { 
    width: entry.gridConfig.width, 
    height: entry.gridConfig.height, 
    mines: entry.gridConfig.mines,
    ...(entry.gridConfig.pureLogic !== undefined && { pureLogic: entry.gridConfig.pureLogic })
  };
  await setDoc(ref, { ...entry, gridConfig: cleanConfig, id: ref.id });
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
