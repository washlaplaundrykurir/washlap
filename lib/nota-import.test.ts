import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  enrichWithNotaImports,
  parseImportedNotaWorkbook,
  parseIndonesianNotaDate,
} from "./nota-import";

function makeWorkbookBuffer(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Transaksi Reguler");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

describe("parseIndonesianNotaDate", () => {
  it("parses Indonesian Excel dates as WIB instants", () => {
    expect(parseIndonesianNotaDate("25 Mei 2026 20:51")).toBe(
      "2026-05-25T13:51:00.000Z",
    );
  });

  it("returns null for blank placeholder dates", () => {
    expect(parseIndonesianNotaDate("-")).toBeNull();
    expect(parseIndonesianNotaDate("")).toBeNull();
  });
});

describe("parseImportedNotaWorkbook", () => {
  it("finds the header row, dedupes repeated nota detail rows, and normalizes phone numbers", () => {
    const buffer = makeWorkbookBuffer([
      ["Rekap Data Transaksi Reguler (0)"],
      [],
      ["Tanggal Export", null, null, null, "26 Mei 2026 15:56"],
      [],
      [
        "No",
        "No Nota",
        "Customer",
        "No Telp Customer",
        "Alamat Customer",
        "Progres Pengerjaan",
        "Outlet",
        "Tgl Terima",
        "Tgl Selesai",
      ],
      [
        "1",
        "SXA260525205126934",
        "Kiki / Rizkiani",
        "0813-2004-1683",
        "Apt Salemba",
        "11%",
        "Washlap Salemba",
        "25 Mei 2026 20:51",
        "29 Mei 2026 20:52",
      ],
      [
        null,
        "SXA260525205126934",
        "Kiki / Rizkiani",
        "0813-2004-1683",
        "Apt Salemba",
        "11%",
        "Washlap Salemba",
        "25 Mei 2026 20:51",
        "29 Mei 2026 20:52",
      ],
      [
        "2",
        "OPJ260525204647493",
        "Yuseva",
        "6285642667532",
        "Jl. Salemba",
        "50%",
        "Washlap Salemba",
        "25 Mei 2026 20:46",
        "26 Mei 2026 02:46",
      ],
    ]);

    const result = parseImportedNotaWorkbook(buffer);

    expect(result.totalRows).toBe(3);
    expect(result.records).toEqual([
      {
        nomor_nota: "SXA260525205126934",
        nomor_hp: "6281320041683",
        nama_pelanggan: "Kiki / Rizkiani",
        tanggal_terima: "2026-05-25T13:51:00.000Z",
        tanggal_selesai: "2026-05-29T13:52:00.000Z",
      },
      {
        nomor_nota: "OPJ260525204647493",
        nomor_hp: "6285642667532",
        nama_pelanggan: "Yuseva",
        tanggal_terima: "2026-05-25T13:46:00.000Z",
        tanggal_selesai: "2026-05-25T19:46:00.000Z",
      },
    ]);
    expect(result.errors).toEqual([]);
  });
});

describe("enrichWithNotaImports", () => {
  it("joins imported nota data by nomor_nota without mutating the original order", () => {
    const order = {
      id: "order-1",
      nomor_nota: "SXA260525205126934",
      waktu_selesai: "2026-06-01T01:00:00.000Z",
      customers: { nomor_hp: "0813-2004-1683" },
    };

    const enriched = enrichWithNotaImports(
      [order],
      [
        {
          nomor_nota: "SXA260525205126934",
          nomor_hp: "6281320041683",
          nama_pelanggan: "Kiki / Rizkiani",
          tanggal_terima: "2026-05-25T13:51:00.000Z",
          tanggal_selesai: "2026-05-29T13:52:00.000Z",
        },
      ],
    );

    expect(enriched[0]).toEqual({
      ...order,
      nota_import: {
        matched: true,
        match_reason: "nota_phone_match",
        nomor_nota: "SXA260525205126934",
        nomor_hp: "6281320041683",
        nama_pelanggan: "Kiki / Rizkiani",
        tanggal_terima: "2026-05-25T13:51:00.000Z",
        tanggal_selesai: "2026-05-29T13:52:00.000Z",
      },
    });
    expect(order).not.toHaveProperty("nota_import");
  });

  it("does not fully match when nota exists but customer phone is different", () => {
    const enriched = enrichWithNotaImports(
      [
        {
          id: "order-1",
          nomor_nota: "SXA260525205126934",
          customers: { nomor_hp: "628999888777" },
        },
      ],
      [
        {
          nomor_nota: "SXA260525205126934",
          nomor_hp: "6281320041683",
          nama_pelanggan: "Kiki / Rizkiani",
          tanggal_terima: "2026-05-25T13:51:00.000Z",
          tanggal_selesai: "2026-05-29T13:52:00.000Z",
        },
      ],
    );

    expect(enriched[0].nota_import).toEqual({
      matched: false,
      match_reason: "phone_mismatch",
      nomor_nota: "SXA260525205126934",
      nomor_hp: "6281320041683",
      nama_pelanggan: "Kiki / Rizkiani",
      tanggal_terima: "2026-05-25T13:51:00.000Z",
      tanggal_selesai: "2026-05-29T13:52:00.000Z",
    });
  });

  it("marks rows without imported matches as unmatched", () => {
    const enriched = enrichWithNotaImports([{ id: "order-2", nomor_nota: null }], []);

    expect(enriched[0].nota_import).toEqual({
      matched: false,
      match_reason: "nota_not_found",
    });
  });
});
