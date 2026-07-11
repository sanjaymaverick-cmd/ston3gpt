import { Boxes, Factory, Gauge, PackageCheck, Truck, type LucideIcon } from "lucide-react";

interface FlowCounts {
  raw: number;
  cutting: number;
  unpolished: number;
  polishing: number;
  finished: number;
  dispatch: number;
}

const flowSteps: Array<{ key: keyof FlowCounts; label: string; sub: string; icon: LucideIcon }> = [
  { key: "raw", label: "Raw", sub: "yard", icon: Boxes },
  { key: "cutting", label: "B-21", sub: "cutting", icon: Factory },
  { key: "unpolished", label: "Cut", sub: "stock", icon: PackageCheck },
  { key: "polishing", label: "LPM", sub: "polish", icon: Gauge },
  { key: "finished", label: "Finished", sub: "sale-ready", icon: PackageCheck },
  { key: "dispatch", label: "Dispatch", sub: "orders", icon: Truck },
];

export function FactoryFlowGraphic({ counts }: { counts: FlowCounts }) {
  return (
    <div className="flow-graphic" aria-label="Factory workflow visual">
      <div className="flow-track" />
      {flowSteps.map(({ key, label, sub, icon: Icon }, index) => {
        const value = counts[key];
        const level = value > 5 ? "high" : value > 0 ? "active" : "quiet";
        return (
          <div className={`flow-node ${level}`} key={key}>
            <div className="flow-index mono">{String(index + 1).padStart(2, "0")}</div>
            <div className="flow-icon"><Icon size={17} strokeWidth={2.25} /></div>
            <div>
              <div className="flow-label">{label}</div>
              <div className="flow-sub">{sub}</div>
            </div>
            <div className="flow-count mono">{value}</div>
          </div>
        );
      })}
    </div>
  );
}

export function StoneStackVisual({ finished, reserved, unpolished }: { finished: number; reserved: number; unpolished: number }) {
  const layers = [
    { label: "Finished", value: finished, className: "finished" },
    { label: "Reserved", value: reserved, className: "reserved" },
    { label: "Unpolished", value: unpolished, className: "unpolished" },
  ];
  return (
    <div className="stone-stack-panel">
      <div className="stone-stack">
        {layers.map((layer, index) => (
          <div className={`stone-layer ${layer.className}`} key={layer.label} style={{ ["--layer" as any]: index }}>
            <span>{layer.label}</span>
            <strong>{layer.value}</strong>
          </div>
        ))}
      </div>
      <div className="stone-legend">
        {layers.map((layer) => (
          <div key={layer.label}><span className={`legend-mark ${layer.className}`} />{layer.label}</div>
        ))}
      </div>
    </div>
  );
}

export function SpatialMiniMap({ counts }: { counts: FlowCounts }) {
  return (
    <div className="mini-map">
      <div className="mini-yard"><span>RAW</span><strong>{counts.raw}</strong></div>
      <div className="mini-machine cutting"><span>B-21</span><strong>{counts.cutting}</strong></div>
      <div className="mini-stock"><span>CUT</span><strong>{counts.unpolished}</strong></div>
      <div className="mini-machine polishing"><span>LPM</span><strong>{counts.polishing}</strong></div>
      <div className="mini-finished"><span>FIN</span><strong>{counts.finished}</strong></div>
      <div className="mini-dispatch"><span>DSP</span><strong>{counts.dispatch}</strong></div>
    </div>
  );
}
