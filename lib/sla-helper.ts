/**
 * Menghitung durasi aktif dalam menit antara dua waktu,
 * dengan menggunakan komponen waktu (clock time) dari objek Date secara langsung.
 *
 * Aturan Operasional:
 * - Jam Operasional: opStartHour s/d opEndHour (misal: 10:00 s/d 21:00)
 * - Di luar jam tersebut (malam s/d pagi), waktu tidak dihitung.
 *
 * Catatan: Fungsi ini menggunakan metode UTC untuk memastikan perhitungan konsisten
 * dengan nilai mentah yang disimpan di database, menghindari pergeseran zona waktu lokal.
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

  // Inisialisasi loop dari hari kalender mulai sampai selesai menggunakan UTC
  const currentDay = new Date(
    Date.UTC(
      startObj.getUTCFullYear(),
      startObj.getUTCMonth(),
      startObj.getUTCDate(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(
      endObj.getUTCFullYear(),
      endObj.getUTCMonth(),
      endObj.getUTCDate(),
    ),
  );

  while (currentDay <= lastDay) {
    const y = currentDay.getUTCFullYear();
    const m = currentDay.getUTCMonth();
    const d = currentDay.getUTCDate();

    /**
     * Tentukan jendela operasional hari ini.
     * Kita menggunakan Date.UTC agar selaras dengan timeline startMS dan endMS.
     */
    const opStartUTC = Date.UTC(y, m, d, opStartHour, 0, 0, 0);
    const opEndUTC = Date.UTC(y, m, d, opEndHour, 0, 0, 0);

    // Cari irisan antara [startMS, endMS] dengan [opStartUTC, opEndUTC]
    const effectiveStart = Math.max(startMS, opStartUTC);
    const effectiveEnd = Math.min(endMS, opEndUTC);

    if (effectiveStart < effectiveEnd) {
      totalActiveMinutes += (effectiveEnd - effectiveStart) / (1000 * 60);
    }

    // Pindah ke hari berikutnya
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
