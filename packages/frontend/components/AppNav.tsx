"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Activity, Boxes, ChevronDown, ClipboardList, Factory, Gauge, History, PackagePlus, ReceiptText, Settings, ShieldCheck, Truck, Users, Wallet, type LucideIcon } from "lucide-react";

type NavLink = { href: string; label: string; icon: LucideIcon };
const DASHBOARD: NavLink = { href: "/dashboard", label: "My Work", icon: Activity };
const OPERATIONS: NavLink[] = [
  { href: "/receipts/raw-blocks", label: "Receive", icon: PackagePlus },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/dpr", label: "Cutting", icon: Factory },
  { href: "/polishing", label: "Polishing", icon: Gauge },
  { href: "/sales", label: "Orders & Dispatch", icon: Truck },
];
const FINANCE: NavLink[] = [{ href: "/expenses", label: "Expenses", icon: Wallet }];
const ADMIN: NavLink[] = [
  { href: "/setup/opening-inventory", label: "Opening Setup", icon: ClipboardList },
  { href: "/machines", label: "Machines", icon: Settings },
  { href: "/tally", label: "Tally Imports", icon: ReceiptText },
  { href: "/admin/historical-sales", label: "Historical Data", icon: History },
  { href: "/admin/users", label: "Team Access", icon: Users },
];

function linksFor(role?: string): NavLink[] {
  if (role === "operator") return [DASHBOARD, OPERATIONS[2], OPERATIONS[3]];
  if (role === "inventory") return [DASHBOARD, OPERATIONS[0], OPERATIONS[1], OPERATIONS[4]];
  if (role === "sales") return [DASHBOARD, OPERATIONS[1], OPERATIONS[4]];
  if (role === "accountant") return [DASHBOARD, OPERATIONS[4], ...FINANCE, ADMIN[2]];
  if (role === "auditor") return [DASHBOARD, OPERATIONS[1], OPERATIONS[4], ...FINANCE];
  if (role === "supervisor") return [DASHBOARD, ...OPERATIONS];
  if (role === "manager" || role === "owner") return [DASHBOARD, ...OPERATIONS, ...FINANCE];
  return [DASHBOARD];
}

export function AppNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const links = linksFor(role);
  const isManager = role === "manager" || role === "owner";
  return <div className="nav-links">
    {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}><Icon size={13} strokeWidth={2.3} /><span>{label}</span></Link>)}
    {isManager && <details className="nav-admin" open={pathname.startsWith("/admin") || pathname.startsWith("/setup") || pathname.startsWith("/machines") || pathname.startsWith("/tally")}>
      <summary><ShieldCheck size={18} /><span>Admin</span><ChevronDown className="nav-admin-chevron" size={14} /></summary>
      <div className="nav-admin-links">{ADMIN.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}><Icon size={13} /><span>{label}</span></Link>)}</div>
    </details>}
  </div>;
}
