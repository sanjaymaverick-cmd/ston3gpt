"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { canAccessRoute } from "../lib/routePolicy";

export function RouteAccessGuard({ children, clerkConfigured }: { children: React.ReactNode; clerkConfigured: boolean }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();

  // Local visual preview remains usable without credentials. In every configured
  // deployment the guard below fails closed; backend guards remain authoritative.
  if (!clerkConfigured) return <>{children}</>;
  if (!isLoaded) return <main className="access-gate">Checking access…</main>;
  if (!isSignedIn) return <main className="access-gate"><h1>Sign in required</h1><p>Sign in with your StoneOS account to continue.</p><SignInButton mode="modal"><button className="primary-btn" style={{ margin: "18px auto 0" }}>Sign in</button></SignInButton></main>;

  const role = user.publicMetadata?.role as string | undefined;
  if (!canAccessRoute(role, pathname)) return <main className="access-gate"><h1>Access restricted</h1><p>Your role does not include this workflow.</p></main>;
  return <>{children}</>;
}
