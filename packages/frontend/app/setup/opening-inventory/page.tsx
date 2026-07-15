"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, ClipboardList, Plus, Send, XCircle } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { AppNav } from "../../../components/AppNav";
import { Ticket } from "../../../components/Ticket";

const today = () => new Date().toISOString().slice(0, 10);
const STEPS = ["Start", "Raw blocks", "Unpolished", "Finished", "Review"];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

export default function OpeningInventoryPage() {
  const { getToken } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [raw, setRaw] = useState({ serialNumber: "", varietyName: "UNKNOWN_LEGACY", weightTons: "", locationId: "", ownershipType: "UNKNOWN_LEGACY", verificationStatus: "PHYSICALLY_VERIFIED" });
  const [slab, setSlab] = useState({ slabSerial: "", varietyName: "UNKNOWN_LEGACY", inventoryKind: "UNPOLISHED_SLAB", parentBlockId: "", lineageStatus: "LEGACY_UNKNOWN", locationId: "", ownershipType: "UNKNOWN_LEGACY", verificationStatus: "PHYSICALLY_VERIFIED" });

  const load = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [locs, snaps] = await Promise.all([apiFetch("/inventory/locations", token), apiFetch("/opening-inventory/snapshots", token)]);
      setLocations(locs);
      setSnapshots(snaps);
      const current = snaps.find((s: any) => ["DRAFT", "SUBMITTED"].includes(s.status)) ?? snaps[0];
      if (current) setSnapshotId(current.id);
      setRaw((value) => ({ ...value, locationId: value.locationId || locs.find((l: any) => l.code === "RAW_YARD")?.id || "" }));
      setSlab((value) => ({ ...value, locationId: value.locationId || locs.find((l: any) => l.code === "UNPOLISHED_STOCK")?.id || "" }));
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  };

  useEffect(() => { void load(); }, []);

  const call = async (path: string, body?: any) => {
    try {
      const token = await getToken();
      if (!token) return;
      setError("");
      setStatus("saving");
      await apiFetch(path, token, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
      await load();
      setStatus("saved");
      setTimeout(() => setStatus(""), 1400);
    } catch (callError) {
      setStatus("");
      setError(errorMessage(callError));
    }
  };

  const active = snapshots.find((s) => s.id === snapshotId);
  const unresolved = active?.lines?.filter((line: any) => !["PHYSICALLY_VERIFIED", "APPROVED"].includes(line.verificationStatus)).length ?? 0;

  const setSlabStep = (nextStep: number) => {
    const finished = nextStep === 4;
    const code = finished ? "FINISHED_STOCK" : "UNPOLISHED_STOCK";
    setSlab((value) => ({ ...value, inventoryKind: finished ? "POLISHED_SLAB" : "UNPOLISHED_SLAB", locationId: locations.find((l) => l.code === code)?.id ?? value.locationId }));
    setStep(nextStep);
  };

  return <div className="app-shell">
    <div className="stamp"><div><div className="stamp-title">OPENING STOCK</div><div className="stamp-sub">GUIDED PHYSICAL COUNT</div></div><AppNav /></div>

    <div className="workflow-tabs" aria-label="Opening stock steps">
      {STEPS.map((label, index) => <button key={label} className={step === index + 1 ? "active" : ""} onClick={() => setStep(index + 1)}>{index + 1}. {label}</button>)}
    </div>

    {error && <div className="error-notice" role="alert"><XCircle size={16} /><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

    {step === 1 && <Ticket icon={ClipboardList} title="Start Physical Count" subtitle="Create a new count or resume one already in progress">
      <div className="wide-grid">
        <label className="field"><span className="field-label">Count</span><select className="field-input" value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)}><option value="">Select...</option>{snapshots.map((s) => <option key={s.id} value={s.id}>{new Date(s.countDate).toLocaleDateString("en-IN")} · {s.status.toLowerCase()}</option>)}</select></label>
        <button className="mini-btn" onClick={() => call("/opening-inventory/snapshots", { countDate: today() })}><Plus size={14} /> New count</button>
        <button className="primary-btn" disabled={!snapshotId} onClick={() => setStep(2)}>Continue <Send size={14} /></button>
      </div>
    </Ticket>}

    {step === 2 && <Ticket icon={Plus} title="Count Raw Blocks" subtitle="Old supplier and invoice information can remain blank">
      <div className="grid">{["serialNumber", "varietyName", "weightTons"].map((field) => <label className="field" key={field}><span className="field-label">{field === "serialNumber" ? "Block serial" : field === "varietyName" ? "Stone variety" : "Weight (tons)"}</span><input className="field-input" value={(raw as any)[field]} onChange={(e) => setRaw({ ...raw, [field]: e.target.value })} /></label>)}</div>
      <div className="action-row"><button className="primary-btn" disabled={!snapshotId} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/raw-blocks`, { ...raw, weightTons: raw.weightTons ? Number(raw.weightTons) : undefined })}><Plus size={14} /> Add block</button><button className="mini-btn" onClick={() => setSlabStep(3)}>Next: slabs</button></div>
    </Ticket>}

    {(step === 3 || step === 4) && <Ticket icon={Plus} title={step === 3 ? "Count Unpolished Slabs" : "Count Finished Slabs"} subtitle="Parent block can remain blank when historical parentage is unknown">
      <div className="grid">
        <label className="field"><span className="field-label">Slab serial</span><input className="field-input" value={slab.slabSerial} onChange={(e) => setSlab({ ...slab, slabSerial: e.target.value })} /></label>
        <label className="field"><span className="field-label">Stone variety</span><input className="field-input" value={slab.varietyName} onChange={(e) => setSlab({ ...slab, varietyName: e.target.value })} /></label>
        <label className="field"><span className="field-label">Parent block (optional)</span><input className="field-input" value={slab.parentBlockId} onChange={(e) => setSlab({ ...slab, parentBlockId: e.target.value, lineageStatus: e.target.value ? "LEGACY_KNOWN" : "LEGACY_UNKNOWN" })} /></label>
      </div>
      <div className="action-row"><button className="primary-btn" disabled={!snapshotId} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/slabs`, { ...slab, parentBlockId: slab.parentBlockId || undefined })}><Plus size={14} /> Add slab</button><button className="mini-btn" onClick={() => step === 3 ? setSlabStep(4) : setStep(5)}>{step === 3 ? "Next: finished slabs" : "Review count"}</button></div>
    </Ticket>}

    {step === 5 && <Ticket icon={ClipboardList} title={`Review Physical Count (${active?.lines?.length ?? 0})`} subtitle={`${active?.status?.toLowerCase() ?? "no count"} · ${unresolved} unresolved`}>
      {!active?.lines?.length ? <p className="empty-state">No legacy stock has been added. Submit this empty count to confirm a greenfield start; goods received in StoneOS remain separate.</p> : <table className="list-table"><thead><tr><th>Type</th><th>Item</th><th>Area</th><th>Verified</th></tr></thead><tbody>{active.lines.map((line: any) => <tr key={line.id}><td>{line.inventoryKind.replaceAll("_", " ").toLowerCase()}</td><td>{line.rawBlock?.serialNumber ?? line.slab?.slabSerial}</td><td>{locations.find((l) => l.id === line.locationId)?.name ?? "Stock area"}</td><td>{["PHYSICALLY_VERIFIED", "APPROVED"].includes(line.verificationStatus) ? "Yes" : "Needs review"}</td></tr>)}</tbody></table>}
      <div className="action-row">
        {active?.status === "DRAFT" && <button className="primary-btn" onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/submit`)}><Send size={14} /> Submit for approval</button>}
        {active?.status === "SUBMITTED" && <><label className="field"><span className="field-label">Reason if rejected</span><input className="field-input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></label><button className="danger-btn" disabled={!rejectReason} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/reject`, { reason: rejectReason })}><XCircle size={14} /> Reject</button><button className="primary-btn" disabled={unresolved > 0} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/approve`)}><Check size={14} /> Approve &amp; start operations</button></>}
        {active?.status === "APPROVED" && <span className="status-pill completed">Approved · Factory live</span>}
      </div>
    </Ticket>}
    {status && <p className="mono">{status}</p>}
  </div>;
}
