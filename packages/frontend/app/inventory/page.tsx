"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { Boxes, History, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { StoneStackVisual } from "../../components/FactoryVisuals";
import { Ticket } from "../../components/Ticket";
import { locationLabel, workflowLabel } from "../../lib/workflowLabels";

const demoInventoryRows = (count: number, factory: (index: number) => Record<string, any>) =>
  Array.from({ length: count }, (_, index) => {
    const values = factory(index);
    return { id: `inventory-demo-${values.slabSerial ?? values.serialNumber ?? index + 1}`, ...values };
  });

const demoLocations = [
  { id: "yard", code: "RAW_YARD", name: "Raw yard" },
  { id: "b21", code: "B21_QUEUE", name: "B-21 queue" },
  { id: "lpm", code: "LPM_QUEUE", name: "LPM queue" },
  { id: "finished", code: "FINISHED_STOCK", name: "Finished stock" },
];

const partnerInventoryDemo = {
  rawBlocks: demoInventoryRows(16, (index) => ({
    serialNumber: `V${101 + index}`,
    productionStage: "RAW",
    inventoryStatus: index > 13 ? "RESERVED" : "AVAILABLE",
    locationId: "yard",
    location: demoLocations[0],
  })),
  slabs: [
    ...demoInventoryRows(68, (index) => ({ slabSerial: `V101/50/${String(index + 1).padStart(2, "0")}`, productionStage: "CUT_UNPOLISHED", inventoryStatus: "AVAILABLE", locationId: "lpm", location: demoLocations[2] })),
    ...demoInventoryRows(12, (index) => ({ slabSerial: `V102/46/${String(index + 1).padStart(2, "0")}`, productionStage: "UNDER_GRINDING", inventoryStatus: "AVAILABLE", locationId: "lpm", location: demoLocations[2] })),
    ...demoInventoryRows(8, (index) => ({ slabSerial: `V103/44/${String(index + 1).padStart(2, "0")}`, productionStage: "UNDER_POLISHING", inventoryStatus: "AVAILABLE", locationId: "lpm", location: demoLocations[2] })),
    ...demoInventoryRows(96, (index) => ({ slabSerial: `V099/48/${String(index + 1).padStart(2, "0")}`, productionStage: "POLISHED", inventoryStatus: "AVAILABLE", locationId: "finished", location: demoLocations[3] })),
    ...demoInventoryRows(24, (index) => ({ slabSerial: `V100/47/${String(index + 1).padStart(2, "0")}`, productionStage: "POLISHED", inventoryStatus: "RESERVED", locationId: "finished", location: demoLocations[3] })),
  ],
  movements: [
    { id: "movement-demo-1", movementType: "PRODUCTION", slab: { slabSerial: "V101/50/01" }, fromLocation: demoLocations[1], toLocation: demoLocations[2] },
    { id: "movement-demo-2", movementType: "PRODUCTION", slab: { slabSerial: "V099/48/12" }, fromLocation: demoLocations[2], toLocation: demoLocations[3] },
    { id: "movement-demo-3", movementType: "RECEIPT", rawBlock: { serialNumber: "V116" }, fromLocation: null, toLocation: demoLocations[0] },
  ],
};

