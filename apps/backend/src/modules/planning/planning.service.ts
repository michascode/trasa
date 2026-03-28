import { randomUUID } from 'node:crypto';
import type {
  PlanningDriverAssignment,
  PlanningOrderSelection,
  PlanningOrderStatus,
  PlanningWeekDetails,
  PlanningWeekRecord,
} from './planning.types.js';

const seededDrivers = [
  { id: 'drv-1', name: 'Jan Kowalski' },
  { id: 'drv-2', name: 'Piotr Nowak' },
  { id: 'drv-3', name: 'Adam Wiśniewski' },
];

const seededOrders = [
  { id: 'ord-1', label: 'ORD-1 | Wrocław | 120 szt.' },
  { id: 'ord-2', label: 'ORD-2 | Zielona Góra | 85 szt.' },
  { id: 'ord-3', label: 'ORD-3 | Poznań | 62 szt.' },
  { id: 'ord-4', label: 'ORD-4 | Legnica | 91 szt.' },
  { id: 'ord-5', label: 'ORD-5 | Opole | 40 szt.' },
];

const weeks = new Map<string, PlanningWeekRecord>();

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMonday(dateInput: string) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Niepoprawna data tygodnia.');
  }
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return toIsoDate(date);
}

function ensureWeek(id: string) {
  const week = weeks.get(id);
  if (!week) {
    throw new Error('Nie znaleziono tygodnia planistycznego.');
  }
  return week;
}

function ensureDraft(week: PlanningWeekRecord) {
  if (week.status === 'archived') {
    throw new Error('Tydzień jest zablokowany jako archiwum.');
  }
}

function counts(orders: PlanningOrderSelection[]) {
  const initial: Record<PlanningOrderStatus, number> = {
    unassigned: 0,
    planned: 0,
    conflict: 0,
    moved: 0,
    skipped: 0,
  };
  for (const order of orders) {
    initial[order.status] += 1;
  }
  return initial;
}

function getPreviousWeekId(weekStartDate: string): string | null {
  const date = new Date(weekStartDate);
  date.setUTCDate(date.getUTCDate() - 7);
  const previousWeekStart = toIsoDate(date);
  return (
    Array.from(weeks.values())
      .find((w) => w.weekStartDate === previousWeekStart)
      ?.id ?? null
  );
}

export function createPlanningWeek(weekStartDate: string) {
  const normalizedMonday = toMonday(weekStartDate);
  const existing = Array.from(weeks.values()).find((w) => w.weekStartDate === normalizedMonday);
  if (existing) {
    return existing;
  }

  const record: PlanningWeekRecord = {
    id: randomUUID(),
    weekStartDate: normalizedMonday,
    status: 'draft',
    lockedAt: null,
    drivers: [],
    orders: [],
  };
  weeks.set(record.id, record);
  return record;
}

export function listPlanningWeeks() {
  return Array.from(weeks.values()).sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
}

export function getPlanningWeek(id: string): PlanningWeekDetails {
  const week = ensureWeek(id);
  return {
    ...week,
    availableDrivers: seededDrivers,
    availableOrders: seededOrders,
    previousWeekId: getPreviousWeekId(week.weekStartDate),
    orderStatusCounts: counts(week.orders),
  };
}

export function assignDriverToWeek(weekId: string, driverId: string, workDaysCount = 5) {
  const week = ensureWeek(weekId);
  ensureDraft(week);
  const driver = seededDrivers.find((entry) => entry.id === driverId);
  if (!driver) {
    throw new Error('Nie znaleziono kierowcy.');
  }

  const existing = week.drivers.find((entry) => entry.driverId === driverId);
  if (existing) {
    existing.workDaysCount = workDaysCount;
    return week;
  }

  const assignment: PlanningDriverAssignment = {
    driverId,
    driverName: driver.name,
    workDaysCount,
  };
  week.drivers.push(assignment);
  return week;
}

export function unassignDriverFromWeek(weekId: string, driverId: string) {
  const week = ensureWeek(weekId);
  ensureDraft(week);
  week.drivers = week.drivers.filter((entry) => entry.driverId !== driverId);
  return week;
}

export function updateDriverWorkDays(weekId: string, driverId: string, workDaysCount: number) {
  const week = ensureWeek(weekId);
  ensureDraft(week);
  const existing = week.drivers.find((entry) => entry.driverId === driverId);
  if (!existing) {
    throw new Error('Kierowca nie jest przypisany do tygodnia.');
  }
  existing.workDaysCount = workDaysCount;
  return week;
}

export function selectOrdersForWeek(weekId: string, orderIds: string[]) {
  const week = ensureWeek(weekId);
  ensureDraft(week);

  week.orders = orderIds.map((id) => {
    const known = seededOrders.find((order) => order.id === id);
    if (!known) {
      throw new Error(`Nieznane zamówienie: ${id}`);
    }
    const existing = week.orders.find((order) => order.orderId === id);
    return {
      orderId: id,
      label: known.label,
      status: existing?.status ?? 'unassigned',
      transferredFromWeekId: existing?.transferredFromWeekId,
    };
  });

  return week;
}

export function setOrderStatus(weekId: string, orderId: string, status: PlanningOrderStatus) {
  const week = ensureWeek(weekId);
  ensureDraft(week);
  const order = week.orders.find((entry) => entry.orderId === orderId);
  if (!order) {
    throw new Error('Zamówienie nie jest wybrane w tym tygodniu.');
  }
  order.status = status;
  return week;
}

export function transferOrdersFromPreviousWeek(weekId: string, orderIds: string[]) {
  const week = ensureWeek(weekId);
  ensureDraft(week);
  const previousWeekId = getPreviousWeekId(week.weekStartDate);
  if (!previousWeekId) {
    throw new Error('Brak poprzedniego tygodnia do przeniesienia zamówień.');
  }
  const previousWeek = ensureWeek(previousWeekId);

  for (const orderId of orderIds) {
    const previousOrder = previousWeek.orders.find((order) => order.orderId === orderId);
    if (!previousOrder) {
      continue;
    }
    previousOrder.status = 'skipped';

    const known = seededOrders.find((order) => order.id === orderId);
    if (!known) {
      continue;
    }
    const existingInCurrent = week.orders.find((order) => order.orderId === orderId);
    if (existingInCurrent) {
      existingInCurrent.status = 'moved';
      existingInCurrent.transferredFromWeekId = previousWeekId;
      continue;
    }
    week.orders.push({
      orderId,
      label: known.label,
      status: 'moved',
      transferredFromWeekId: previousWeekId,
    });
  }

  return week;
}

export function archivePlanningWeek(weekId: string) {
  const week = ensureWeek(weekId);
  week.status = 'archived';
  week.lockedAt = new Date().toISOString();
  return week;
}

export function resetPlanningState() {
  weeks.clear();
}
