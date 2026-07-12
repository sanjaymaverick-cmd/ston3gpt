const LABELS: Record<string, string> = {
  RAW: "Ready for cutting",
  UNDER_CUTTING: "At cutting",
  CONSUMED: "Processed",
  CUT_UNPOLISHED: "Awaiting polish",
  UNDER_POLISHING: "At polishing",
  POLISHED: "Sale ready",
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  DELIVERED: "Dispatched",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ABORTED: "Stopped",
  CONFIRMED: "Reserved",
  PARTIALLY_DELIVERED: "Partially dispatched",
  CANCELLED: "Cancelled",
  RAW_YARD: "Raw yard",
  B21_QUEUE: "Queued for B-21",
  B21_WIP: "At B-21",
  UNPOLISHED_STOCK: "Awaiting polish",
  LPM_QUEUE: "Queued for polishing",
  LPM_WIP: "At polishing",
  FINISHED_STOCK: "Finished stock",
};

export const workflowLabel = (value?: string | null) => value ? LABELS[value] ?? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "—";
export const locationLabel = (location?: { name?: string | null; code?: string | null } | null) => location?.name || workflowLabel(location?.code);