export default function InventoryPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const canManageExceptions = role === "owner" || role === "manager";
  const [onHand, setOnHand] = useState<any>({ rawBlocks: [], slabs: [] });
  const [movements, setMovements] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [adjustment, setAdjustment] = useState({ rawBlockId: "", slabId: "", fromLocationId: "", toLocationId: "", quantity: "1", reason: "" });
  const [exceptionType, setExceptionType] = useState("incorrect_location");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    const [stock, moves, locs] = await Promise.all([
      apiFetch("/inventory/on-hand", token),
      apiFetch("/inventory/movements", token),
      apiFetch("/inventory/locations", token),
    ]);
    setOnHand(stock);
    setMovements(moves);
    setLocations(locs);
  };

  useEffect(() => {
    const isPartnerDemo = new URLSearchParams(window.location.search).get("demo") === "partners";
    setDemoMode(isPartnerDemo);
    if (isPartnerDemo) {
      setOnHand({ rawBlocks: partnerInventoryDemo.rawBlocks, slabs: partnerInventoryDemo.slabs });
      setMovements(partnerInventoryDemo.movements);
      setLocations(demoLocations);
      setErrorMsg("");
      return;
    }
    load();
  }, []);

  const slabsBy = (stage: string) => onHand.slabs.filter((s: any) => s.productionStage === stage);
  const reserved = onHand.slabs.filter((s: any) => s.inventoryStatus === "RESERVED");
  const selectedItem = adjustment.rawBlockId || !adjustment.slabId ? "rawBlockId" : "slabId";

  const submitAdjustment = async () => {
    const token = await getToken();
    if (!token) return;
    if (!adjustment.reason.trim()) { setErrorMsg("Enter a reason for the adjustment"); return; }
    setStatus("saving"); setErrorMsg("");
    try {
      await apiFetch("/inventory/adjustments", token, {
        method: "POST",
        body: JSON.stringify({
          movementType: "ADJUSTMENT",
          rawBlockId: adjustment.rawBlockId || undefined,
          slabId: adjustment.slabId || undefined,
          fromLocationId: adjustment.fromLocationId || undefined,
          toLocationId: adjustment.toLocationId || undefined,
          quantity: Number(adjustment.quantity || 1),
          reason: `${exceptionType.replaceAll("_", " ")}: ${adjustment.reason}${evidenceNote.trim() ? ` | Evidence: ${evidenceNote.trim()}` : ""}`,
          idempotencyKey: `adjustment-${Date.now()}`,
        }),
      });
      setAdjustment({ rawBlockId: "", slabId: "", fromLocationId: "", toLocationId: "", quantity: "1", reason: "" });
      setEvidenceNote("");
      await load();
      setStatus("saved");
      setTimeout(() => setStatus(""), 1400);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Adjustment failed");
      setStatus("");
    }
  };

  const reverseMovement = async (movementId: string) => {
    const token = await getToken();
    if (!token) return;
    setStatus("saving"); setErrorMsg("");
    try {
      await apiFetch(`/inventory/movements/${movementId}/reverse`, token, {
        method: "POST",
        body: JSON.stringify({ reason: "Manual reversal from inventory ledger", idempotencyKey: `reverse-${movementId}-${Date.now()}` }),
      });
      await load();
      setStatus("saved");
      setTimeout(() => setStatus(""), 1400);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Reverse failed");
      setStatus("");
    }
  };

  return (
    <div className="app-shell">
      <div className="stamp"><div><div className="stamp-title">INVENTORY</div><div className="stamp-sub">ON HAND - RESERVATIONS - MOVEMENT HISTORY</div></div><AppNav /></div>

      {demoMode && <div className="demo-data-banner"><Boxes size={14} /> Partner demonstration · fictional inventory and movement data</div>}

      <Ticket icon={Boxes} title="Stock Position" subtitle="Operational inventory by workflow state">
        <div className="visual-dashboard">
          <div className="metric-grid">
            <div className="metric-card"><div className="metric-label">Raw Blocks</div><div className="metric-value">{onHand.rawBlocks.length}</div><div className="metric-note">available/reserved/hold</div></div>
            <div className="metric-card"><div className="metric-label">Unpolished</div><div className="metric-value">{slabsBy("CUT_UNPOLISHED").length}</div><div className="metric-note">ready for LPM</div></div>
            <div className="metric-card"><div className="metric-label">LPM WIP</div><div className="metric-value">{onHand.slabs.filter((s: any) => ["UNDER_GRINDING", "UNDER_POLISHING"].includes(s.productionStage)).length}</div><div className="metric-note">grinding or polishing</div></div>
            <div className="metric-card"><div className="metric-label">Finished</div><div className="metric-value">{slabsBy("POLISHED").length}</div><div className="metric-note">polished stock</div></div>
            <div className="metric-card"><div className="metric-label">Reserved</div><div className="metric-value">{reserved.length}</div><div className="metric-note">held by workflow</div></div>
          </div>
          <StoneStackVisual finished={slabsBy("POLISHED").length} reserved={reserved.length} unpolished={slabsBy("CUT_UNPOLISHED").length} />
        </div>
      </Ticket>

      <div className="module-grid">
        <Ticket icon={Boxes} title="Raw Blocks">
          {onHand.rawBlocks.length === 0 ? <p className="empty-state">No raw blocks on hand.</p> : onHand.rawBlocks.map((b: any) => (
            <div className="row-card" key={b.id}><span className="mono">{b.serialNumber}</span> · {workflowLabel(b.productionStage)} · {locationLabel(b.location)}</div>
          ))}
        </Ticket>
        <Ticket icon={Boxes} title="Slabs">
          {onHand.slabs.length === 0 ? <p className="empty-state">No slabs on hand.</p> : onHand.slabs.map((s: any) => (
            <div className="row-card" key={s.id}><span className="mono">{s.slabSerial}</span> · {workflowLabel(s.productionStage)} · {locationLabel(s.location)}</div>
          ))}
        </Ticket>
      </div>

      {canManageExceptions && <Ticket icon={SlidersHorizontal} title="Inventory Exceptions" subtitle="Manager-only corrections when the physical count differs from StoneOS" accent="rust">
        <div className="wide-grid">
          <label className="field"><span className="field-label">Item Type</span><select className="field-input" value={selectedItem} onChange={(e) => setAdjustment((a) => ({ ...a, rawBlockId: "", slabId: "", [e.target.value]: "" }))}><option value="rawBlockId">Raw Block</option><option value="slabId">Slab</option></select></label>
          {selectedItem === "rawBlockId" ? (
            <label className="field"><span className="field-label">Raw Block</span><select className="field-input" value={adjustment.rawBlockId} onChange={(e) => { const item = onHand.rawBlocks.find((b: any) => b.id === e.target.value); setAdjustment((a) => ({ ...a, rawBlockId: e.target.value, slabId: "", fromLocationId: item?.locationId ?? "" })); }}><option value="">Select block...</option>{onHand.rawBlocks.map((b: any) => <option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label>
          ) : (
            <label className="field"><span className="field-label">Slab</span><select className="field-input" value={adjustment.slabId} onChange={(e) => { const item = onHand.slabs.find((s: any) => s.id === e.target.value); setAdjustment((a) => ({ ...a, slabId: e.target.value, rawBlockId: "", fromLocationId: item?.locationId ?? "" })); }}><option value="">Select slab...</option>{onHand.slabs.map((s: any) => <option key={s.id} value={s.id}>{s.slabSerial}</option>)}</select></label>
          )}
          <label className="field"><span className="field-label">Move to area</span><select className="field-input" value={adjustment.toLocationId} onChange={(e) => setAdjustment((a) => ({ ...a, toLocationId: e.target.value }))}><option value="">Select correct area...</option>{locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}</select></label>
          <label className="field"><span className="field-label">Exception</span><select className="field-input" value={exceptionType} onChange={(e) => setExceptionType(e.target.value)}><option value="incorrect_location">Incorrect location</option><option value="found_during_count">Found during count</option><option value="missing_during_count">Missing during count</option><option value="damaged">Damaged</option><option value="other">Other</option></select></label>
          <label className="field"><span className="field-label">Quantity</span><input className="field-input" value={adjustment.quantity} onChange={(e) => setAdjustment((a) => ({ ...a, quantity: e.target.value }))} /></label>
          <label className="field"><span className="field-label">Reason</span><input className="field-input" value={adjustment.reason} onChange={(e) => setAdjustment((a) => ({ ...a, reason: e.target.value }))} placeholder="What happened?" /></label>
          <label className="field"><span className="field-label">Evidence note (optional)</span><input className="field-input" value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="Count sheet, photo reference or supervisor note" /></label>
        </div>
        <div className="action-row"><button className="primary-btn" onClick={submitAdjustment}><Save size={14} /> Record correction</button></div>
      </Ticket>}

      <Ticket icon={History} title="Movement History">
        <table className="list-table"><thead><tr><th>Type</th><th>Item</th><th>From</th><th>To</th><th></th></tr></thead><tbody>
          {movements.slice(0, 100).map((m) => (
            <tr key={m.id}><td>{m.movementType.replaceAll("_", " ").toLowerCase()}</td><td>{m.rawBlock?.serialNumber ?? m.slab?.slabSerial ?? "factory"}</td><td>{locationLabel(m.fromLocation)}</td><td>{locationLabel(m.toLocation)}</td><td>{canManageExceptions && <button className="mini-btn" onClick={() => reverseMovement(m.id)}><RotateCcw size={13} /> Reverse</button>}</td></tr>
          ))}
        </tbody></table>
      </Ticket>
      {status && <p className="mono">{status}</p>}
      {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</div>}
    </div>
  );
}
