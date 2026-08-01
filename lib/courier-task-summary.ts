export interface CourierTaskSummary {
  id: string;
  name: string;
  antar: number;
  jemput: number;
  total: number;
}

interface CourierIdentity {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

interface PendingCourierTask {
  courier_id: string | null;
  jenis_tugas: string | null;
  auth_users?: CourierIdentity | CourierIdentity[] | null;
}

const courierName = (courier: CourierIdentity | null | undefined) =>
  courier?.full_name?.trim() || courier?.email?.trim() || "Kurir";

export function buildCourierTaskSummary(
  activeCouriers: CourierIdentity[],
  pendingTasks: PendingCourierTask[],
): CourierTaskSummary[] {
  const summary = new Map<string, CourierTaskSummary>();

  activeCouriers.forEach((courier) => {
    summary.set(courier.id, {
      id: courier.id,
      name: courierName(courier),
      antar: 0,
      jemput: 0,
      total: 0,
    });
  });

  pendingTasks.forEach((task) => {
    if (!task.courier_id) return;

    const taskCourier = Array.isArray(task.auth_users)
      ? task.auth_users[0]
      : task.auth_users;
    const current = summary.get(task.courier_id) || {
      id: task.courier_id,
      name: courierName(taskCourier),
      antar: 0,
      jemput: 0,
      total: 0,
    };

    if (task.jenis_tugas?.toUpperCase() === "ANTAR") current.antar += 1;
    if (task.jenis_tugas?.toUpperCase() === "JEMPUT") current.jemput += 1;
    current.total = current.antar + current.jemput;
    summary.set(task.courier_id, current);
  });

  return Array.from(summary.values()).sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "id"),
  );
}
