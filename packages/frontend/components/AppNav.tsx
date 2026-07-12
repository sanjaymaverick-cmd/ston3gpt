"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Activity,
  Boxes,
  BrainCircuit,
  ClipboardList,
  Factory,
  Gauge,
  History,
  PackagePlus,
  ReceiptText,
  Settings,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/ai", label: "AI OS", icon: BrainCircuit },
  { href: "/setup/opening-inventory", label: "Setup", icon: ClipboardList },
  { href: "/receipts/raw-blocks", label: "Receipts", icon: PackagePlus },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/dpr", label: "Production", icon: Factory },
  { href: "/polishing", label: "Polishing", icon: Gauge },
  { href: "/sales", label: "Sales", icon: Truck },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/machines", label: "Machines", icon: Settings },
  { href: "/tally", label: "Tally", icon: ReceiptText },
];

const MANAGER_LINKS = [
  { href: "/admin/historical-sales", label: "History", icon: History },
  { href: "/admin/users", label: "Team", icon: Users },
];

export function AppNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const links = role === "owner" || role === "manager" ? [...LINKS, ...MANAGER_LINKS] : LINKS;

  return (
    <div className="nav-links">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}>
          <Icon size={13} strokeWidth={2.3} />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}
