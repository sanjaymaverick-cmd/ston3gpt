"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { BarChart3, Check, History, Save } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { AppNav } from "../../../components/AppNav";
import { Ticket } from "../../../components/Ticket";

const num = (value: string) => (value === "" ? 0 : parseFloat(value) || 0);
const fmt = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function HistoricalSalesPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const canImport = role === "owner" || role === "manager";
  const today = new Date().toISOString().slice(0, 10);

  const [range, setRange] = useState({ from: today, to: today });
  const [summaries, setSummaries] = useState<any[]>([]);
  const [form, setForm] = useState({ summaryDate: today, totalQtySqft: "", invoicedAmount: "", actualAmountReceived: "", reason: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const loadSummaries = async () => {
    const token = await getToken();
    if (!token) return;
    setSummaries(await apiFetch(`/daily-sales-summary?from=${range.from}&to=${range.to}`, token));
  };

  useEffect(() => {
    if (canImport) loadSummaries();
  }, [canImport]);

  const saveBackfill = async () => {
    setStatus("saving");
    setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/daily-sales-summary/backfill", token, {
        method: "POST",
        body: JSON.stringify({
          summaryDate: form.summaryDate,
          totalQtySqft: num(form.totalQtySqft),
          invoicedAmount: num(form.invoicedAmount),
          actualAmountReceived: num(form.actualAmountReceived),
          reason: form.reason,
        }),
      });
      await loadSummaries();
      setForm({ summaryDate: today, totalQtySqft: "", invoicedAmount: "", actualAmountReceived: "", reason: "" });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1800);
    } catch (error: any) {
      setErrorMsg(error.message ?? "Failed to save historical summary");
      setStatus("error");
    }
  };

  if (!canImport) {
    return (
      <div className="app-shell">
        <div className="stamp">
          <div>
            <div className="stamp-title">HISTORICAL SALES</div>
            <div className="stamp-sub">STONEOS · VEDAM GRANITES</div>
          </div>
          <AppNav />
        </div>
        <div className="ticket">
          <div className="ticket-notch left" /><div className="ticket-notch right" />
          <p style={{ margin: 0 }}>Historical sales import is restricted to owners and managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">HISTORICAL SALES</div>
          <div className="stamp-sub">STONEOS · VEDAM GRANITES</div>
        </div>
        <AppNav />
      </div>

      <Ticket icon={History} title="Historical Sales Import" subtitle="Manager/owner controlled backfill">
        <div className="wide-grid">
          <label className="field"><span className="field-label">Date</span><input className="field-input" type="date" value={form.summaryDate} onChange={(e) => setForm((f) => ({ ...f, summaryDate: e.target.value }))} /></label>
          <label className="field"><span className="field-label">Qty Sqft</span><input className="field-input" value={form.totalQtySqft} onChange={(e) => setForm((f) => ({ ...f, totalQtySqft: e.target.value }))} /></label>
          <label className="field"><span className="field-label">Invoiced</span><input className="field-input" value={form.invoicedAmount} onChange={(e) => setForm((f) => ({ ...f, invoicedAmount: e.target.value }))} /></label>
          <label className="field"><span className="field-label">Received</span><input className="field-input" value={form.actualAmountReceived} onChange={(e) => setForm((f) => ({ ...f, actualAmountReceived: e.target.value }))} /></label>
          <label className="field"><span className="field-label">Import reason</span><input className="field-input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Source record and reason for backfill" /></label>
        </div>
        {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</div>}
        <div className="action-row">
          <button className={`primary-btn ${status === "saved" ? "saved" : ""}`} onClick={saveBackfill} disabled={status === "saving" || !form.reason.trim()}>
            {status === "saved" ? <Check size={15} /> : <Save size={15} />}
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save Historical Row"}
          </button>
        </div>
      </Ticket>

      <Ticket icon={BarChart3} title="Historical Summary Rows" subtitle="Imported rows are marked non-derived">
        <div className="inline-controls">
          <label className="field"><span className="field-label">From</span><input className="field-input" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
          <label className="field"><span className="field-label">To</span><input className="field-input" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
          <button className="mini-btn" onClick={loadSummaries}>Load</button>
        </div>
        <table className="list-table">
          <thead><tr><th>Date</th><th>Qty</th><th>Invoiced</th><th>Received</th><th>Source</th><th>Audit reason</th></tr></thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.id ?? summary.summaryDate}>
                <td>{new Date(summary.summaryDate).toLocaleDateString("en-IN")}</td>
                <td>{summary.totalQtySqft}</td>
                <td>Rs {fmt(Number(summary.invoicedAmount))}</td>
                <td>Rs {fmt(Number(summary.actualAmountReceived))}</td>
                <td>{summary.isDerived ? "Derived" : "Historical"}</td>
                <td>{summary.importReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Ticket>
    </div>
  );
}
