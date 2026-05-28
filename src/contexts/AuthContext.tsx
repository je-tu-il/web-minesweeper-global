import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { createOrUpdateProfile, getUserProfile, getBannedUsernames } from "@/lib/firestore";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isBanned: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        await loadProfile(nextUser);
      } else {
        setUserProfile(null);
        setIsBanned(false);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function loadProfile(firebaseUser: User) {
    try {
      let profile = await getUserProfile(firebaseUser.uid);
      if (!profile) {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          username: "",
          role: "user",
          stats: { totalWins: 0, totalLosses: 0 },
          achievements: [],
          friends: [],
          createdAt: Date.now(),
        };
        await createOrUpdateProfile(firebaseUser.uid, newProfile);
        profile = newProfile;
      }
      setUserProfile(profile);
      if (profile.username) {
        const bannedList = await getBannedUsernames();
        setIsBanned(bannedList.includes(profile.username));
      }
    } catch (error) {
      console.error("Erreur chargement profil:", error);
    }
  }

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    await signOut(auth);
    setUserProfile(null);
    setIsBanned(false);
  }

  async function updateUsername(username: string) {
    if (!user) return;
    await createOrUpdateProfile(user.uid, { username });
    const bannedList = await getBannedUsernames();
    setIsBanned(bannedList.includes(username));
    setUserProfile((prev) => (prev ? { ...prev, username } : null));
  }

  async function refreshProfile() {
    if (!user) return;
    await loadProfile(user);
  }

  return (
    <AuthContext.Provider
      value={{ user, userProfile, isLoading, isBanned, signInWithGoogle, logout, updateUsername, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
