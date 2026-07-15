"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Gauge, Save, Check, XCircle } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { Ticket } from "../../components/Ticket";
import { workflowLabel } from "../../lib/workflowLabels";

// LPM processing follows the physical sequence:
// cutting -> grinding -> epoxy -> polishing -> finished stock.
// Grinding and polishing are machine entries; epoxy is confirmed between them.

export default function PolishingPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const [slabs, setSlabs] = useState<any[]>([]);
  const [allSlabs, setAllSlabs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const defaultOpDate = () => {
    const d = new Date();
    if (d.getHours() < 7) d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const [operationalDate, setOperationalDate] = useState(defaultOpDate());
  const [processType, setProcessType] = useState<"GRINDING" | "POLISHING">("GRINDING");
  const [machineId, setMachineId] = useState("");
  const [finishType, setFinishType] = useState<"glossy" | "leather">("glossy");
  const [selectedSlabIds, setSelectedSlabIds] = useState<string[]>([]);
  const [runtimeHours, setRuntimeHours] = useState("");
  const [powerKwh, setPowerKwh] = useState("");
  const [downtimeMinutes, setDowntimeMinutes] = useState("");
  const [downtimeReason, setDowntimeReason] = useState("");
  const [notes, setNotes] = useState("");

  const loadAll = async () => {
    const token = await getToken();
    if (!token) return;
    const [slabList, completeSlabList, machineList, sessionList] = await Promise.all([
      apiFetch(`/slabs/eligible-for-polishing?processType=${processType}`, token),
      apiFetch("/slabs", token),
      apiFetch("/machines", token),
      apiFetch(`/polishing-sessions?date=${operationalDate}`, token),
    ]);
    setSlabs(slabList);
    setAllSlabs(completeSlabList);
    setMachines(machineList);
    setSessions(sessionList);
    const lpm = machineList.find((m: any) => m.machineType === "POLISHING");
    if (lpm && !machineId) setMachineId(lpm.id);
  };

  useEffect(() => { void loadAll(); }, [operationalDate, processType]);

  // Only slabs that are cut and waiting — i.e. not yet polished or sold.
  const eligibleSlabs = slabs.filter((s) => s.eligible);
  const epoxyQueue = allSlabs.filter((s) => s.productionStage === "GRINDED" && s.inventoryStatus === "AVAILABLE");
  const lpmMachines = machines.filter((m) => m.machineType === "POLISHING");
  const selectedMachine = machines.find((m) => m.id === machineId);

  const toggleSlab = (id: string) =>
    setSelectedSlabIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const submit = async () => {
    if (!machineId || selectedSlabIds.length === 0) {
      setErrorMsg("Pick the LPM and at least one slab");
      setStatus("error");
      return;
    }
    setStatus("saving"); setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/polishing-sessions", token, {
        method: "POST",
        body: JSON.stringify({
          machineId,
          operationalDate,
          processType,
          finishType: processType === "GRINDING" ? "grinding" : finishType,
          slabIds: selectedSlabIds,
          runtimeHours: runtimeHours ? parseFloat(runtimeHours) : undefined,
          powerConsumptionKwh: powerKwh ? parseFloat(powerKwh) : undefined,
          downtimeMinutes: downtimeMinutes ? parseInt(downtimeMinutes) : undefined,
          downtimeReason: downtimeReason || undefined,
          notes: notes || undefined,
          idempotencyKey: `${processType.toLowerCase()}-start-${Date.now()}`,
        }),
      });
      setSelectedSlabIds([]);
      setRuntimeHours(""); setPowerKwh(""); setDowntimeMinutes(""); setDowntimeReason(""); setNotes("");
      await loadAll();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1800);
    } catch (e: any) { setErrorMsg(e.message); setStatus("error"); }
  };

  const applyEpoxy = async (slabId: string) => {
    setStatus("saving"); setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/polishing-sessions/epoxy", token, {
        method: "POST",
        body: JSON.stringify({ slabIds: [slabId], idempotencyKey: `epoxy-${slabId}-${Date.now()}` }),
      });
      await loadAll();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1800);
    } catch (e: any) { setErrorMsg(e.message); setStatus("error"); }
  };

  const complete = async (sessionId: string) => {
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/polishing-sessions/${sessionId}/complete`, token, {
      method: "POST",
      body: JSON.stringify({ reason: "completed", idempotencyKey: `polishing-complete-${sessionId}-${Date.now()}` }),
    });
    await loadAll();
  };

  const abort = async (sessionId: string) => {
    if (!confirm("Abort this polishing run and return slabs to unpolished stock?")) return;
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/polishing-sessions/${sessionId}/abort`, token, {
      method: "POST",
      body: JSON.stringify({ reason: "Aborted from polishing screen", idempotencyKey: `polishing-abort-${sessionId}-${Date.now()}` }),
    });
    await loadAll();
  };

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">LPM — GRINDING &amp; POLISHING</div>
          <div className="stamp-sub">
            STONEOS · VEDAM GRANITES{selectedMachine?.headCount ? ` · ${selectedMachine.headCount} heads × ${selectedMachine.abrasivesPerHead ?? 6} abrasives` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="date-box">
            <input type="date" value={operationalDate} onChange={(e) => setOperationalDate(e.target.value)} />
          </div>
          <AppNav />
        </div>
      </div>

      <Ticket icon={Gauge} title={`New ${processType === "GRINDING" ? "Grinding" : "Polishing"} Entry`} subtitle={processType === "GRINDING" ? "First LPM pass after cutting" : "Final LPM pass after grinding and epoxy"} accent="moss">
        <div className="workflow-tabs" aria-label="LPM entry type">
          <button className={processType === "GRINDING" ? "active" : ""} onClick={() => { setProcessType("GRINDING"); setSelectedSlabIds([]); }}>Grinding</button>
          <button className={processType === "POLISHING" ? "active" : ""} onClick={() => { setProcessType("POLISHING"); setSelectedSlabIds([]); }}>Polishing</button>
        </div>
        <div className="grid">
          <label className="field"><span className="field-label">Machine (LPM)</span>
            <select className="field-input" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
              <option value="">Select…</option>
              {lpmMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          {processType === "POLISHING" && <label className="field"><span className="field-label">Finish</span>
            <select className="field-input" value={finishType} onChange={(e) => setFinishType(e.target.value as any)}>
              <option value="glossy">Glossy</option>
              <option value="leather">Leather</option>
            </select>
          </label>}
          <label className="field"><span className="field-label">Runtime (hrs)</span>
            <input className="field-input" value={runtimeHours} onChange={(e) => setRuntimeHours(e.target.value)} placeholder="0" />
          </label>
          <label className="field"><span className="field-label">Power (kWh)</span>
            <input className="field-input" value={powerKwh} onChange={(e) => setPowerKwh(e.target.value)} placeholder="0" />
          </label>
          <label className="field"><span className="field-label">Downtime (min)</span>
            <input className="field-input" value={downtimeMinutes} onChange={(e) => setDowntimeMinutes(e.target.value)} placeholder="0" />
          </label>
          <label className="field"><span className="field-label">Downtime Reason</span>
            <input className="field-input" value={downtimeReason} onChange={(e) => setDowntimeReason(e.target.value)} placeholder="Optional" />
          </label>
          <label className="field"><span className="field-label">Notes</span>
            <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="field-label" style={{ marginBottom: 8 }}>
            Select Slabs Awaiting {processType === "GRINDING" ? "Grinding" : "Polishing"} ({selectedSlabIds.length} selected)
          </div>
          {eligibleSlabs.length === 0 ? (
            <p style={{ color: "#857c6c", fontSize: 13 }}>{processType === "GRINDING" ? "No cut slabs are waiting for grinding." : "No epoxy-applied slabs are waiting for polishing."}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {eligibleSlabs.map((s) => (
                <label
                  key={s.id}
                  className="row-card"
                  style={{
                    margin: 0, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                    borderColor: selectedSlabIds.includes(s.id) ? "var(--brass)" : "var(--stone-300)",
                    background: selectedSlabIds.includes(s.id) ? "#F3ECE2" : "white",
                  }}
                >
                  <input type="checkbox" checked={selectedSlabIds.includes(s.id)} onChange={() => toggleSlab(s.id)} />
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>{s.slabSerial}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</div>}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button className={`primary-btn ${status === "saved" ? "saved" : ""}`} onClick={submit} disabled={status === "saving"}>
            {status === "saved" ? <Check size={15} /> : <Save size={15} />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : `Record ${processType === "GRINDING" ? "Grinding" : "Polishing"} Entry`}
          </button>
        </div>
      </Ticket>

      <Ticket icon={Check} title="Epoxy Queue" subtitle="Confirm epoxy after grinding before a slab can enter polishing">
        {epoxyQueue.length === 0 ? <p className="empty-state">No grinded slabs are awaiting epoxy.</p> : epoxyQueue.map((slab) => (
          <div className="row-card" key={slab.id}>
            <div><strong>{slab.slabSerial}</strong><div className="muted">Grinding complete · {slab.location?.name ?? "LPM Queue"}</div></div>
            <button className="mini-btn" onClick={() => applyEpoxy(slab.id)}>Mark epoxy applied</button>
          </div>
        ))}
      </Ticket>

      <Ticket icon={Gauge} title={`Runs on ${operationalDate}`}>
        {sessions.length === 0 && <p style={{ color: "#857c6c", fontSize: 13 }}>No LPM entries recorded for this date yet.</p>}
        {sessions.map((s) => (
          <div className="row-card" key={s.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={`badge ${s.processType === "GRINDING" ? "mixed" : "invoiced"}`}>{s.processType === "GRINDING" ? "Grinding" : `Polishing · ${s.finishType}`}</span>
              <span style={{ fontSize: 12, color: "#857c6c" }}>{workflowLabel(s.status)} · {s.slabs?.length ?? 0} slabs</span>
            </div>
            <div style={{ fontSize: 11.5, fontFamily: "monospace", color: "#555", marginTop: 6 }}>
              {(s.slabs ?? []).map((ss: any) => ss.slab?.slabSerial).join(", ")}
            </div>
            {s.status === "IN_PROGRESS" && (
              <div className="action-row">
                {role !== "operator" && <button className="danger-btn" onClick={() => abort(s.id)}><XCircle size={13} /> Abort</button>}
                <button className="mini-btn" onClick={() => complete(s.id)}>Complete</button>
              </div>
            )}
          </div>
        ))}
      </Ticket>
    </div>
  );
}
