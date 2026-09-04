"use client";

import { createContext, useContext, useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const storageKey = "stoneos_session";

type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  publicMetadata: { factoryId: string; role: string };
};

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.name?.split(/\s+/)[0] || user.email,
    publicMetadata: { factoryId: user.factoryId, role: user.role },
  };
}

async function request(path: string, options: RequestInit = {}) {
  if (!apiUrl) throw new Error("StoneOS API is not configured");
  const response = await fetch(`${apiUrl}${path}`, options);
  if (!response.ok) throw new Error(response.status === 401 ? "Invalid email or password" : `Authentication failed (${response.status})`);
  return response.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) { setLoaded(true); return; }
    request("/auth/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then(({ user: currentUser }) => { setToken(stored); setUser(toAuthUser(currentUser)); })
      .catch(() => sessionStorage.removeItem(storageKey))
      .finally(() => setLoaded(true));
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    sessionStorage.setItem(storageKey, result.token);
    setToken(result.token);
    setUser(toAuthUser(result.user));
  };

  const signOut = async () => {
    if (token) await request("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    sessionStorage.removeItem(storageKey);
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ isLoaded, isSignedIn: Boolean(user), user, getToken: async () => token, signIn, signOut }}>{children}</AuthContext.Provider>;
}

function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}

export function useAuth() {
  const { getToken, signIn, signOut } = useAuthContext();
  return { getToken, signIn, signOut };
}

export function useUser() {
  const { isLoaded, isSignedIn, user } = useAuthContext();
  return { isLoaded, isSignedIn, user };
}

export function UserButton() {
  const { signOut } = useAuthContext();
  return <button className="account-button" type="button" onClick={() => signOut()} aria-label="Sign out">Sign out</button>;
}
