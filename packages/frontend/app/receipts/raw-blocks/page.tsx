"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { PackagePlus, Plus, Send } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { AppNav } from "../../../components/AppNav";
import { Ticket } from "../../../components/Ticket";

export default function RawBlockReceiptsPage() {
  const { getToken } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [line, setLine] = useState({ serialNumber: "", varietyName: "", weightTons: "", locationId: "", ownershipType: "COMPANY_OWNED" });
  const [lines, setLines] = useState<any[]>([]);
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");

  useEffect(() => {
    getToken().then((token) => token && apiFetch("/inventory/locations", token).then((locs) => {
      setLocations(locs);
      const rawYard = locs.find((l: any) => l.code === "RAW_YARD");
      setLine((l) => ({ ...l, locationId: rawYard?.id ?? "" }));
    }));
  }, []);

  const submit = async () => {
    const token = await getToken();
    if (!token || lines.length === 0) return;
    setStatus("saving");
    const receipt = await apiFetch("/goods-receipts", token, {
      method: "POST",
      body: JSON.stringify({ receiptDate, lines: lines.map((l) => ({ ...l, weightTons: l.weightTons ? Number(l.weightTons) : undefined })) }),
    });
    await apiFetch(`/goods-receipts/${receipt.id}/submit`, token, { method: "POST" });
    setLines([]);
    setStatus("submitted");
  };

  return (
    <div className="app-shell">
      <div className="stamp"><div><div className="stamp-title">RAW BLOCK RECEIPTS</div><div className="stamp-sub">PHYSICAL GOODS RECEIPT · INVOICE CAN FOLLOW LATER</div></div><AppNav /></div>
      <Ticket icon={PackagePlus} title="New Receipt">
        <div className="grid">
          <label className="field"><span className="field-label">Receipt Date</span><input className="field-input" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /></label>
          {["serialNumber", "varietyName", "weightTons"].map((f) => (
            <label className="field" key={f}><span className="field-label">{f}</span><input className="field-input" value={(line as any)[f]} onChange={(e) => setLine({ ...line, [f]: e.target.value })} /></label>
          ))}
          <label className="field"><span className="field-label">Location</span><select className="field-input" value={line.locationId} onChange={(e) => setLine({ ...line, locationId: e.target.value })}>{locations.filter((l) => l.code === "RAW_YARD").map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}</select></label>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="mini-btn" onClick={() => { setLines([...lines, line]); setLine({ ...line, serialNumber: "", varietyName: "", weightTons: "" }); }}><Plus size={14} /> Add Line</button>
          <button className="primary-btn" onClick={submit}><Send size={14} /> Submit Receipt</button>
        </div>
      </Ticket>
      <Ticket icon={PackagePlus} title={`Receipt Lines (${lines.length})`}>
        {lines.map((l, i) => <div className="row-card" key={`${l.serialNumber}-${i}`}><span className="mono">{l.serialNumber}</span> · {l.varietyName} · {l.weightTons || "?"}t</div>)}
      </Ticket>
      {status && <p className="mono">{status}</p>}
    </div>
  );
}
