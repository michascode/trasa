import { randomUUID } from 'node:crypto';
import type {
  DriverRoutePlanRecord,
  ManualEditAuditRecord,
  ManualEditPayload,
  PlanningDriverAssignment,
  PlanningOrderSelection,
  PlanningOrderStatus,
  PlanningWeekDetails,
  PlanningWeekRecord,
  RouteDayRecord,
  RouteStopRecord,
} from './planning.types.js';

const MAX_DAY_KM = 420;
const MAX_DAY_DURATION_MIN = 600;
const MAX_DAY_UNITS = 320;

const seededDrivers = [
  { id: 'drv-1', name: 'Jan Kowalski', color: '#2563eb' },
  { id: 'drv-2', name: 'Piotr Nowak', color: '#16a34a' },
  { id: 'drv-3', name: 'Adam Wiśniewski', color: '#dc2626' },
];

const seededOrders = [
  { id: 'ord-1', label: 'ORD-1 | Wrocław | 120 szt.', units: 120, lat: 51.1079, lng: 17.0385 },
  { id: 'ord-2', label: 'ORD-2 | Zielona Góra | 85 szt.', units: 85, lat: 51.9356, lng: 15.5062 },
  { id: 'ord-3', label: 'ORD-3 | Poznań | 62 szt.', units: 62, lat: 52.4064, lng: 16.9252 },
  { id: 'ord-4', label: 'ORD-4 | Legnica | 91 szt.', units: 91, lat: 51.207, lng: 16.155 },
  { id: 'ord-5', label: 'ORD-5 | Opole | 40 szt.', units: 40, lat: 50.6751, lng: 17.9213 },
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

function getWeekDates(weekStartDate: string) {
  const base = new Date(`${weekStartDate}T00:00:00.000Z`);
  return Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() + idx);
    return toIsoDate(date);
  });
}

function recalcDayMetrics(day: RouteDayRecord) {
  day.stops.sort((a, b) => a.sequenceNo - b.sequenceNo);
  day.stops.forEach((stop, idx) => {
    stop.sequenceNo = idx + 1;
    stop.eta = `${8 + idx}:${idx % 2 === 0 ? '00' : '30'}`;
  });

  const units = day.stops.reduce((sum, stop) => sum + stop.units, 0);
  const km = day.stops.reduce((sum, stop, idx) => sum + 18 + idx * 5 + stop.units * 0.05, 0);
  const durationMin = day.stops.reduce((sum, stop, idx) => sum + 35 + idx * 8 + Math.round(stop.units * 0.12), 0);

  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (km > MAX_DAY_KM) warnings.push('Przekroczony limit km dla dnia.');
  if (durationMin > MAX_DAY_DURATION_MIN) warnings.push('Przekroczony limit czasu pracy kierowcy.');
  if (units > MAX_DAY_UNITS) conflicts.push('Przekroczona pojemność auta.');

  for (const stop of day.stops) {
    stop.status = 'ok';
    if (warnings.length > 0) {
      stop.status = 'warning';
    }
    if (conflicts.length > 0 || stop.units > 160) {
      stop.status = 'conflict';
    }
  }

  day.metrics = {
    km: Math.round(km),
    durationMin: Math.round(durationMin),
    units,
    warnings,
    conflicts,
  };
}

function findOrder(orderId: string) {
  const order = seededOrders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error(`Nieznane zamówienie: ${orderId}`);
  }
  return order;
}

function makeStop(orderId: string, sequenceNo: number): RouteStopRecord {
  const order = findOrder(orderId);
  return {
    id: randomUUID(),
    orderId,
    label: order.label,
    sequenceNo,
    units: order.units,
    eta: `8:${sequenceNo * 5}`,
    lat: order.lat,
    lng: order.lng,
    status: 'ok',
  };
}

function getDriverPlan(week: PlanningWeekRecord, driverId: string) {
  const plan = week.routePlans.find((entry) => entry.driverId === driverId);
  if (!plan) {
    throw new Error('Nie znaleziono trasy kierowcy.');
  }
  return plan;
}

