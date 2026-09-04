import { AuthProvider } from "../lib/auth";
import { RouteAccessGuard } from "../components/RouteAccessGuard";
import { ServiceWorker } from "../components/ServiceWorker";
import "./globals.css";

export const metadata = { title: "StoneOS — Vedam Granites" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <html lang="en">
        <body>
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <main id="main-content">
            <RouteAccessGuard>{children}</RouteAccessGuard>
          </main>
          <ServiceWorker />
        </body>
      </html>
    </AuthProvider>
  );
}
