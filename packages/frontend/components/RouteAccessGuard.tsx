"use client";

import { useState } from "react";
import { useAuth, useUser } from "../lib/auth";
import { usePathname } from "next/navigation";
import { canAccessRoute } from "../lib/routePolicy";

export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signIn } = useAuth();
  const { isLoaded, isSignedIn, user } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isLoaded) return <main className="access-gate">Checking access…</main>;
  if (!isSignedIn) return <main className="access-gate">
    <form onSubmit={async (event) => {
      event.preventDefault(); setSubmitting(true); setError("");
      try { await signIn(email, password); } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in failed"); }
      finally { setSubmitting(false); }
    }}>
      <h1>StoneOS sign in</h1>
      <p>Use credentials issued by your owner or manager.</p>
      <label className="field"><span className="field-label">Email</span><input className="field-input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="field"><span className="field-label">Password</span><input className="field-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <p className="auth-error">{error}</p>}
      <button className="primary-btn" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
    </form>
  </main>;

  const role = user?.publicMetadata?.role as string | undefined;
  if (!canAccessRoute(role, pathname)) return <main className="access-gate"><h1>Access restricted</h1><p>Your role does not include this workflow.</p></main>;
  return <>{children}</>;
}