function getRouteDay(plan: DriverRoutePlanRecord, day: number) {
  const routeDay = plan.days.find((entry) => entry.day === day);
  if (!routeDay) {
    throw new Error('Nie znaleziono dnia trasy.');
  }
  return routeDay;
}

function recalculateWeek(week: PlanningWeekRecord) {
  for (const plan of week.routePlans) {
    for (const day of plan.days) {
      recalcDayMetrics(day);
    }
  }
}

function getBaselineDay(plan: DriverRoutePlanRecord, day: number) {
  const routeDay = getRouteDay(plan, day);
  return routeDay.stops.reduce(
    (agg, stop, idx) => {
      agg.km += 16 + idx * 4 + stop.units * 0.04;
      agg.durationMin += 30 + idx * 6 + Math.round(stop.units * 0.1);
      agg.units += stop.units;
      return agg;
    },
    { km: 0, durationMin: 0, units: 0 },
  );
}

function aggregateDiff(week: PlanningWeekRecord) {
  const dayDiffMap = new Map<number, { current: { km: number; durationMin: number; units: number }; baseline: { km: number; durationMin: number; units: number }; warnings: string[] }>();

  for (const plan of week.routePlans) {
    for (const day of plan.days) {
      const base = getBaselineDay(plan, day.day);
      const entry = dayDiffMap.get(day.day) ?? {
        current: { km: 0, durationMin: 0, units: 0 },
        baseline: { km: 0, durationMin: 0, units: 0 },
        warnings: [],
      };
      entry.current.km += day.metrics.km;
      entry.current.durationMin += day.metrics.durationMin;
      entry.current.units += day.metrics.units;
      entry.baseline.km += Math.round(base.km);
      entry.baseline.durationMin += Math.round(base.durationMin);
      entry.baseline.units += base.units;
      entry.warnings.push(...day.metrics.warnings, ...day.metrics.conflicts);
      dayDiffMap.set(day.day, entry);
    }
  }

  const dayDiff = Array.from(dayDiffMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, data]) => ({
      day,
      current: data.current,
      baseline: data.baseline,
      delta: {
        km: data.current.km - data.baseline.km,
        durationMin: data.current.durationMin - data.baseline.durationMin,
        units: data.current.units - data.baseline.units,
      },
      warnings: [...new Set(data.warnings)],
    }));

  const weekly = dayDiff.reduce(
    (agg, day) => {
      agg.current.km += day.current.km;
      agg.current.durationMin += day.current.durationMin;
      agg.current.units += day.current.units;
      agg.baseline.km += day.baseline.km;
      agg.baseline.durationMin += day.baseline.durationMin;
      agg.baseline.units += day.baseline.units;
      agg.warnings.push(...day.warnings);
      return agg;
    },
    {
      current: { km: 0, durationMin: 0, units: 0 },
      baseline: { km: 0, durationMin: 0, units: 0 },
      warnings: [] as string[],
    },
  );

  return {
    dayDiff,
    weeklyDiff: {
      current: weekly.current,
      baseline: weekly.baseline,
      delta: {
        km: weekly.current.km - weekly.baseline.km,
        durationMin: weekly.current.durationMin - weekly.baseline.durationMin,
        units: weekly.current.units - weekly.baseline.units,
      },
      warnings: [...new Set(weekly.warnings)],
    },
  };
}

function audit(week: PlanningWeekRecord, event: Omit<ManualEditAuditRecord, 'id' | 'weekId' | 'createdAt'>) {
  week.auditLog.unshift({
    id: randomUUID(),
    weekId: week.id,
    createdAt: new Date().toISOString(),
    ...event,
  });
}

function removeOrderFromRoute(plan: DriverRoutePlanRecord, day: number, orderId: string) {
  const routeDay = getRouteDay(plan, day);
  const index = routeDay.stops.findIndex((stop) => stop.orderId === orderId);
  if (index < 0) {
    return null;
  }
  const [stop] = routeDay.stops.splice(index, 1);
  recalcDayMetrics(routeDay);
  return stop;
}

