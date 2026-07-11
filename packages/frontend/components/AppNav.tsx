"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/setup/opening-inventory", label: "Setup" },
  { href: "/receipts/raw-blocks", label: "Receipts" },
  { href: "/inventory", label: "Inventory" },
  { href: "/dpr", label: "Production" },
  { href: "/polishing", label: "Polishing" },
  { href: "/sales", label: "Sales" },
  { href: "/expenses", label: "Expenses" },
  { href: "/machines", label: "Machines" },
  { href: "/tally", label: "Tally" },
];

export function AppNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const links = role === "owner" || role === "admin" ? [...LINKS, { href: "/admin/users", label: "Team" }] : LINKS;

  return (
    <div className="nav-links">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href || pathname.startsWith(`${l.href}/`) ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
