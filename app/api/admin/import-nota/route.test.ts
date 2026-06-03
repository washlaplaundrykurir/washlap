import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const h = vi.hoisted(() => {
  const controller: {
    existingNotas: string[];
    upsertError: any;
    upsertPayload: any[];
    reset: () => void;
  } = {
    existingNotas: [],
    upsertError: null,
    upsertPayload: [],
    reset() {
      this.existingNotas = [];
      this.upsertError = null;
      this.upsertPayload = [];
    },
  };

  class Builder {
    _table: string;
    _methods = new Set<string>();
    _payload: any[] = [];

    constructor(table: string) {
      this._table = table;
    }

    select() {
      this._methods.add("select");
      return this;
    }

    in() {
      this._methods.add("in");
      return this;
    }

    upsert(payload: any[]) {
      this._methods.add("upsert");
      this._payload = payload;
      controller.upsertPayload = payload;
      return this;
    }

    then(onFulfilled?: any, onRejected?: any) {
      return Promise.resolve(this._resolve()).then(onFulfilled, onRejected);
    }

    _resolve() {
      if (this._table !== "imported_nota_transactions") {
        return { data: null, error: null };
      }

      if (this._methods.has("upsert")) {
        return { data: this._payload, error: controller.upsertError };
      }

      return {
        data: controller.existingNotas.map((nomor_nota) => ({ nomor_nota })),
        error: null,
      };
    }
  }

  return {
    controller,
    makeAdminClient: () => ({
      from: (table: string) => new Builder(table),
    }),
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createSupabaseAdmin: () => h.makeAdminClient(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    user: { id: "admin-1", role: "admin", email: "admin@test.local" },
    error: null,
  })),
}));

import { POST } from "./route";

function makeWorkbookFile(): File {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Rekap Data Transaksi Reguler (0)"],
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

  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Transaksi Reguler");

  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  return new File([bytes], "rekap.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function makeRequest(file: File | null) {
  const formData = new FormData();

  if (file) formData.set("file", file);

  return { formData: async () => formData } as any;
}

beforeEach(() => {
  h.controller.reset();
  vi.clearAllMocks();
});

describe("POST /api/admin/import-nota", () => {
  it("imports unique nota records and reports inserted/updated counts", async () => {
    h.controller.existingNotas = ["SXA260525205126934"];

    const response = await POST(makeRequest(makeWorkbookFile()));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      totalRows: 3,
      uniqueNotas: 2,
      inserted: 1,
      updated: 1,
      skipped: 0,
    });
    expect(h.controller.upsertPayload).toHaveLength(2);
    expect(h.controller.upsertPayload[0]).toMatchObject({
      nomor_nota: "SXA260525205126934",
      nomor_hp: "6281320041683",
      imported_by: "admin-1",
    });
  });

  it("rejects requests without an Excel file", async () => {
    const response = await POST(makeRequest(null));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/file/i);
  });
});
