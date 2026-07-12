"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { ClipboardList, Plus, Trash2, Save, Check, Ban, Receipt, IndianRupee, BarChart3 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { Ticket } from "../../components/Ticket";

interface LineItem {
  id: string;
  slabId: string;
  varietyName: string;
  quantity: string;
  unitPrice: string;
  gstAmount: string;
  loadingCharge: string;
  transportCharge: string;
  invoicedAmount: string;
  actualAmountReceived: string;
  paymentType: "invoiced" | "cash" | "mixed";
}

const num = (v: string) => (v === "" ? 0 : parseFloat(v) || 0);
const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const newLine = (): LineItem => ({
  id: crypto.randomUUID(), slabId: "", varietyName: "", quantity: "", unitPrice: "",
  gstAmount: "", loadingCharge: "", transportCharge: "", invoicedAmount: "",
  actualAmountReceived: "", paymentType: "invoiced",
});

export default function SalesPage() {
  const { getToken } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [orders, setOrders] = useState<any[]>([]);
  const [slabs, setSlabs] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({ salesOrderId: "", invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10), invoicedAmount: "", gstAmount: "" });
  const [paymentForm, setPaymentForm] = useState({ invoiceId: "", paymentDate: new Date().toISOString().slice(0, 10), amount: "", paymentMode: "bank" });
  const [summaryRange, setSummaryRange] = useState({ from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const loadCustomers = async () => {
    const token = await getToken();
    if (!token) return;
    setCustomers(await apiFetch("/customers", token));
  };
  const loadOrders = async () => {
    const token = await getToken();
    if (!token) return;
    setOrders(await apiFetch("/sales-orders", token));
  };
  const loadSlabs = async () => {
    const token = await getToken();
    if (!token) return;
    setSlabs((await apiFetch("/slabs/eligible-for-sale", token)).filter((s: any) => s.eligible));
  };
  const loadSummaries = async () => {
    const token = await getToken();
    if (!token) return;
    setSummaries(await apiFetch(`/daily-sales-summary?from=${summaryRange.from}&to=${summaryRange.to}`, token));
  };

  useEffect(() => { loadCustomers(); loadOrders(); loadSlabs(); loadSummaries(); }, []);

  const addCustomer = async () => {
    if (!newCustomerName.trim()) return;
    const token = await getToken();
    if (!token) return;
    const created = await apiFetch("/customers", token, { method: "POST", body: JSON.stringify({ name: newCustomerName }) });
    setNewCustomerName("");
    await loadCustomers();
    setCustomerId(created.id);
  };

  const updateLine = (id: string, field: keyof LineItem, value: string) =>
    setLines((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const lineTotal = (l: LineItem) => num(l.quantity) * num(l.unitPrice) + num(l.gstAmount) + num(l.loadingCharge) + num(l.transportCharge);
  const orderTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  const submitOrder = async () => {
    if (!customerId) { setErrorMsg("Pick or add a customer first"); setStatus("error"); return; }
    setStatus("saving");
    setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/sales-orders", token, {
        method: "POST",
        body: JSON.stringify({
          customerId,
          orderDate,
          lineItems: lines.map((l) => ({
            slabId: l.slabId,
            quantity: num(l.quantity),
            unitPrice: num(l.unitPrice),
          })),
        }),
      });
      setStatus("saved");
      setLines([newLine()]);
      await loadOrders(); await loadSlabs();
      setTimeout(() => setStatus("idle"), 1800);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to save order");
      setStatus("error");
    }
  };

  const deliverOrder = async (order: any) => {
    const token = await getToken();
    if (!token) return;
    const slabIds = (order.reservations ?? []).filter((r: any) => r.status === "ACTIVE").map((r: any) => r.slabId);
    await apiFetch(`/sales-orders/${order.id}/deliveries`, token, {
      method: "POST",
      body: JSON.stringify({ deliveryDate: new Date().toISOString().slice(0, 10), slabIds, idempotencyKey: `delivery-${order.id}-${Date.now()}` }),
    });
    await loadOrders(); await loadSlabs();
  };

  const cancelOrder = async (order: any) => {
    if (!confirm("Cancel this sales order and release reserved slabs?")) return;
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/sales-orders/${order.id}/cancel`, token, { method: "POST" });
    await loadOrders(); await loadSlabs();
  };

  const createInvoice = async () => {
    const token = await getToken();
    if (!token) return;
    const invoice = await apiFetch("/invoices", token, {
      method: "POST",
      body: JSON.stringify({
        salesOrderId: invoiceForm.salesOrderId,
        invoiceNumber: invoiceForm.invoiceNumber,
        invoiceDate: invoiceForm.invoiceDate,
        invoicedAmount: num(invoiceForm.invoicedAmount),
        gstAmount: invoiceForm.gstAmount ? num(invoiceForm.gstAmount) : undefined,
      }),
    });
    setPaymentForm((p) => ({ ...p, invoiceId: invoice.id, amount: invoiceForm.invoicedAmount }));
    setInvoiceForm({ salesOrderId: "", invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10), invoicedAmount: "", gstAmount: "" });
  };

  const createPayment = async () => {
    const token = await getToken();
    if (!token) return;
    await apiFetch("/payments", token, {
      method: "POST",
      body: JSON.stringify({
        invoiceId: paymentForm.invoiceId,
        paymentDate: paymentForm.paymentDate,
        amount: num(paymentForm.amount),
        paymentMode: paymentForm.paymentMode,
      }),
    });
    setPaymentForm({ invoiceId: "", paymentDate: new Date().toISOString().slice(0, 10), amount: "", paymentMode: "bank" });
  };

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">SALES</div>
          <div className="stamp-sub">STONEOS · VEDAM GRANITES</div>
        </div>
        <AppNav />
      </div>

      <div className="ticket">
        <div className="ticket-notch left" /><div className="ticket-notch right" />
        <div className="ticket-header">
          <div className="ticket-icon moss"><ClipboardList size={16} /></div>
          <div>
            <div className="ticket-title">New Sales Order</div>
            <div className="ticket-subtitle">Structured line items — one row per variety/transaction</div>
          </div>
        </div>

        <div className="grid" style={{ marginBottom: 14 }}>
          <label className="field">
            <span className="field-label">Order Date</span>
            <input className="field-input" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Customer</span>
            <select className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Or Add New Customer</span>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="field-input" placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
              <button className="add-btn" style={{ width: "auto", padding: "7px 12px" }} onClick={addCustomer}>Add</button>
            </div>
          </label>
        </div>

        {lines.map((l) => (
          <div className="row-card" key={l.id}>
            {lines.length > 1 && (
              <button className="row-remove" onClick={() => setLines((s) => s.filter((r) => r.id !== l.id))}>
                <Trash2 size={14} />
              </button>
            )}
            <div className="row-grid">
              <label className="field"><span className="field-label">Finished Slab</span>
                <select className="field-input" value={l.slabId} onChange={(e) => {
                  const slab = slabs.find((s) => s.id === e.target.value);
                  updateLine(l.id, "slabId", e.target.value);
                  updateLine(l.id, "varietyName", slab?.varietyName ?? "");
                }}>
                  <option value="">Select...</option>
                  {slabs.map((s) => <option key={s.id} value={s.id}>{s.slabSerial} · {s.varietyName}</option>)}
                </select>
              </label>
              <label className="field"><span className="field-label">Qty (sqft)</span>
                <input className="field-input" value={l.quantity} onChange={(e) => updateLine(l.id, "quantity", e.target.value)} placeholder="0" />
              </label>
              <label className="field"><span className="field-label">Unit Price</span>
                <input className="field-input" value={l.unitPrice} onChange={(e) => updateLine(l.id, "unitPrice", e.target.value)} placeholder="0" />
              </label>
              <label className="field"><span className="field-label">GST</span>
                <input className="field-input" value={l.gstAmount} onChange={(e) => updateLine(l.id, "gstAmount", e.target.value)} placeholder="0" />
              </label>
              <label className="field"><span className="field-label">Loading</span>
                <input className="field-input" value={l.loadingCharge} onChange={(e) => updateLine(l.id, "loadingCharge", e.target.value)} placeholder="0" />
              </label>
              <label className="field"><span className="field-label">Transport</span>
                <input className="field-input" value={l.transportCharge} onChange={(e) => updateLine(l.id, "transportCharge", e.target.value)} placeholder="0" />
              </label>
              <label className="field"><span className="field-label">Payment</span>
                <select className="field-input" value={l.paymentType} onChange={(e) => updateLine(l.id, "paymentType", e.target.value)}>
                  <option value="invoiced">Invoiced</option>
                  <option value="cash">Cash</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              {l.paymentType !== "invoiced" && (
                <>
                  <label className="field"><span className="field-label">Invoiced Amt</span>
                    <input className="field-input" value={l.invoicedAmount} onChange={(e) => updateLine(l.id, "invoicedAmount", e.target.value)} placeholder="0" />
                  </label>
                  <label className="field"><span className="field-label">Actual Received</span>
                    <input className="field-input" value={l.actualAmountReceived} onChange={(e) => updateLine(l.id, "actualAmountReceived", e.target.value)} placeholder="0" />
                  </label>
                </>
              )}
              <label className="field"><span className="field-label">Row Total</span>
                <div className="field-input mono" style={{ background: "#F3F1EA", fontWeight: 600 }}>₹{fmt(lineTotal(l))}</div>
              </label>
            </div>
          </div>
        ))}

        <button className="add-btn" onClick={() => setLines((s) => [...s, newLine()])}>
          <Plus size={14} /> Add line item
        </button>

        <div className="totals-strip">
          <span className="label">Order Total</span>
          <span className="value">₹{fmt(orderTotal)}</span>
        </div>

        {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 8 }}>{errorMsg}</div>}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button className={`primary-btn ${status === "saved" ? "saved" : ""}`} onClick={submitOrder} disabled={status === "saving"}>
            {status === "saved" ? <Check size={15} /> : <Save size={15} />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save Order"}
          </button>
        </div>
      </div>

      <div className="ticket">
        <div className="ticket-notch left" /><div className="ticket-notch right" />
        <div className="ticket-header">
          <div className="ticket-icon brass"><ClipboardList size={16} /></div>
          <div><div className="ticket-title">Recent Orders</div></div>
        </div>
        <table className="list-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Status</th><th>Lines</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => {
              const total = (o.lineItems ?? []).reduce((s: number, li: any) =>
                s + Number(li.quantity) * Number(li.unitPrice) + Number(li.gstAmount ?? 0) + Number(li.loadingCharge ?? 0) + Number(li.transportCharge ?? 0), 0);
              return (
                <tr key={o.id}>
                  <td>{new Date(o.orderDate).toLocaleDateString("en-IN")}</td>
                  <td style={{ fontFamily: "Space Grotesk" }}>{o.customer?.name}</td>
                  <td>{o.status}</td>
                  <td>{o.lineItems?.length ?? 0}</td>
                  <td>₹{fmt(total)}</td>
                  <td>
                    <div className="inline-controls">
                      {["CONFIRMED", "PARTIALLY_DELIVERED"].includes(o.status) && <button className="mini-btn" onClick={() => deliverOrder(o)}>Deliver</button>}
                      {o.status === "CONFIRMED" && <button className="mini-btn" onClick={() => cancelOrder(o)}><Ban size={13} /> Cancel</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="module-grid">
        <Ticket icon={Receipt} title="Create Invoice" subtitle="Commercial invoice after sales reservation/delivery">
          <div className="wide-grid">
            <label className="field"><span className="field-label">Sales Order</span><select className="field-input" value={invoiceForm.salesOrderId} onChange={(e) => setInvoiceForm((f) => ({ ...f, salesOrderId: e.target.value }))}><option value="">Select...</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.customer?.name} - {new Date(o.orderDate).toLocaleDateString("en-IN")} - {o.status}</option>)}</select></label>
            <label className="field"><span className="field-label">Invoice No.</span><input className="field-input" value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))} /></label>
            <label className="field"><span className="field-label">Invoice Date</span><input className="field-input" type="date" value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))} /></label>
            <label className="field"><span className="field-label">Amount</span><input className="field-input" value={invoiceForm.invoicedAmount} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoicedAmount: e.target.value }))} /></label>
            <label className="field"><span className="field-label">GST</span><input className="field-input" value={invoiceForm.gstAmount} onChange={(e) => setInvoiceForm((f) => ({ ...f, gstAmount: e.target.value }))} /></label>
          </div>
          <div className="action-row"><button className="primary-btn" onClick={createInvoice}><Receipt size={14} /> Create Invoice</button></div>
        </Ticket>

        <Ticket icon={IndianRupee} title="Record Payment" subtitle="Use invoice ID from newly-created invoice or pasted reference" accent="moss">
          <div className="wide-grid">
            <label className="field"><span className="field-label">Invoice ID</span><input className="field-input" value={paymentForm.invoiceId} onChange={(e) => setPaymentForm((f) => ({ ...f, invoiceId: e.target.value }))} /></label>
            <label className="field"><span className="field-label">Payment Date</span><input className="field-input" type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))} /></label>
            <label className="field"><span className="field-label">Amount</span><input className="field-input" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} /></label>
            <label className="field"><span className="field-label">Mode</span><select className="field-input" value={paymentForm.paymentMode} onChange={(e) => setPaymentForm((f) => ({ ...f, paymentMode: e.target.value }))}><option value="bank">Bank</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option></select></label>
          </div>
          <div className="action-row"><button className="primary-btn" onClick={createPayment}><IndianRupee size={14} /> Record Payment</button></div>
        </Ticket>
      </div>

      <Ticket icon={BarChart3} title="Daily Sales Summary" subtitle="Derived from live sales orders">
        <div className="inline-controls">
          <label className="field"><span className="field-label">From</span><input className="field-input" type="date" value={summaryRange.from} onChange={(e) => setSummaryRange((r) => ({ ...r, from: e.target.value }))} /></label>
          <label className="field"><span className="field-label">To</span><input className="field-input" type="date" value={summaryRange.to} onChange={(e) => setSummaryRange((r) => ({ ...r, to: e.target.value }))} /></label>
          <button className="mini-btn" onClick={loadSummaries}>Load</button>
        </div>
        <table className="list-table">
          <thead><tr><th>Date</th><th>Qty</th><th>Invoiced</th><th>Received</th></tr></thead>
          <tbody>{summaries.map((s) => <tr key={s.id ?? s.summaryDate}><td>{new Date(s.summaryDate).toLocaleDateString("en-IN")}</td><td>{s.totalQtySqft}</td><td>Rs {fmt(Number(s.invoicedAmount))}</td><td>Rs {fmt(Number(s.actualAmountReceived))}</td></tr>)}</tbody>
        </table>
      </Ticket>
    </div>
  );
}
