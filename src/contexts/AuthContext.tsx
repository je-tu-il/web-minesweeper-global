import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { createOrUpdateProfile, getUserProfile, getBannedUsernames, setupPresence } from "@/lib/firestore";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isBanned: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { username?: string; avatarUrl?: string }) => Promise<void>;
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
          email: firebaseUser.email || undefined,
          role: "user",
          stats: { totalWins: 0, totalLosses: 0 },
          achievements: [],
          friends: [],
          following: [],
          createdAt: Date.now(),
        };
        await createOrUpdateProfile(firebaseUser.uid, newProfile);
        profile = newProfile;
      } else if (!profile.email && firebaseUser.email) {
        // Update existing profile with email
        await createOrUpdateProfile(firebaseUser.uid, { email: firebaseUser.email });
        profile.email = firebaseUser.email;
      }
      setUserProfile(profile);
      if (profile.username) {
        setIsBanned(!!profile.isBanned);
      }
      
      // Setup presence
      try {
        setupPresence(firebaseUser.uid);
      } catch (err) {
        console.error(err);
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

  async function updateProfile(data: { username?: string; avatarUrl?: string }) {
    if (!user) return;
    await createOrUpdateProfile(user.uid, data);
    
    if (data.username && userProfile) {
      setIsBanned(!!userProfile.isBanned);
    }
    
    setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
  }

  async function refreshProfile() {
    if (!user) return;
    await loadProfile(user);
  }

  return (
    <AuthContext.Provider
      value={{ user, userProfile, isLoading, isBanned, signInWithGoogle, logout, updateProfile, refreshProfile }}
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
