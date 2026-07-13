"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { Activity, Bell, Boxes, BrainCircuit, ClipboardList, Factory, Gauge, PackagePlus, ReceiptText, Search, Sparkles, Truck, Wallet } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { FactoryFlowGraphic, StoneStackVisual } from "../../components/FactoryVisuals";
import { Ticket } from "../../components/Ticket";
import { workflowLabel } from "../../lib/workflowLabels";

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const [stock, setStock] = useState<any>({ rawBlocks: [], slabs: [] });
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [cutting, setCutting] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [tallyBatches, setTallyBatches] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!role) return;
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const allowed = (roles: string[]) => roles.includes(role);
        const load = (path: string, roles: string[], fallback: any) => allowed(roles) ? apiFetch(path, token) : Promise.resolve(fallback);
        const [onHand, sales, expenseRows, machineRows, activeCutting, openingRows, batches] = await Promise.all([
          load("/inventory/on-hand", ["owner", "manager", "supervisor", "operator", "inventory", "sales", "auditor"], { rawBlocks: [], slabs: [] }),
          load("/sales-orders", ["owner", "manager", "supervisor", "sales", "inventory", "accountant", "auditor"], []),
          load("/expenses", ["owner", "manager", "supervisor", "accountant", "auditor"], []),
          load("/machines", ["owner", "manager"], []),
          load("/cutting-sessions/active", ["owner", "manager", "supervisor", "operator"], []),
          load("/opening-inventory/snapshots", ["owner", "manager", "supervisor", "auditor"], []),
          load("/tally-import/batches", ["owner", "manager", "accountant"], []),
        ]);
        setStock(onHand);
        setOrders(sales);
        setExpenses(expenseRows);
        setMachines(machineRows);
        setCutting(activeCutting);
        setSnapshots(openingRows);
        setTallyBatches(batches);
      } catch (e: any) {
        setError(e.message ?? "Unable to load dashboard");
      }
    });
  }, [getToken, role]);

  const metrics = useMemo(() => {
    const rawAvailable = stock.rawBlocks.filter((b: any) => b.inventoryStatus === "AVAILABLE").length;
    const unpolished = stock.slabs.filter((s: any) => s.productionStage === "CUT_UNPOLISHED").length;
    const finished = stock.slabs.filter((s: any) => s.productionStage === "POLISHED" && s.inventoryStatus === "AVAILABLE").length;
    const reserved = stock.slabs.filter((s: any) => s.inventoryStatus === "RESERVED").length;
    const openSales = orders.filter((o) => ["CONFIRMED", "PARTIALLY_DELIVERED"].includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amount), 0);
    return { rawAvailable, unpolished, finished, reserved, openSales, delivered, expenseTotal };
  }, [stock, orders, expenses]);

  const latestSnapshot = snapshots[0];
  const modules = [
    { href: "/ai", label: "AI Experience OS", icon: BrainCircuit, note: "Personalized spatial cockpit" },
    { href: "/setup/opening-inventory", label: "Opening Inventory", icon: ClipboardList, note: latestSnapshot ? latestSnapshot.status : "No snapshot yet" },
    { href: "/receipts/raw-blocks", label: "Raw Receipts", icon: PackagePlus, note: "Receive raw blocks into yard" },
    { href: "/inventory", label: "Inventory", icon: Boxes, note: `${stock.rawBlocks.length + stock.slabs.length} stock rows` },
    { href: "/dpr", label: "B-21 Production", icon: Factory, note: `${cutting.length} active session(s)` },
    { href: "/polishing", label: "LPM Polishing", icon: Gauge, note: `${metrics.unpolished} slab(s) awaiting polish` },
    { href: "/sales", label: "Sales", icon: Truck, note: `${metrics.openSales} open order(s)` },
    { href: "/expenses", label: "Expenses", icon: Wallet, note: `INR ${fmt(metrics.expenseTotal)} shown` },
    { href: "/machines", label: "Machines", icon: Activity, note: `${machines.length} machine(s)` },
    { href: "/tally", label: "Tally Imports", icon: ReceiptText, note: `${tallyBatches.length} import batch(es)` },
  ];
  const roleDestinations: Record<string, string[]> = {
    operator: ["/dpr", "/polishing"],
    supervisor: ["/receipts/raw-blocks", "/inventory", "/dpr", "/polishing", "/sales"],
    inventory: ["/receipts/raw-blocks", "/inventory", "/sales"],
    sales: ["/inventory", "/sales"],
    accountant: ["/sales", "/expenses", "/tally"],
    auditor: ["/inventory", "/sales", "/expenses"],
  };
  const visibleModules = role && roleDestinations[role]
    ? modules.filter((module) => roleDestinations[role].includes(module.href))
    : role === "owner" || role === "manager" ? modules : [];
  const canViewProduction = !!role && ["owner", "manager", "supervisor", "operator"].includes(role);
  const canViewSales = !!role && ["owner", "manager", "supervisor", "sales", "inventory", "accountant", "auditor"].includes(role);
  const canViewExpenses = !!role && ["owner", "manager", "supervisor", "accountant", "auditor"].includes(role);
  const canViewAi = role === "owner" || role === "manager";

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">STONEOS</div>
          <div className="stamp-sub">VEDAM GRANITES · LOCAL WORKFLOW BUILD</div>
        </div>
        <AppNav />
      </div>

      <header className="dashboard-heading">
        <div>
          <div className="dashboard-eyebrow">VEDAM GRANITES / OPERATIONS</div>
          <h1>My Work</h1>
          <p>{role === "operator" ? "Record today’s cutting and polishing work." : role === "supervisor" ? "Keep production, inventory and dispatch moving." : "Live production, inventory and commercial overview."}</p>
        </div>
        <div className="dashboard-tools">
          <label className="dashboard-search">
            <Search size={17} />
            <input aria-label="Search dashboard" placeholder="Search" />
          </label>
          <button className="dashboard-icon-btn" aria-label="Notifications"><Bell size={18} /></button>
          <div className="dashboard-avatar" aria-label="StoneOS account menu"><UserButton afterSignOutUrl="/" /></div>
        </div>
      </header>

      <div className="visual-dashboard">
        <Ticket icon={Factory} title="Factory Flow Map" subtitle="Raw yard to dispatch as one live operating surface">
          <FactoryFlowGraphic counts={{
            raw: metrics.rawAvailable,
            cutting: cutting.length,
            unpolished: metrics.unpolished,
            polishing: stock.slabs.filter((s: any) => s.productionStage === "UNDER_POLISHING").length,
            finished: metrics.finished,
            dispatch: metrics.openSales,
          }} />
        </Ticket>
        <Ticket icon={Boxes} title="Material Stack" subtitle="Sale readiness at a glance" accent="moss">
          <StoneStackVisual finished={metrics.finished} reserved={metrics.reserved} unpolished={metrics.unpolished} />
        </Ticket>
      </div>

      <Ticket icon={Activity} title="Today at a glance" subtitle="Live operational counts from workflow modules">
        <div className="metric-grid">
          <div className="metric-card"><div className="metric-label">Raw available</div><div className="metric-value">{metrics.rawAvailable}</div><div className="metric-note">ready for B-21</div></div>
          <div className="metric-card"><div className="metric-label">Unpolished slabs</div><div className="metric-value">{metrics.unpolished}</div><div className="metric-note">waiting for LPM</div></div>
          <div className="metric-card"><div className="metric-label">Finished stock</div><div className="metric-value">{metrics.finished}</div><div className="metric-note">available for sale</div></div>
          {canViewSales && <div className="metric-card"><div className="metric-label">Reserved slabs</div><div className="metric-value">{metrics.reserved}</div><div className="metric-note">held by orders</div></div>}
          {canViewSales && <div className="metric-card"><div className="metric-label">Open sales</div><div className="metric-value">{metrics.openSales}</div><div className="metric-note">{metrics.delivered} delivered</div></div>}
          {canViewExpenses && <div className="metric-card"><div className="metric-label">Expense total</div><div className="metric-value">INR {fmt(metrics.expenseTotal)}</div><div className="metric-note">current list</div></div>}
        </div>
      </Ticket>

      {role && <Ticket icon={Sparkles} title="Personalized Next Best Actions" subtitle="A lightweight AI-ready layer over current workflow data" accent="moss">
        <div className="focus-lane">
          {canViewAi && <Link className="ai-card spatial" href="/ai" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="ai-title">Open the AI Experience OS</div>
            <p className="ai-copy">Switch between owner, manager, production, inventory and sales mental models without changing the underlying workflow truth.</p>
          </Link>}
          {canViewProduction && <Link className={`ai-card ${metrics.rawAvailable === 0 ? "priority" : "calm"}`} href="/dpr" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="ai-title">B-21 readiness</div>
            <p className="ai-copy">{metrics.rawAvailable} raw block(s) are ready for cutting and {cutting.length} session(s) are active.</p>
          </Link>}
          {canViewSales && <Link className={`ai-card ${metrics.finished > 0 ? "calm" : "spatial"}`} href="/sales" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="ai-title">Sales conversion</div>
            <p className="ai-copy">{metrics.finished} finished slab(s), {metrics.reserved} reserved slab(s), and {metrics.openSales} open sales order(s).</p>
          </Link>}
        </div>
      </Ticket>}

      {role && <Ticket icon={ClipboardList} title="Modules" subtitle="Your available operational entry points">
        <div className="module-grid">
          {visibleModules.map(({ href, label, icon: Icon, note }) => (
            <Link className="row-card" key={href} href={href} style={{ textDecoration: "none", color: "inherit", margin: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div className="ticket-icon brass"><Icon size={16} /></div>
                <div>
                  <div style={{ fontWeight: 700 }}>{label}</div>
                  <div className="ticket-subtitle">{note}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Ticket>}

      {!role && <Ticket icon={ClipboardList} title="Local Preview" subtitle="Connect Clerk credentials to exercise authenticated role workflows"><p className="empty-state">Role-specific navigation and actions are hidden until an authenticated role is available.</p></Ticket>}

      <div className="module-grid">
        <Ticket icon={Factory} title="Active Cutting">
          {cutting.length === 0 ? <p className="empty-state">No raw block is currently on B-21.</p> : cutting.map((s) => (
            <div className="row-card" key={s.id}>
              <span className="mono">{s.rawBlock?.serialNumber}</span> · {s.rawBlock?.varietyName}
              <div className="ticket-subtitle">{s.dayLogs?.length ?? 0} day log(s)</div>
            </div>
          ))}
        </Ticket>
        {canViewSales && <Ticket icon={Truck} title="Open Sales">
          {orders.filter((o) => ["CONFIRMED", "PARTIALLY_DELIVERED"].includes(o.status)).slice(0, 6).map((o) => (
            <div className="row-card" key={o.id}>
              <span style={{ fontWeight: 700 }}>{o.customer?.name}</span>
              <div className="ticket-subtitle">{new Date(o.orderDate).toLocaleDateString("en-IN")} · {workflowLabel(o.status)} · {o.lineItems?.length ?? 0} line(s)</div>
            </div>
          ))}
          {metrics.openSales === 0 && <p className="empty-state">No open sales reservations.</p>}
        </Ticket>}
      </div>

      {error && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
    </div>
  );
}
