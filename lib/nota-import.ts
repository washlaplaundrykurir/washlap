import * as XLSX from "xlsx";

import { normalizePhone } from "./phone";

export interface ImportedNotaRecord {
  nomor_nota: string;
  nomor_hp: string;
  nama_pelanggan: string | null;
  tanggal_terima: string;
  tanggal_selesai: string | null;
}

export interface ImportedNotaParseResult {
  records: ImportedNotaRecord[];
  totalRows: number;
  errors: string[];
}

export interface NotaImportInfo {
  matched: boolean;
  match_reason: "nota_phone_match" | "phone_mismatch" | "phone_missing" | "nota_not_found";
  nomor_nota?: string;
  nomor_hp?: string;
  nama_pelanggan?: string | null;
  tanggal_terima?: string;
  tanggal_selesai?: string | null;
}

const MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
};

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";

  return String(value).trim();
}

function normalizeHeader(value: unknown): string {
  return asText(value).toLowerCase().replace(/\s+/g, " ");
}

function requiredIndex(
  headers: unknown[],
  label: string,
  aliases: string[] = [],
): number {
  const accepted = [label, ...aliases].map((item) => item.toLowerCase());
  const index = headers.findIndex((header) =>
    accepted.includes(normalizeHeader(header)),
  );

  if (index === -1) {
    throw new Error(`Kolom "${label}" tidak ditemukan di file Excel.`);
  }

  return index;
}

export function parseIndonesianNotaDate(value: unknown): string | null {
  const text = asText(value);

  if (!text || text === "-") return null;

  const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(
    text,
  );

  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number(match[3]);
  const hour = Number(match[4] || "0");
  const minute = Number(match[5] || "0");

  if (!month || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const pad = (num: number) => String(num).padStart(2, "0");
  const date = new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+07:00`,
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseImportedNotaWorkbook(
  input: ArrayBuffer | Uint8Array | Buffer,
): ImportedNotaParseResult {
  const workbook = XLSX.read(input, { type: "array", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("File Excel tidak memiliki sheet.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell) === "no nota"),
  );

  if (headerRowIndex === -1) {
    throw new Error('Header "No Nota" tidak ditemukan di file Excel.');
  }

  const headers = rows[headerRowIndex];
  const notaIndex = requiredIndex(headers, "No Nota");
  const nameIndex = requiredIndex(headers, "Customer");
  const phoneIndex = requiredIndex(headers, "No Telp Customer");
  const receivedIndex = requiredIndex(headers, "Tgl Terima");
  const finishedIndex = requiredIndex(headers, "Tgl Selesai");
  const recordsByNota = new Map<string, ImportedNotaRecord>();
  const errors: string[] = [];
  let totalRows = 0;

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const nomorNota = asText(row[notaIndex]);

    if (!nomorNota) continue;

    totalRows += 1;

    if (recordsByNota.has(nomorNota)) continue;

    const tanggalTerima = parseIndonesianNotaDate(row[receivedIndex]);

    if (!tanggalTerima) {
      errors.push(`Baris ${rowIndex + 1}: Tgl Terima tidak valid.`);
      continue;
    }

    const normalizedPhone = normalizePhone(asText(row[phoneIndex]));

    if (!normalizedPhone) {
      errors.push(`Baris ${rowIndex + 1}: No Telp Customer tidak valid.`);
      continue;
    }

    recordsByNota.set(nomorNota, {
      nomor_nota: nomorNota,
      nomor_hp: normalizedPhone,
      nama_pelanggan: asText(row[nameIndex]) || null,
      tanggal_terima: tanggalTerima,
      tanggal_selesai: parseIndonesianNotaDate(row[finishedIndex]),
    });
  }

  return {
    records: Array.from(recordsByNota.values()),
    totalRows,
    errors,
  };
}

function getOrderPhone(row: unknown): string {
  const value = row as {
    customers?:
      | { nomor_hp?: string | null }
      | Array<{ nomor_hp?: string | null }>
      | null;
  };
  const customers = value.customers;

  if (Array.isArray(customers)) {
    return normalizePhone(customers[0]?.nomor_hp);
  }

  return normalizePhone(customers?.nomor_hp);
}

export function enrichWithNotaImports<T extends { nomor_nota?: string | null }>(
  rows: T[],
  imports: ImportedNotaRecord[],
): Array<T & { nota_import: NotaImportInfo }> {
  const importByNota = new Map(
    imports.map((record) => [record.nomor_nota.trim().toLowerCase(), record]),
  );

  return rows.map((row) => {
    const key = row.nomor_nota?.trim().toLowerCase();
    const record = key ? importByNota.get(key) : undefined;
    const orderPhone = getOrderPhone(row);
    const importedPhone = normalizePhone(record?.nomor_hp);
    const matched = Boolean(record && orderPhone && orderPhone === importedPhone);
    const matchReason = record
      ? orderPhone
        ? matched
          ? "nota_phone_match"
          : "phone_mismatch"
        : "phone_missing"
      : "nota_not_found";

    return {
      ...row,
      nota_import: record
        ? {
            matched,
            match_reason: matchReason,
            nomor_nota: record.nomor_nota,
            nomor_hp: record.nomor_hp,
            nama_pelanggan: record.nama_pelanggan,
            tanggal_terima: record.tanggal_terima,
            tanggal_selesai: record.tanggal_selesai,
          }
        : { matched: false, match_reason: matchReason },
    };
  });
}
