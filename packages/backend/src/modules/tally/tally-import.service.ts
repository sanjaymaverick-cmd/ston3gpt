import { Injectable, BadRequestException } from "@nestjs/common";
import { XMLParser } from "fast-xml-parser";
import { PrismaService } from "../../common/prisma.service";

// Tally exports are commonly UTF-16 (with or without BOM), unlike almost
// everything else in this codebase. This is the ONE place that matters —
// get it wrong and every string in the file is garbage double-byte noise.
function decodeTallyXml(buffer: Buffer): string {
  let text = buffer.toString("utf16le");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  if (text.includes("\u0000")) text = buffer.toString("utf8"); // fallback if actually UTF-8
  return text;
}

function parseTallyDate(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`);
}

interface ParsedLedgerLine {
  voucherType: string;
  entryDate: Date;
  account: string;
  debit: number;
  credit: number;
  narration: string;
}

interface ParsedTrialBalanceRow {
  account: string;
  debit: number;
  credit: number;
}

interface ParsedInventoryLine {
  voucherType: string;
  entryDate: Date;
  stockItemName: string;
  quantity: number | null;
  unit: string | null;
  amount: number | null;
}

@Injectable()
export class TallyParserService {
  // DAY BOOK — Tally's native "All Masters" voucher export. Each
  // TALLYMESSAGE wraps one VOUCHER. Ledger entries are split across THREE
  // possible structures depending on voucher mode — verified against all
  // 788 real vouchers in this factory's export, confirming every voucher
  // balances to zero once all three are combined:
  //   1. ALLLEDGERENTRIES.LIST — account-invoice-mode vouchers (Payment,
  //      Receipt, Contra, Journal)
  //   2. LEDGERENTRIES.LIST (no "ALL" prefix) — the party/tax side of
  //      item-invoice-mode vouchers (Sales, Purchase)
  //   3. ACCOUNTINGALLOCATIONS.LIST nested inside ALLINVENTORYENTRIES.LIST
  //      — the sales/purchase ledger side of item-invoice-mode vouchers.
  //      This is easy to miss entirely (regex only on LEDGERENTRIES.LIST
  //      silently drops half the double-entry for every Sales/Purchase
  //      voucher) — do not remove this without re-checking the balance
  //      invariant against a real export first (run
  //      prisma/validate-tally-parser.js).
  //
  // Deliberately NOT parsing item/stock-item level detail (e.g. "POLISHED
  // GRANITE SLABS, 2260 SQF") beyond what's needed to reach the ledger
  // amount — that's richer than our current tally_ledger_entry schema
  // models. Worth a future enhancement (e.g. cross-checking sqft sold
  // against StoneOS's own sales_line_item), but out of scope here.
  parseDaybook(buffer: Buffer): ParsedLedgerLine[] {
    const xml = decodeTallyXml(buffer);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const doc = parser.parse(xml);

    const rawMessages = doc?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE;
    if (!rawMessages) {
      throw new BadRequestException("No TALLYMESSAGE/VOUCHER data found — is this really a Day Book export?");
    }
    const messages = Array.isArray(rawMessages) ? rawMessages : [rawMessages];

    const lines: ParsedLedgerLine[] = [];
    for (const msg of messages) {
      const voucher = msg?.VOUCHER;
      if (!voucher) continue;

      const voucherType = voucher["@_VCHTYPE"] ?? voucher.VOUCHERTYPENAME ?? "Unknown";
      const dateStr = voucher.DATE;
      if (!dateStr) continue;
      const entryDate = parseTallyDate(String(dateStr));
      const narration = voucher.NARRATION ?? voucher.PARTYNAME ?? "";

      const asArray = (v: any) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

      // Structure 1: account-invoice-mode entries
      const directEntries = asArray(voucher["ALLLEDGERENTRIES.LIST"]);
      // Structure 2: item-invoice-mode party/tax entries
      const plainEntries = asArray(voucher["LEDGERENTRIES.LIST"]);
      // Structure 3: item-invoice-mode sales/purchase ledger, nested under each inventory entry
      const inventoryEntries = asArray(voucher["ALLINVENTORYENTRIES.LIST"]);
      const nestedAllocEntries = inventoryEntries.flatMap((inv: any) => asArray(inv?.["ACCOUNTINGALLOCATIONS.LIST"]));

      const allEntries = [...directEntries, ...plainEntries, ...nestedAllocEntries];

      for (const le of allEntries) {
        const account = le?.LEDGERNAME;
        const amountRaw = le?.AMOUNT;
        if (!account || amountRaw === undefined || String(amountRaw).trim() === "") continue;
        const amount = parseFloat(String(amountRaw));
        lines.push({
          voucherType: String(voucherType),
          entryDate,
          account: String(account),
          debit: amount < 0 ? Math.abs(amount) : 0,
          credit: amount > 0 ? amount : 0,
          narration: String(narration),
        });
      }
    }

    if (lines.length === 0) {
      throw new BadRequestException("Parsed the file but found zero ledger entries — check it's an unmodified Tally export");
    }
    return lines;
  }

  parseInventoryEntries(buffer: Buffer): ParsedInventoryLine[] {
    const xml = decodeTallyXml(buffer);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const doc = parser.parse(xml);
    const rawMessages = doc?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE;
    if (!rawMessages) throw new BadRequestException("No TALLYMESSAGE/VOUCHER data found — is this really a Day Book export?");
    const asArray = (value: any) => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
    const entries: ParsedInventoryLine[] = [];
    for (const message of asArray(rawMessages)) {
      const voucher = message?.VOUCHER;
      if (!voucher?.DATE) continue;
      for (const item of asArray(voucher["ALLINVENTORYENTRIES.LIST"])) {
        const stockItemName = item?.STOCKITEMNAME;
        if (!stockItemName) continue;
        const quantityText = String(item.ACTUALQTY ?? item.BILLEDQTY ?? "").replace(/,/g, "").trim();
        const quantityMatch = quantityText.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
        const amountText = String(item.AMOUNT ?? "").replace(/,/g, "").trim();
        const amount = amountText ? Math.abs(Number.parseFloat(amountText)) : null;
        entries.push({
          voucherType: String(voucher["@_VCHTYPE"] ?? voucher.VOUCHERTYPENAME ?? "Unknown"),
          entryDate: parseTallyDate(String(voucher.DATE)),
          stockItemName: String(stockItemName),
          quantity: quantityMatch ? Math.abs(Number.parseFloat(quantityMatch[1])) : null,
          unit: quantityMatch?.[2]?.trim() || null,
          amount: amount !== null && Number.isFinite(amount) ? amount : null,
        });
      }
    }
    return entries;
  }

  // TRIAL BALANCE — this export's shape is a flat, strictly alternating
  // sequence of <DSPACCNAME><DSPDISPNAME>name</DSPDISPNAME></DSPACCNAME>
  // followed by one <DSPACCINFO>...</DSPACCINFO> block per account. That
  // alternation is awkward for a standard object-mode XML parser (it groups
  // repeated sibling tags into arrays and loses the pairing), so this uses
  // a direct regex walk instead — simpler and more reliable for this
  // specific, well-known Tally report shape than fighting parser modes.
  parseTrialBalance(buffer: Buffer): ParsedTrialBalanceRow[] {
    const xml = decodeTallyXml(buffer);
    const pattern =
      /<DSPDISPNAME>([^<]*)<\/DSPDISPNAME>[\s\S]*?<DSPDRAMTA>([^<]*)<\/DSPDRAMTA>[\s\S]*?<DSPCRAMTA>([^<]*)<\/DSPCRAMTA>/g;

    const rows: ParsedTrialBalanceRow[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) {
      const account = match[1].trim();
      const debitRaw = match[2].trim();
      const creditRaw = match[3].trim();
      if (!account) continue;
      rows.push({
        account,
        debit: debitRaw ? Math.abs(parseFloat(debitRaw)) : 0,
        credit: creditRaw ? Math.abs(parseFloat(creditRaw)) : 0,
      });
    }

    if (rows.length === 0) {
      throw new BadRequestException("Parsed the file but found zero accounts — check it's an unmodified Trial Balance export");
    }
    return rows;
  }
}

@Injectable()
export class TallyImportService {
  constructor(private prisma: PrismaService, private parser: TallyParserService) {}

  findBatches(factoryId: string) {
    return this.prisma.tallyImportBatch.findMany({
      where: { factoryId },
      include: { _count: { select: { ledgerEntries: true, trialBalanceRows: true, inventoryEntries: true } } },
      orderBy: { importDate: "desc" },
    });
  }

  async importDaybook(factoryId: string, fileBuffer: Buffer, sourceFile: string) {
    const lines = this.parser.parseDaybook(fileBuffer);
    const inventoryEntries = this.parser.parseInventoryEntries(fileBuffer);
    const dates = lines.map((l) => l.entryDate.getTime());

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.tallyImportBatch.create({
        data: {
          factoryId,
          sourceFile,
          periodStart: new Date(Math.min(...dates)),
          periodEnd: new Date(Math.max(...dates)),
        },
      });
      await tx.tallyLedgerEntry.createMany({
        data: lines.map((l) => ({
          tallyImportBatchId: batch.id,
          voucherType: l.voucherType,
          entryDate: l.entryDate,
          account: l.account,
          debit: l.debit,
          credit: l.credit,
          narration: l.narration,
        })),
      });
      if (inventoryEntries.length) {
        await tx.tallyInventoryEntry.createMany({
          data: inventoryEntries.map((entry) => ({ tallyImportBatchId: batch.id, ...entry })),
        });
      }
      return { batch, entriesImported: lines.length, inventoryEntriesImported: inventoryEntries.length };
    });
  }

  async importTrialBalance(factoryId: string, fileBuffer: Buffer, sourceFile: string) {
    const rows = this.parser.parseTrialBalance(fileBuffer);

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.tallyImportBatch.create({ data: { factoryId, sourceFile } });
      await tx.tallyTrialBalanceSnapshot.createMany({
        data: rows.map((r) => ({
          tallyImportBatchId: batch.id,
          account: r.account,
          debit: r.debit,
          credit: r.credit,
        })),
      });
      return { batch, accountsImported: rows.length };
    });
  }
}
