import { describe, expect, it } from "vitest";

import { buildCourierTaskSummary } from "./courier-task-summary";

describe("buildCourierTaskSummary", () => {
  it("counts pending antar and jemput tasks for every active courier", () => {
    const result = buildCourierTaskSummary(
      [
        { id: "nur", full_name: "Nur" },
        { id: "kev", full_name: "Kev" },
        { id: "ang", full_name: "Ang" },
      ],
      [
        { courier_id: "nur", jenis_tugas: "ANTAR" },
        { courier_id: "nur", jenis_tugas: "ANTAR" },
        { courier_id: "nur", jenis_tugas: "JEMPUT" },
        { courier_id: "nur", jenis_tugas: "JEMPUT" },
        { courier_id: "kev", jenis_tugas: "ANTAR" },
        { courier_id: "kev", jenis_tugas: "JEMPUT" },
        { courier_id: "kev", jenis_tugas: "JEMPUT" },
        { courier_id: "kev", jenis_tugas: "JEMPUT" },
        { courier_id: "ang", jenis_tugas: "ANTAR" },
        { courier_id: "ang", jenis_tugas: "ANTAR" },
        { courier_id: "ang", jenis_tugas: "JEMPUT" },
      ],
    );

    expect(result).toEqual([
      { id: "kev", name: "Kev", antar: 1, jemput: 3, total: 4 },
      { id: "nur", name: "Nur", antar: 2, jemput: 2, total: 4 },
      { id: "ang", name: "Ang", antar: 2, jemput: 1, total: 3 },
    ]);
  });

  it("keeps active couriers with no current tasks", () => {
    expect(
      buildCourierTaskSummary([{ id: "idle", full_name: "Kurir Kosong" }], []),
    ).toEqual([
      {
        id: "idle",
        name: "Kurir Kosong",
        antar: 0,
        jemput: 0,
        total: 0,
      },
    ]);
  });

  it("retains a courier with pending work even when no longer active", () => {
    expect(
      buildCourierTaskSummary(
        [],
        [
          {
            courier_id: "legacy",
            jenis_tugas: "ANTAR",
            auth_users: { id: "legacy", full_name: "Kurir Lama" },
          },
        ],
      ),
    ).toEqual([
      {
        id: "legacy",
        name: "Kurir Lama",
        antar: 1,
        jemput: 0,
        total: 1,
      },
    ]);
  });
});
