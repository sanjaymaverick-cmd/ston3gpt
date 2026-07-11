"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, ClipboardList, Plus, Send, XCircle } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { AppNav } from "../../../components/AppNav";
import { Ticket } from "../../../components/Ticket";

const today = () => new Date().toISOString().slice(0, 10);

export default function OpeningInventoryPage() {
  const { getToken } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [status, setStatus] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [raw, setRaw] = useState({ serialNumber: "", varietyName: "UNKNOWN_LEGACY", weightTons: "", locationId: "", ownershipType: "UNKNOWN_LEGACY", verificationStatus: "PHYSICALLY_VERIFIED" });
  const [slab, setSlab] = useState({ slabSerial: "", varietyName: "UNKNOWN_LEGACY", inventoryKind: "UNPOLISHED_SLAB", parentBlockId: "", lineageStatus: "LEGACY_UNKNOWN", locationId: "", ownershipType: "UNKNOWN_LEGACY", verificationStatus: "PHYSICALLY_VERIFIED" });

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    const [locs, snaps] = await Promise.all([
      apiFetch("/inventory/locations", token),
      apiFetch("/opening-inventory/snapshots", token),
    ]);
    setLocations(locs);
    setSnapshots(snaps);
    const draft = snaps.find((s: any) => s.status === "DRAFT" || s.status === "SUBMITTED") ?? snaps[0];
    if (draft) setSnapshotId(draft.id);
    if (!raw.locationId) {
      const rawYard = locs.find((l: any) => l.code === "RAW_YARD");
      const unpolished = locs.find((l: any) => l.code === "UNPOLISHED_STOCK");
      setRaw((r) => ({ ...r, locationId: rawYard?.id ?? "" }));
      setSlab((s) => ({ ...s, locationId: unpolished?.id ?? "" }));
    }
  };
  useEffect(() => { load(); }, []);

  const call = async (path: string, body?: any) => {
    const token = await getToken();
    if (!token) return;
    setStatus("saving");
    await apiFetch(path, token, body ? { method: "POST", body: JSON.stringify(body) } : { method: "POST" });
    await load();
    setStatus("saved");
    setTimeout(() => setStatus(""), 1400);
  };

  const active = snapshots.find((s) => s.id === snapshotId);
  const unresolved = active?.lines?.filter((l: any) => l.verificationStatus !== "PHYSICALLY_VERIFIED" && l.verificationStatus !== "APPROVED").length ?? 0;

  return (
    <div className="app-shell">
      <div className="stamp">
        <div><div className="stamp-title">OPENING INVENTORY</div><div className="stamp-sub">PHYSICAL STOCK BEFORE GO-LIVE</div></div>
        <AppNav />
      </div>

      <Ticket icon={ClipboardList} title="Snapshot" subtitle={`${active?.status ?? "no snapshot"} · unresolved lines: ${unresolved}`}>
        <div className="grid">
          <label className="field"><span className="field-label">Snapshot</span>
            <select className="field-input" value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)}>
              <option value="">Select...</option>
              {snapshots.map((s) => <option key={s.id} value={s.id}>{new Date(s.countDate).toLocaleDateString("en-IN")} · {s.status}</option>)}
            </select>
          </label>
          <button className="primary-btn" onClick={() => call("/opening-inventory/snapshots", { countDate: today() })}><Plus size={14} /> New Snapshot</button>
          <button className="mini-btn" disabled={!snapshotId} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/submit`)}><Send size={14} /> Submit</button>
          <button className="mini-btn" disabled={!snapshotId || unresolved > 0} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/approve`)}><Check size={14} /> Approve</button>
          <label className="field"><span className="field-label">Reject Reason</span><input className="field-input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Only for submitted snapshots" /></label>
          <button className="danger-btn" disabled={!snapshotId || !rejectReason} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/reject`, { reason: rejectReason })}><XCircle size={14} /> Reject</button>
          <button className="primary-btn" onClick={() => call("/factory/go-live")}><Check size={14} /> Go Live</button>
        </div>
      </Ticket>

      <Ticket icon={Plus} title="Opening Raw Block" subtitle="Legacy supplier and invoice information may stay blank">
        <div className="grid">
          {["serialNumber", "varietyName", "weightTons"].map((f) => (
            <label className="field" key={f}><span className="field-label">{f}</span><input className="field-input" value={(raw as any)[f]} onChange={(e) => setRaw({ ...raw, [f]: e.target.value })} /></label>
          ))}
          <label className="field"><span className="field-label">Location</span><select className="field-input" value={raw.locationId} onChange={(e) => setRaw({ ...raw, locationId: e.target.value })}>{locations.filter((l) => ["RAW_YARD", "B21_WIP"].includes(l.code)).map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}</select></label>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="primary-btn" disabled={!snapshotId} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/raw-blocks`, { ...raw, weightTons: raw.weightTons ? Number(raw.weightTons) : undefined })}><Plus size={14} /> Add Block</button>
        </div>
      </Ticket>

      <Ticket icon={Plus} title="Opening Slab" subtitle="Use LEGACY_UNKNOWN when the parent block is honestly unavailable">
        <div className="grid">
          {["slabSerial", "varietyName", "parentBlockId"].map((f) => (
            <label className="field" key={f}><span className="field-label">{f}</span><input className="field-input" value={(slab as any)[f]} onChange={(e) => setSlab({ ...slab, [f]: e.target.value })} /></label>
          ))}
          <label className="field"><span className="field-label">Kind</span><select className="field-input" value={slab.inventoryKind} onChange={(e) => setSlab({ ...slab, inventoryKind: e.target.value })}><option value="UNPOLISHED_SLAB">Unpolished</option><option value="POLISHED_SLAB">Polished</option></select></label>
          <label className="field"><span className="field-label">Lineage</span><select className="field-input" value={slab.lineageStatus} onChange={(e) => setSlab({ ...slab, lineageStatus: e.target.value })}><option value="LEGACY_UNKNOWN">Unknown legacy</option><option value="LEGACY_KNOWN">Known legacy</option></select></label>
          <label className="field"><span className="field-label">Location</span><select className="field-input" value={slab.locationId} onChange={(e) => setSlab({ ...slab, locationId: e.target.value })}>{locations.filter((l) => ["UNPOLISHED_STOCK", "FINISHED_STOCK", "LPM_WIP"].includes(l.code)).map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}</select></label>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="primary-btn" disabled={!snapshotId} onClick={() => call(`/opening-inventory/snapshots/${snapshotId}/slabs`, { ...slab, parentBlockId: slab.parentBlockId || undefined })}><Plus size={14} /> Add Slab</button>
        </div>
      </Ticket>

      <Ticket icon={ClipboardList} title={`Snapshot Lines (${active?.lines?.length ?? 0})`} subtitle="Physical count review before approval">
        {!active?.lines?.length ? <p className="empty-state">No lines on the selected snapshot yet.</p> : (
          <table className="list-table">
            <thead><tr><th>Kind</th><th>Item</th><th>Location</th><th>Ownership</th><th>Verification</th></tr></thead>
            <tbody>
              {active.lines.map((line: any) => (
                <tr key={line.id}>
                  <td>{line.inventoryKind}</td>
                  <td>{line.rawBlock?.serialNumber ?? line.slab?.slabSerial ?? line.id}</td>
                  <td>{locations.find((l) => l.id === line.locationId)?.code ?? line.locationId}</td>
                  <td>{line.ownershipType}</td>
                  <td>{line.verificationStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Ticket>

      {status && <p className="mono">{status}</p>}
    </div>
  );
}