function insertStop(plan: DriverRoutePlanRecord, day: number, stop: RouteStopRecord, toSequence?: number) {
  const routeDay = getRouteDay(plan, day);
  const targetIndex = typeof toSequence === 'number' ? Math.max(0, Math.min(routeDay.stops.length, toSequence - 1)) : routeDay.stops.length;
  routeDay.stops.splice(targetIndex, 0, stop);
  recalcDayMetrics(routeDay);
}

export function createPlanningWeek(weekStartDate: string) {
  const normalizedMonday = toMonday(weekStartDate);
  const existing = Array.from(weeks.values()).find((w) => w.weekStartDate === normalizedMonday);
  if (existing) {
    return existing;
  }

  const weekDates = getWeekDates(normalizedMonday);
  const routePlans: DriverRoutePlanRecord[] = seededDrivers.map((driver) => ({
    driverId: driver.id,
    driverName: driver.name,
    color: driver.color,
    externalRouteLink: '',
    baselineMetrics: {
      weekKm: 0,
      weekDurationMin: 0,
      weekUnits: 0,
    },
    days: weekDates.map((date, idx) => ({
      day: idx + 1,
      date,
      stops: [],
      metrics: { km: 0, durationMin: 0, units: 0, warnings: [], conflicts: [] },
    })),
  }));

  const record: PlanningWeekRecord = {
    id: randomUUID(),
    weekStartDate: normalizedMonday,
    status: 'draft',
    lockedAt: null,
    drivers: [],
    orders: [],
    routePlans,
    auditLog: [],
  };
  weeks.set(record.id, record);
  return record;
}

export function listPlanningWeeks() {
  return Array.from(weeks.values()).sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
}

