"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, FileUp, ReceiptText, Upload } from "lucide-react";
import { apiFetch, apiUpload } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { Ticket } from "../../components/Ticket";

type ImportKind = "daybook" | "trial-balance";

export default function TallyPage() {
  const { getToken } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [files, setFiles] = useState<Record<ImportKind, File | null>>({ daybook: null, "trial-balance": null });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    const token = await getToken();
    if (!token) return;
    setBatches(await apiFetch("/tally-import/batches", token));
  };

  useEffect(() => { load(); }, []);

  const upload = async (kind: ImportKind) => {
    const file = files[kind];
    if (!file) return;
    setStatus("saving"); setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      const form = new FormData();
      form.append("file", file);
      await apiUpload(`/tally-import/${kind}`, token, form);
      setFiles((current) => ({ ...current, [kind]: null }));
      await load();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1600);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Import failed");
      setStatus("error");
    }
  };

  const picker = (kind: ImportKind, title: string, subtitle: string) => (
    <div className="row-card" style={{ margin: 0 }}>
      <div className="section-bar">
        <div>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <div className="ticket-subtitle">{subtitle}</div>
        </div>
        <button className={`primary-btn ${status === "saved" ? "saved" : ""}`} disabled={!files[kind] || status === "saving"} onClick={() => upload(kind)}>
          {status === "saved" ? <Check size={14} /> : <Upload size={14} />} Import
        </button>
      </div>
      <input
        className="file-input"
        type="file"
        accept=".xml,.txt"
        onChange={(e) => setFiles((current) => ({ ...current, [kind]: e.target.files?.[0] ?? null }))}
      />
      {files[kind] && <div className="ticket-subtitle" style={{ marginTop: 8 }}>{files[kind]?.name}</div>}
    </div>
  );

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">TALLY IMPORT</div>
          <div className="stamp-sub">DAYBOOK - TRIAL BALANCE - LEDGER AUDIT</div>
        </div>
        <AppNav />
      </div>

      <Ticket icon={FileUp} title="Upload Tally XML" subtitle="Imports are stored as batches and parsed into ledger entries">
        <div className="module-grid">
          {picker("daybook", "Daybook XML", "Voucher-level sales, purchase, payment and receipt entries")}
          {picker("trial-balance", "Trial Balance XML", "Ledger balances for reconciliation and audit")}
        </div>
        {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</div>}
      </Ticket>

      <Ticket icon={ReceiptText} title={`Import Batches (${batches.length})`}>
        {batches.length === 0 ? <p className="empty-state">No Tally imports yet.</p> : (
          <table className="list-table">
            <thead><tr><th>Created</th><th>Type</th><th>File</th><th>Status</th><th>Entries</th></tr></thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{new Date(batch.createdAt).toLocaleString("en-IN")}</td>
                  <td>{batch.importType}</td>
                  <td style={{ fontFamily: "Space Grotesk" }}>{batch.fileName}</td>
                  <td>{batch.status}</td>
                  <td>{batch._count ? `${batch._count.ledgerEntries} ledger · ${batch._count.inventoryEntries} stock` : batch.entryCount ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Ticket>
    </div>
  );
}
