"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Wallet, Save, Check, GitBranch } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { Ticket } from "../../components/Ticket";

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function ExpensesPage() {
  const { getToken } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [newVehicleName, setNewVehicleName] = useState("");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [rawBlocks, setRawBlocks] = useState<any[]>([]);
  const [allocation, setAllocation] = useState({ expenseId: "", rawBlockId: "", allocatedAmount: "", allocationMethod: "manual" });

  const [form, setForm] = useState({
    category: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    vehicleId: "",
    toWhom: "",
    notes: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const loadAll = async () => {
    const token = await getToken();
    if (!token) return;
    const [cats, vehs, exps, blocks] = await Promise.all([
      apiFetch("/expenses/categories", token),
      apiFetch("/vehicles", token),
      apiFetch("/expenses", token),
      apiFetch("/raw-blocks", token),
    ]);
    setCategories(cats);
    setVehicles(vehs);
    setExpenses(exps);
    setRawBlocks(blocks);
    if (!form.category && cats.length) setForm((f) => ({ ...f, category: cats[0] }));
  };

  useEffect(() => { loadAll(); }, []);

  const addVehicle = async () => {
    if (!newVehicleName.trim()) return;
    const token = await getToken();
    if (!token) return;
    const created = await apiFetch("/vehicles", token, { method: "POST", body: JSON.stringify({ name: newVehicleName }) });
    setNewVehicleName("");
    await loadAll();
    setForm((f) => ({ ...f, vehicleId: created.id }));
  };

  const submit = async () => {
    setErrorMsg("");
    if (form.category === "vehicle" && !form.vehicleId) {
      setErrorMsg("Select a vehicle — required for the 'vehicle' category");
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/expenses", token, {
        method: "POST",
        body: JSON.stringify({
          category: form.category,
          amount: parseFloat(form.amount) || 0,
          expenseDate: form.expenseDate,
          vehicleId: form.category === "vehicle" ? form.vehicleId : undefined,
          toWhom: form.toWhom || undefined,
        }),
      });
      setStatus("saved");
      setForm((f) => ({ ...f, amount: "", vehicleId: "", toWhom: "", notes: "" }));
      await loadAll();
      setTimeout(() => setStatus("idle"), 1800);
    } catch (e: any) {
      setErrorMsg(e.message?.includes("400") ? "Check the category/vehicle combination" : (e.message ?? "Failed to save"));
      setStatus("error");
    }
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const allocateExpense = async () => {
    const token = await getToken();
    if (!token || !allocation.expenseId || !allocation.rawBlockId) return;
    await apiFetch(`/expenses/${allocation.expenseId}/allocate`, token, {
      method: "POST",
      body: JSON.stringify({
        allocations: [{
          rawBlockId: allocation.rawBlockId,
          allocatedAmount: parseFloat(allocation.allocatedAmount) || 0,
          allocationMethod: allocation.allocationMethod,
        }],
      }),
    });
    setAllocation({ expenseId: "", rawBlockId: "", allocatedAmount: "", allocationMethod: "manual" });
    await loadAll();
  };

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">EXPENSES</div>
          <div className="stamp-sub">STONEOS · VEDAM GRANITES</div>
        </div>
        <AppNav />
      </div>

      <div className="ticket">
        <div className="ticket-notch left" /><div className="ticket-notch right" />
        <div className="ticket-header">
          <div className="ticket-icon rust"><Wallet size={16} /></div>
          <div>
            <div className="ticket-title">Add Expense</div>
            <div className="ticket-subtitle">Category list matches your real cash-book, not generic ERP defaults</div>
          </div>
        </div>

        <div className="grid">
          <label className="field">
            <span className="field-label">Category</span>
            <select className="field-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {categories.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Amount</span>
            <input className="field-input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
          </label>
          <label className="field">
            <span className="field-label">Date</span>
            <input className="field-input" type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">To Whom</span>
            <input className="field-input" value={form.toWhom} onChange={(e) => setForm((f) => ({ ...f, toWhom: e.target.value }))} placeholder="Payee name" />
          </label>

          {form.category === "vehicle" && (
            <label className="field">
              <span className="field-label">Vehicle</span>
              <select className="field-input" value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}>
                <option value="">Select…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          )}
        </div>

        {form.category === "vehicle" && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Or Add New Vehicle</span>
              <input className="field-input" placeholder="e.g. Isuzu" value={newVehicleName} onChange={(e) => setNewVehicleName(e.target.value)} />
            </label>
            <button className="add-btn" style={{ width: "auto", padding: "7px 12px" }} onClick={addVehicle}>Add</button>
          </div>
        )}

        {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</div>}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button className={`primary-btn ${status === "saved" ? "saved" : ""}`} onClick={submit} disabled={status === "saving"}>
            {status === "saved" ? <Check size={15} /> : <Save size={15} />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save Expense"}
          </button>
        </div>
      </div>

      <Ticket icon={GitBranch} title="Allocate Expense to Raw Block" subtitle="Attach transport, royalty, rent or consumable costs to block economics" accent="moss">
        <div className="wide-grid">
          <label className="field"><span className="field-label">Expense</span><select className="field-input" value={allocation.expenseId} onChange={(e) => setAllocation((a) => ({ ...a, expenseId: e.target.value }))}><option value="">Select...</option>{expenses.map((e) => <option key={e.id} value={e.id}>{new Date(e.expenseDate).toLocaleDateString("en-IN")} - {e.category} - Rs {fmt(Number(e.amount))}</option>)}</select></label>
          <label className="field"><span className="field-label">Raw Block</span><select className="field-input" value={allocation.rawBlockId} onChange={(e) => setAllocation((a) => ({ ...a, rawBlockId: e.target.value }))}><option value="">Select...</option>{rawBlocks.map((b) => <option key={b.id} value={b.id}>{b.serialNumber} - {b.varietyName}</option>)}</select></label>
          <label className="field"><span className="field-label">Allocated Amount</span><input className="field-input" value={allocation.allocatedAmount} onChange={(e) => setAllocation((a) => ({ ...a, allocatedAmount: e.target.value }))} /></label>
          <label className="field"><span className="field-label">Method</span><select className="field-input" value={allocation.allocationMethod} onChange={(e) => setAllocation((a) => ({ ...a, allocationMethod: e.target.value }))}><option value="manual">Manual</option><option value="by_weight">By weight</option><option value="by_area">By area</option></select></label>
        </div>
        <div className="action-row"><button className="primary-btn" onClick={allocateExpense}><Save size={14} /> Allocate</button></div>
      </Ticket>

      <div className="ticket">
        <div className="ticket-notch left" /><div className="ticket-notch right" />
        <div className="ticket-header">
          <div className="ticket-icon brass"><Wallet size={16} /></div>
          <div><div className="ticket-title">Recent Expenses</div></div>
        </div>
        <table className="list-table">
          <thead><tr><th>Date</th><th>Category</th><th>To Whom</th><th>Amount</th></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.expenseDate).toLocaleDateString("en-IN")}</td>
                <td style={{ fontFamily: "Space Grotesk" }}>
                  {e.category.replaceAll("_", " ")}{e.vehicle ? ` (${e.vehicle.name})` : ""}
                </td>
                <td style={{ fontFamily: "Space Grotesk" }}>{e.toWhom ?? "—"}</td>
                <td>₹{fmt(Number(e.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals-strip">
          <span className="label">Total Shown</span>
          <span className="value">₹{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}
