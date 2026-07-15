import { ClerkProvider } from "@clerk/nextjs";
import { RouteAccessGuard } from "../components/RouteAccessGuard";
import "./globals.css";

export const metadata = { title: "StoneOS — Vedam Granites" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_bG9jYWwubGNsLmRldiQ="}>
      <html lang="en">
        <body>
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <main id="main-content">
            <RouteAccessGuard clerkConfigured={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)}>{children}</RouteAccessGuard>
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
