import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthSession {
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthSession = (): AuthSession => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
      if (nextUser) {
        const token = await nextUser.getIdToken();
        Cookies.set("firebase_id_token", token, { sameSite: "lax", secure: window.location.protocol === "https:" });
      } else {
        Cookies.remove("firebase_id_token");
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async (): Promise<void> => {
    await signOut(auth);
  };

  return { user, isLoading, signInWithGoogle, logout };
};
