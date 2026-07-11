"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Activity, Check, Gauge, Plus, Save } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { Ticket } from "../../components/Ticket";

const today = () => new Date().toISOString().slice(0, 10);

export default function MachinesPage() {
  const { getToken } = useAuth();
  const [machines, setMachines] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", machineType: "CUTTING", bladeCount: "21", headCount: "", abrasivesPerHead: "" });
  const [logs, setLogs] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    setMachines(await apiFetch("/machines", token));
  };

  useEffect(() => { load(); }, []);

  const updateForm = (field: string, value: string) => {
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === "machineType" && value === "CUTTING" ? { bladeCount: f.bladeCount || "21", headCount: "", abrasivesPerHead: "" } : {}),
      ...(field === "machineType" && value === "POLISHING" ? { bladeCount: "", headCount: f.headCount || "16", abrasivesPerHead: f.abrasivesPerHead || "6" } : {}),
    }));
  };

  const createMachine = async () => {
    if (!form.name.trim()) return;
    setStatus("saving"); setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/machines", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          machineType: form.machineType,
          bladeCount: form.bladeCount ? Number(form.bladeCount) : undefined,
          headCount: form.headCount ? Number(form.headCount) : undefined,
          abrasivesPerHead: form.abrasivesPerHead ? Number(form.abrasivesPerHead) : undefined,
        }),
      });
      setForm({ name: "", machineType: "CUTTING", bladeCount: "21", headCount: "", abrasivesPerHead: "" });
      await load();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to create machine");
      setStatus("error");
    }
  };

  const updateLog = (machineId: string, field: string, value: string) =>
    setLogs((current) => ({ ...current, [machineId]: { logDate: today(), ...current[machineId], [field]: value } }));

  const saveLog = async (machineId: string) => {
    const log = logs[machineId] ?? { logDate: today() };
    setStatus("saving"); setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch(`/machines/${machineId}/log`, token, {
        method: "POST",
        body: JSON.stringify({
          logDate: log.logDate ?? today(),
          runtimeMinutes: log.runtimeMinutes ? Number(log.runtimeMinutes) : undefined,
          downtimeMinutes: log.downtimeMinutes ? Number(log.downtimeMinutes) : undefined,
          downtimeReason: log.downtimeReason || undefined,
          powerConsumptionKwh: log.powerConsumptionKwh ? Number(log.powerConsumptionKwh) : undefined,
          bladeOrHeadUsage: log.bladeOrHeadUsage || undefined,
        }),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to save log");
      setStatus("error");
    }
  };

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">MACHINES</div>
          <div className="stamp-sub">B-21 CUTTING - LPM POLISHING - DAILY LOGS</div>
        </div>
        <AppNav />
      </div>

      <div className="module-grid">
        <Ticket icon={Plus} title="Create Machine" subtitle="Factory equipment master" accent="moss">
          <div className="wide-grid">
            <label className="field"><span className="field-label">Machine Name</span><input className="field-input" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="B-21 or LPM" /></label>
            <label className="field"><span className="field-label">Type</span><select className="field-input" value={form.machineType} onChange={(e) => updateForm("machineType", e.target.value)}><option value="CUTTING">Cutting</option><option value="POLISHING">Polishing</option></select></label>
            {form.machineType === "CUTTING" ? (
              <label className="field"><span className="field-label">Blade Count</span><input className="field-input" value={form.bladeCount} onChange={(e) => updateForm("bladeCount", e.target.value)} /></label>
            ) : (
              <>
                <label className="field"><span className="field-label">Head Count</span><input className="field-input" value={form.headCount} onChange={(e) => updateForm("headCount", e.target.value)} /></label>
                <label className="field"><span className="field-label">Abrasives / Head</span><input className="field-input" value={form.abrasivesPerHead} onChange={(e) => updateForm("abrasivesPerHead", e.target.value)} /></label>
              </>
            )}
          </div>
          <div className="action-row">
            <button className={`primary-btn ${status === "saved" ? "saved" : ""}`} onClick={createMachine}>{status === "saved" ? <Check size={14} /> : <Plus size={14} />} Create</button>
          </div>
        </Ticket>

        <Ticket icon={Activity} title="Machine Register" subtitle={`${machines.length} machine(s)`}>
          {machines.length === 0 ? <p className="empty-state">No machines configured yet.</p> : machines.map((m) => (
            <div className="row-card" key={m.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{m.name}</span>
                <span className="badge invoiced">{m.machineType}</span>
              </div>
              <div className="ticket-subtitle">
                {m.bladeCount ? `${m.bladeCount} blades` : ""}
                {m.headCount ? `${m.headCount} heads x ${m.abrasivesPerHead ?? 0} abrasives` : ""}
              </div>
            </div>
          ))}
        </Ticket>
      </div>

      <Ticket icon={Gauge} title="Daily Machine Logs" subtitle="Runtime, downtime, power and consumable usage">
        {machines.length === 0 ? <p className="empty-state">Create machines before logging runtime.</p> : (
          <div className="module-grid">
            {machines.map((m) => (
              <div className="row-card" key={m.id} style={{ margin: 0 }}>
                <div className="section-bar">
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div className="ticket-subtitle">{m.machineType}</div>
                  </div>
                  <button className="mini-btn" onClick={() => saveLog(m.id)}><Save size={13} /> Save Log</button>
                </div>
                <div className="wide-grid">
                  <label className="field"><span className="field-label">Log Date</span><input className="field-input" type="date" value={logs[m.id]?.logDate ?? today()} onChange={(e) => updateLog(m.id, "logDate", e.target.value)} /></label>
                  <label className="field"><span className="field-label">Runtime Min</span><input className="field-input" value={logs[m.id]?.runtimeMinutes ?? ""} onChange={(e) => updateLog(m.id, "runtimeMinutes", e.target.value)} /></label>
                  <label className="field"><span className="field-label">Downtime Min</span><input className="field-input" value={logs[m.id]?.downtimeMinutes ?? ""} onChange={(e) => updateLog(m.id, "downtimeMinutes", e.target.value)} /></label>
                  <label className="field"><span className="field-label">Power kWh</span><input className="field-input" value={logs[m.id]?.powerConsumptionKwh ?? ""} onChange={(e) => updateLog(m.id, "powerConsumptionKwh", e.target.value)} /></label>
                  <label className="field"><span className="field-label">Downtime Reason</span><input className="field-input" value={logs[m.id]?.downtimeReason ?? ""} onChange={(e) => updateLog(m.id, "downtimeReason", e.target.value)} /></label>
                  <label className="field"><span className="field-label">Blade / Head Usage</span><input className="field-input" value={logs[m.id]?.bladeOrHeadUsage ?? ""} onChange={(e) => updateLog(m.id, "bladeOrHeadUsage", e.target.value)} /></label>
                </div>
              </div>
            ))}
          </div>
        )}
      </Ticket>

      {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</div>}
    </div>
  );
}
