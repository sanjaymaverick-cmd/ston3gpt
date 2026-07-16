import { TallyParserService } from "./tally-import.service";

describe("TallyParserService inventory detail", () => {
  it("extracts stock-item square feet and amount from item vouchers", () => {
    const xml = `<ENVELOPE><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER VCHTYPE="Sales"><DATE>20260716</DATE><ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>POLISHED GRANITE SLABS</STOCKITEMNAME><ACTUALQTY>2,260 SQF</ACTUALQTY><AMOUNT>-452000.00</AMOUNT></ALLINVENTORYENTRIES.LIST></VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    const parser = new TallyParserService();

    expect(parser.parseInventoryEntries(Buffer.from(`\ufeff${xml}`, "utf16le"))).toEqual([{
      voucherType: "Sales",
      entryDate: new Date("2026-07-16"),
      stockItemName: "POLISHED GRANITE SLABS",
      quantity: 2260,
      unit: "SQF",
      amount: 452000,
    }]);
  });
});