export function getPlanningWeek(id: string): PlanningWeekDetails {
  const week = ensureWeek(id);
  recalculateWeek(week);
  const { dayDiff, weeklyDiff } = aggregateDiff(week);

  return {
    ...week,
    availableDrivers: seededDrivers.map(({ id, name }) => ({ id, name })),
    availableOrders: seededOrders,
    previousWeekId: getPreviousWeekId(week.weekStartDate),
    orderStatusCounts: counts(week.orders),
    weeklyDiff,
    dayDiff,
    mapMeta: {
      availableWeeks: listPlanningWeeks().map((item) => ({ id: item.id, weekStartDate: item.weekStartDate })),
    },
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

  for (const plan of week.routePlans) {
    for (const day of plan.days) {
      day.stops = day.stops.filter((stop) => orderIds.includes(stop.orderId));
      recalcDayMetrics(day);
    }
  }

  const assigned = new Set(week.routePlans.flatMap((plan) => plan.days.flatMap((day) => day.stops.map((stop) => stop.orderId))));
  const targetPlans = week.drivers.length > 0 ? week.routePlans.filter((plan) => week.drivers.some((driver) => driver.driverId === plan.driverId)) : week.routePlans;
  if (targetPlans.length > 0) {
    orderIds.forEach((orderId, idx) => {
      if (assigned.has(orderId)) return;
      const plan = targetPlans[idx % targetPlans.length];
      const day = ((idx % 5) + 1);
      insertStop(plan, day, makeStop(orderId, 1));
    });
  }

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

export function applyManualEdit(weekId: string, payload: ManualEditPayload) {
  const week = ensureWeek(weekId);
  ensureDraft(week);

  if (payload.action === 'MOVE_ORDER') {
    const fromPlan = getDriverPlan(week, payload.fromDriverId);
    const stop = removeOrderFromRoute(fromPlan, payload.fromDay, payload.orderId);
    if (!stop) throw new Error('Nie znaleziono stopu do przeniesienia.');

    const toPlan = getDriverPlan(week, payload.toDriverId);
    insertStop(toPlan, payload.toDay, { ...stop, id: randomUUID() }, payload.toSequence);
    audit(week, {
      actor: payload.actor,
      actionType: 'MOVE_ORDER',
      summary: `Przeniesiono ${payload.orderId} z ${fromPlan.driverName} D${payload.fromDay} do ${toPlan.driverName} D${payload.toDay}.`,
      beforeJson: { fromDriverId: payload.fromDriverId, fromDay: payload.fromDay },
      afterJson: { toDriverId: payload.toDriverId, toDay: payload.toDay, toSequence: payload.toSequence },
    });
  }

  if (payload.action === 'MOVE_DAY') {
    const plan = getDriverPlan(week, payload.driverId);
    const stop = removeOrderFromRoute(plan, payload.fromDay, payload.orderId);
    if (!stop) throw new Error('Nie znaleziono stopu do zmiany dnia.');
    insertStop(plan, payload.toDay, { ...stop, id: randomUUID() }, payload.toSequence);
    audit(week, {
      actor: payload.actor,
      actionType: 'MOVE_DAY',
      summary: `Przeniesiono ${payload.orderId} z D${payload.fromDay} na D${payload.toDay}.`,
      beforeJson: { fromDay: payload.fromDay },
      afterJson: { toDay: payload.toDay, toSequence: payload.toSequence },
    });
  }

  if (payload.action === 'RESEQUENCE_STOP') {
    const plan = getDriverPlan(week, payload.driverId);
    const day = getRouteDay(plan, payload.day);
    const index = day.stops.findIndex((stop) => stop.id === payload.stopId);
    if (index < 0) throw new Error('Nie znaleziono stopu do zmiany kolejności.');

    const [stop] = day.stops.splice(index, 1);
    const target = Math.max(0, Math.min(day.stops.length, payload.toSequence - 1));
    day.stops.splice(target, 0, stop);
    recalcDayMetrics(day);
    audit(week, {
      actor: payload.actor,
      actionType: 'RESEQUENCE_STOP',
      summary: `Zmieniono kolejność stopu ${payload.stopId} na pozycję ${payload.toSequence}.`,
      beforeJson: { day: payload.day, oldSequence: index + 1 },
      afterJson: { day: payload.day, toSequence: payload.toSequence },
    });
  }

  if (payload.action === 'REMOVE_STOP') {
    const plan = getDriverPlan(week, payload.driverId);
    const day = getRouteDay(plan, payload.day);
    const index = day.stops.findIndex((stop) => stop.id === payload.stopId);
    if (index < 0) throw new Error('Nie znaleziono stopu do usunięcia.');
    const [removed] = day.stops.splice(index, 1);
    recalcDayMetrics(day);
    audit(week, {
      actor: payload.actor,
      actionType: 'REMOVE_STOP',
      summary: `Usunięto stop ${removed.orderId} z D${payload.day}.`,
      beforeJson: removed,
      afterJson: { day: payload.day },
    });
  }

  if (payload.action === 'ADD_STOP') {
    const plan = getDriverPlan(week, payload.driverId);
    const existing = plan.days.some((day) => day.stops.some((stop) => stop.orderId === payload.orderId));
    if (existing) {
      throw new Error('Zamówienie już istnieje na trasie kierowcy.');
    }
    const stop = makeStop(payload.orderId, 1);
    insertStop(plan, payload.day, stop, payload.toSequence);
    audit(week, {
      actor: payload.actor,
      actionType: 'ADD_STOP',
      summary: `Dodano ${payload.orderId} do D${payload.day}.`,
      beforeJson: {},
      afterJson: { day: payload.day, orderId: payload.orderId, toSequence: payload.toSequence },
    });
  }

  if (payload.action === 'UPDATE_EXTERNAL_LINK') {
    const plan = getDriverPlan(week, payload.driverId);
    const before = plan.externalRouteLink;
    plan.externalRouteLink = payload.externalRouteLink;
    audit(week, {
      actor: payload.actor,
      actionType: 'UPDATE_EXTERNAL_LINK',
      summary: `Zmieniono link zewnętrzny dla ${plan.driverName}.`,
      beforeJson: { externalRouteLink: before },
      afterJson: { externalRouteLink: payload.externalRouteLink },
    });
  }

  recalculateWeek(week);
  return getPlanningWeek(weekId);
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
