"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Activity,
  BrainCircuit,
  Boxes,
  Factory,
  Gauge,
  HeartPulse,
  Map,
  PackagePlus,
  Sparkles,
  Truck,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { FactoryFlowGraphic, SpatialMiniMap } from "../../components/FactoryVisuals";
import { Ticket } from "../../components/Ticket";

type Persona = "owner" | "manager" | "inventory" | "production" | "sales";
type ShiftRhythm = "calm" | "balanced" | "urgent";

const personas: Array<{ id: Persona; label: string; note: string }> = [
  { id: "owner", label: "Owner", note: "Cash, risk, throughput and exceptions first." },
  { id: "manager", label: "Manager", note: "Today flow, blockers and team handoffs first." },
  { id: "inventory", label: "Inventory", note: "Receipts, stock truth and location hygiene first." },
  { id: "production", label: "Production", note: "B-21, LPM and shift rhythm first." },
  { id: "sales", label: "Sales", note: "Finished slabs, reservations and delivery first." },
];

const rhythmLabel: Record<ShiftRhythm, string> = {
  calm: "Calm review",
  balanced: "Balanced shift",
  urgent: "Action mode",
};

export default function AiExperiencePage() {
  const { getToken } = useAuth();
  const [persona, setPersona] = useState<Persona>("owner");
  const [rhythm, setRhythm] = useState<ShiftRhythm>("balanced");
  const [focus, setFocus] = useState("flow");
  const [stock, setStock] = useState<any>({ rawBlocks: [], slabs: [] });
  const [orders, setOrders] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [cutting, setCutting] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("stoneos-ai-experience");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.persona) setPersona(parsed.persona);
      if (parsed.rhythm) setRhythm(parsed.rhythm);
      if (parsed.focus) setFocus(parsed.focus);
    } catch {}
  }, []);

  useEffect(() => {
    window.localStorage.setItem("stoneos-ai-experience", JSON.stringify({ persona, rhythm, focus }));
  }, [persona, rhythm, focus]);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const [onHand, sales, machineRows, activeCutting, openingRows] = await Promise.all([
          apiFetch("/inventory/on-hand", token),
          apiFetch("/sales-orders", token),
          apiFetch("/machines", token),
          apiFetch("/cutting-sessions/active", token),
          apiFetch("/opening-inventory/snapshots", token),
        ]);
        setStock(onHand);
        setOrders(sales);
        setMachines(machineRows);
        setCutting(activeCutting);
        setSnapshots(openingRows);
      } catch (e: any) {
        setError(e.message ?? "Unable to load AI context");
      }
    });
  }, [getToken]);

  const counts = useMemo(() => {
    const raw = stock.rawBlocks.filter((b: any) => b.inventoryStatus === "AVAILABLE").length;
    const rawReserved = stock.rawBlocks.filter((b: any) => b.inventoryStatus === "RESERVED").length;
    const unpolished = stock.slabs.filter((s: any) => s.productionStage === "CUT_UNPOLISHED").length;
    const lpmWip = stock.slabs.filter((s: any) => s.productionStage === "UNDER_POLISHING").length;
    const finished = stock.slabs.filter((s: any) => s.productionStage === "POLISHED" && s.inventoryStatus === "AVAILABLE").length;
    const reserved = stock.slabs.filter((s: any) => s.inventoryStatus === "RESERVED").length;
    const openSales = orders.filter((o) => ["CONFIRMED", "PARTIALLY_DELIVERED"].includes(o.status)).length;
    const needsSetup = !snapshots.some((s) => s.status === "APPROVED" || s.status === "LOCKED");
    return { raw, rawReserved, unpolished, lpmWip, finished, reserved, openSales, needsSetup };
  }, [stock, orders, snapshots]);

  const recommendations = useMemo(() => {
    const list: Array<{ tone: "priority" | "calm" | "spatial"; title: string; copy: string; href: string; icon: any }> = [];
    if (counts.needsSetup) {
      list.push({ tone: "priority", title: "Finish opening inventory before scaling workflows", copy: "The system should stay in setup posture until physical stock is approved and go-live is deliberate.", href: "/setup/opening-inventory", icon: PackagePlus });
    }
    if (persona === "production" || focus === "flow") {
      list.push({ tone: counts.raw > 0 ? "spatial" : "priority", title: counts.raw > 0 ? "Feed the B-21 from raw yard" : "Raw yard is thin for cutting", copy: `${counts.raw} available raw block(s), ${counts.rawReserved} reserved. Keep B-21 decisions visible before shift handoff.`, href: "/dpr", icon: Factory });
    }
    if (counts.unpolished > 0) {
      list.push({ tone: "spatial", title: "Batch LPM by finish and operator rhythm", copy: `${counts.unpolished} unpolished slab(s) are waiting. A focused LPM batch will convert hidden value into sellable stock.`, href: "/polishing", icon: Gauge });
    }
    if (persona === "sales" || counts.finished > 0) {
      list.push({ tone: "calm", title: "Turn finished stock into reserved commitments", copy: `${counts.finished} finished slab(s) are available and ${counts.reserved} are already reserved. Prioritize clean delivery-ready orders.`, href: "/sales", icon: Truck });
    }
    if (persona === "inventory") {
      list.push({ tone: "calm", title: "Keep location truth clean", copy: "Use movement reversal and adjustment only with reasons, so the physical yard and ledger keep agreeing.", href: "/inventory", icon: Boxes });
    }
    return list.slice(0, 4);
  }, [counts, persona, focus]);

  const zoneState = (value: number, alertWhenEmpty = false) => value > 0 ? "active" : alertWhenEmpty ? "alert" : "";
  const rhythmScore = rhythm === "calm" ? 2 : rhythm === "balanced" ? 3 : 5;

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">AI EXPERIENCE OS</div>
          <div className="stamp-sub">HYPER-PERSONALIZED - SPATIAL - HUMAN-CENTRIC</div>
        </div>
        <AppNav />
      </div>

      <div className="experience-shell">
        <div className="stack">
          <Ticket icon={BrainCircuit} title="Personalization DNA" subtitle="Saved locally for this device">
            <div className="persona-strip">
              {personas.map((p) => (
                <button key={p.id} className={`persona-chip ${persona === p.id ? "active" : ""}`} onClick={() => setPersona(p.id)}>
                  <div className="metric-label">{p.label}</div>
                  <div className="metric-note">{p.note}</div>
                </button>
              ))}
            </div>
            <div className="wide-grid" style={{ marginTop: 12 }}>
              <label className="field"><span className="field-label">Shift Rhythm</span><select className="field-input" value={rhythm} onChange={(e) => setRhythm(e.target.value as ShiftRhythm)}><option value="calm">Calm review</option><option value="balanced">Balanced shift</option><option value="urgent">Action mode</option></select></label>
              <label className="field"><span className="field-label">Primary Focus</span><select className="field-input" value={focus} onChange={(e) => setFocus(e.target.value)}><option value="flow">Factory flow</option><option value="cash">Cash recovery</option><option value="quality">Quality and trust</option><option value="handoff">Shift handoff</option></select></label>
            </div>
          </Ticket>

          <Ticket icon={Sparkles} title="AI Sensemaking" subtitle={`Tuned for ${personas.find((p) => p.id === persona)?.label}`}>
            <div className="stack">
              {recommendations.map(({ tone, title, copy, href, icon: Icon }) => (
                <Link className={`ai-card ${tone}`} href={href} key={title} style={{ color: "inherit", textDecoration: "none" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div className="ticket-icon brass"><Icon size={15} /></div>
                    <div>
                      <div className="ai-title">{title}</div>
                      <p className="ai-copy">{copy}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Ticket>

          <Ticket icon={HeartPulse} title="Human Rhythm" subtitle={rhythmLabel[rhythm]} accent="moss">
            <div className="human-panel">
              <div className="metric-label">Cognitive load</div>
              <div className="rhythm-scale">
                {[1, 2, 3, 4, 5].map((step) => <div key={step} className={`rhythm-step ${step <= rhythmScore ? "on" : ""}`} />)}
              </div>
              <p className="ai-copy" style={{ paddingLeft: 0 }}>
                {rhythm === "urgent"
                  ? "Compress screens around exceptions, reservations and blocked workflow actions."
                  : rhythm === "calm"
                    ? "Show context and history before action. Good for audit, setup and end-of-day review."
                    : "Balance action controls with enough context for safe shift execution."}
              </p>
            </div>
          </Ticket>
        </div>

        <div className="stack">
          <Ticket icon={Map} title="Spatial Factory Twin" subtitle="A lightweight 2.5D view of workflow pressure">
            <div className="spatial-stage">
              <div className="factory-plane">
                <div className={`spatial-zone ${zoneState(counts.raw, true)}`} style={{ gridColumn: "1", gridRow: "1" }}>
                  <div className="zone-label">Raw Yard</div>
                  <div className="zone-value">{counts.raw}</div>
                  <div className="metric-note">available blocks</div>
                </div>
                <div className={`spatial-zone ${zoneState(cutting.length)}`} style={{ gridColumn: "2", gridRow: "1" }}>
                  <div className="zone-label">B-21 Cutting</div>
                  <div className="zone-value">{cutting.length}</div>
                  <div className="metric-note">active session(s)</div>
                </div>
                <div className={`spatial-zone ${zoneState(counts.unpolished)}`} style={{ gridColumn: "3", gridRow: "1" }}>
                  <div className="zone-label">Unpolished Stock</div>
                  <div className="zone-value">{counts.unpolished}</div>
                  <div className="metric-note">awaiting LPM</div>
                </div>
                <div className={`spatial-zone ${zoneState(counts.lpmWip)}`} style={{ gridColumn: "2", gridRow: "2" }}>
                  <div className="zone-label">LPM WIP</div>
                  <div className="zone-value">{counts.lpmWip}</div>
                  <div className="metric-note">under polish</div>
                </div>
                <div className={`spatial-zone ${zoneState(counts.finished)}`} style={{ gridColumn: "3", gridRow: "2" }}>
                  <div className="zone-label">Finished Stock</div>
                  <div className="zone-value">{counts.finished}</div>
                  <div className="metric-note">sale-ready</div>
                </div>
                <div className={`spatial-zone ${zoneState(counts.openSales)}`} style={{ gridColumn: "3", gridRow: "3" }}>
                  <div className="zone-label">Dispatch / Sales</div>
                  <div className="zone-value">{counts.openSales}</div>
                  <div className="metric-note">open orders</div>
                </div>
              </div>
              <div className="spatial-caption">
                <div><strong>Factory flow field</strong><br /><span>{"Raw -> B-21 -> LPM -> Finished -> Dispatch"}</span></div>
                <span>{machines.length} machine(s) registered</span>
              </div>
            </div>
          </Ticket>

          <div className="visual-dashboard">
            <Ticket icon={Factory} title="Flow Graphic" subtitle="Readable as a shift-board">
              <FactoryFlowGraphic counts={{
                raw: counts.raw,
                cutting: cutting.length,
                unpolished: counts.unpolished,
                polishing: counts.lpmWip,
                finished: counts.finished,
                dispatch: counts.openSales,
              }} />
            </Ticket>
            <Ticket icon={Map} title="Compact Spatial Map" subtitle="Yard, machines, stock and dispatch">
              <SpatialMiniMap counts={{
                raw: counts.raw,
                cutting: cutting.length,
                unpolished: counts.unpolished,
                polishing: counts.lpmWip,
                finished: counts.finished,
                dispatch: counts.openSales,
              }} />
            </Ticket>
          </div>

          <Ticket icon={Activity} title="Adaptive Focus Lanes" subtitle="Same data, different mental model">
            <div className="focus-lane">
              <div className="focus-card"><strong>Owner View</strong><span>Surfaces cash, exception risk, delivery commitments and inventory stuck between stages.</span></div>
              <div className="focus-card"><strong>Supervisor View</strong><span>Prioritizes session starts, abort safety, daily logs and shift handoff clarity.</span></div>
              <div className="focus-card"><strong>Inventory View</strong><span>Keeps physical locations, movement reversals, opening stock and receipts in one trust loop.</span></div>
              <div className="focus-card"><strong>Sales View</strong><span>Turns polished availability into reservations, invoices, payments and dispatch readiness.</span></div>
            </div>
          </Ticket>
        </div>
      </div>

      {error && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
    </div>
  );
}
