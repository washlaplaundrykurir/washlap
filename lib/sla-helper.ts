// Offset WIB = UTC+7 dalam milidetik
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Menghitung durasi aktif dalam menit antara dua waktu,
 * berdasarkan jam operasional dalam zona waktu WIB (UTC+7).
 *
 * Semua timestamp di database disimpan dalam UTC (+00).
 * Jam operasional (opStartHour, opEndHour) adalah jam WIB,
 * sehingga perlu dikonversi ke UTC sebelum dibandingkan.
 *
 * Aturan Operasional:
 * - Jam Operasional: opStartHour s/d opEndHour dalam WIB (misal: 10:00 s/d 21:00 WIB)
 * - Di luar jam tersebut, waktu tidak dihitung.
 */
export function calculateActiveMinutes(
  start: Date | string | null,
  end: Date | string | null,
  opStartHour: number,
  opEndHour: number,
): number {
  if (!start || !end) return 0;

  const startObj = new Date(start);
  const endObj = new Date(end);
  const startMS = startObj.getTime();
  const endMS = endObj.getTime();

  // Jika waktu mulai di masa depan dibandingkan waktu selesai, durasi = 0
  if (endMS <= startMS) return 0;

  let totalActiveMinutes = 0;

  // Iterasi per hari kalender dalam WIB.
  // Kita shift timestamp ke "WIB-local" dengan menambah offset,
  // lalu ambil tanggal UTC-nya — yang sebenarnya adalah tanggal WIB.
  const startWIB = new Date(startMS + WIB_OFFSET_MS);
  const endWIB = new Date(endMS + WIB_OFFSET_MS);

  const currentDay = new Date(
    Date.UTC(
      startWIB.getUTCFullYear(),
      startWIB.getUTCMonth(),
      startWIB.getUTCDate(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(
      endWIB.getUTCFullYear(),
      endWIB.getUTCMonth(),
      endWIB.getUTCDate(),
    ),
  );

  while (currentDay <= lastDay) {
    const y = currentDay.getUTCFullYear();
    const m = currentDay.getUTCMonth();
    const d = currentDay.getUTCDate();

    // Jendela operasional hari ini dalam UTC:
    // jam WIB dikonversi ke UTC dengan mengurangi offset 7 jam
    const opStartUTC = Date.UTC(y, m, d, opStartHour, 0, 0, 0) - WIB_OFFSET_MS;
    const opEndUTC = Date.UTC(y, m, d, opEndHour, 0, 0, 0) - WIB_OFFSET_MS;

    // Cari irisan antara [startMS, endMS] dengan [opStartUTC, opEndUTC]
    const effectiveStart = Math.max(startMS, opStartUTC);
    const effectiveEnd = Math.min(endMS, opEndUTC);

    if (effectiveStart < effectiveEnd) {
      totalActiveMinutes += (effectiveEnd - effectiveStart) / (1000 * 60);
    }

    // Pindah ke hari berikutnya (dalam kalender WIB)
    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
  }

  return Math.max(0, Math.round(totalActiveMinutes));
}

export interface SLAResult {
  minutes: number;
  status: "MEET" | "FAILED";
}

/**
 * SLA Tiket Selesai
 * Start: waktu_penjemputan
 * End: waktu_kurir_selesai
 * Operasional: 10:00 - 21:00
 */
export function calculateSLATiket(
  penjemputan: string | null,
  kurirSelesai: string | null,
): SLAResult | null {
  if (!penjemputan || !kurirSelesai) return null;

  const minutes = calculateActiveMinutes(penjemputan, kurirSelesai, 10, 21);
  return {
    minutes,
    status: minutes <= 120 ? "MEET" : "FAILED",
  };
}

/**
 * SLA Kurir Selesai
 * Start: max(waktu_assigned, waktu_penjemputan)
 * End: waktu_kurir_selesai
 * Operasional: 10:00 - 21:00
 */
export function calculateSLAKurir(
  assigned: string | null,
  penjemputan: string | null,
  kurirSelesai: string | null,
): SLAResult | null {
  if (!kurirSelesai) return null;

  let startTimeMS: number | null = null;

  if (assigned && penjemputan) {
    startTimeMS = Math.max(
      new Date(assigned).getTime(),
      new Date(penjemputan).getTime(),
    );
  } else if (assigned) {
    startTimeMS = new Date(assigned).getTime();
  } else if (penjemputan) {
    startTimeMS = new Date(penjemputan).getTime();
  }

  if (startTimeMS === null) return null;

  const minutes = calculateActiveMinutes(
    new Date(startTimeMS),
    kurirSelesai,
    10,
    21,
  );
  return {
    minutes,
    status: minutes <= 120 ? "MEET" : "FAILED",
  };
}

/**
 * SLA Nota
 * Start: waktu_kurir_selesai
 * End: waktu_selesai
 * Operasional: 11:00 - 21:00
 */
export function calculateSLANota(
  kurirSelesai: string | null,
  selesai: string | null,
): SLAResult | null {
  if (!kurirSelesai || !selesai) return null;

  const minutes = calculateActiveMinutes(kurirSelesai, selesai, 11, 21);
  return {
    minutes,
    status: minutes <= 120 ? "MEET" : "FAILED",
  };
}
