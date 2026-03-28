import type {
  ConflictItem,
  DemoScenario,
  DriverInput,
  OptimizationInput,
  OptimizationResult,
  OrderInput,
  RouteDayResult,
  RoutePlanResult,
  RouteStopResult,
} from './optimizer.types.js';
import { HaversineRoutingProvider, type DistanceTimeMatrix, type RoutingProvider } from './providers.js';

const defaultOptions = {
  vehicleCapacityUnits: 1800,
  targetDailyKm: 400,
  targetDailyStopsMin: 15,
  targetDailyStopsMax: 20,
  fuelPricePerLiter: 6.6,
  averageSpeedKmh: 62,
  forbidTollRoads: true,
  allowOvernightStay: true,
};

type MutableDay = {
  dayIndex: number;
  orderIds: string[];
  loadUnits: number;
};

type MutablePlan = {
  driver: DriverInput;
  days: MutableDay[];
};

function parseIsoDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Niepoprawna data weekStartDate.');
  }
  return date;
}

function addDays(date: Date, offset: number): string {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + offset);
  return clone.toISOString().slice(0, 10);
}

function createDays(workDaysCount: number): MutableDay[] {
  return Array.from({ length: workDaysCount }).map((_, index) => ({
    dayIndex: index + 1,
    orderIds: [],
    loadUnits: 0,
  }));
}

function calcFuelCost(km: number, consumptionLPer100Km: number, fuelPrice: number) {
  return Number((((km / 100) * consumptionLPer100Km) * fuelPrice).toFixed(2));
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function assertNoDuplicates(orders: OrderInput[]) {
  const seen = new Set<string>();
  const duplicates: ConflictItem[] = [];
  for (const order of orders) {
    if (seen.has(order.id)) {
      duplicates.push({
        orderId: order.id,
        code: 'DUPLICATE_ORDER',
        reason: `Zamówienie ${order.id} występuje więcej niż raz w wejściu i może być przypisane maksymalnie raz.`,
      });
      continue;
    }
    seen.add(order.id);
  }
  return duplicates;
}

function buildStopsForDay(
  day: MutableDay,
  plan: MutablePlan,
  serviceDate: string,
  indexByOrderId: Map<string, number>,
  matrix: DistanceTimeMatrix,
  ordersById: Map<string, OrderInput>,
  depotIndex: number,
  options: typeof defaultOptions,
): RouteDayResult {
  if (day.orderIds.length === 0) {
    return {
      dayIndex: day.dayIndex,
      serviceDate,
      km: 0,
      durationMin: 0,
      stopCount: 0,
      loadUnits: 0,
      overnight: false,
      explanations: ['Brak zleceń na ten dzień.'],
      routeStops: [],
    };
  }

  const unvisited = new Set(day.orderIds);
  const orderedIds: string[] = [];
  let previousIndex = depotIndex;

  while (unvisited.size > 0) {
    let best: { id: string; score: number } | null = null;
    for (const orderId of unvisited) {
      const idx = indexByOrderId.get(orderId)!;
      const distance = matrix.distanceKm[previousIndex][idx];
      const duration = matrix.durationMin[previousIndex][idx];
      const service = ordersById.get(orderId)?.serviceDurationMin ?? 12;
      const score = distance + duration * 0.3 + service * 0.1;
      if (!best || score < best.score) {
        best = { id: orderId, score };
      }
    }
    if (!best) break;
    orderedIds.push(best.id);
    previousIndex = indexByOrderId.get(best.id)!;
    unvisited.delete(best.id);
  }

  const stops: RouteStopResult[] = [];
  let totalKm = 0;
  let totalDuration = 0;
  let fromIndex = depotIndex;

  orderedIds.forEach((orderId, idx) => {
    const pointIndex = indexByOrderId.get(orderId)!;
    const order = ordersById.get(orderId)!;
    const distance = matrix.distanceKm[fromIndex][pointIndex];
    const travelMin = matrix.durationMin[fromIndex][pointIndex];
    const serviceMin = order.serviceDurationMin ?? 12;
    totalKm += distance;
    totalDuration += travelMin + serviceMin;

    stops.push({
      sequenceNo: idx + 1,
      stopType: 'DELIVERY',
      orderId,
      label: order.label,
      plannedUnits: order.units,
      distanceFromPrevKm: round2(distance),
      durationFromPrevMin: travelMin + serviceMin,
      notes: `Dostawa ${order.units} jednostek.`,
    });
    fromIndex = pointIndex;
  });

  const returnDistance = matrix.distanceKm[fromIndex][depotIndex];
  const returnDuration = matrix.durationMin[fromIndex][depotIndex];
  totalKm += returnDistance;
  totalDuration += returnDuration;

  const dailyStops = orderedIds.length;
  const overnight = options.allowOvernightStay && totalKm > options.targetDailyKm * 1.15;
  if (overnight) {
    stops.push({
      sequenceNo: stops.length + 1,
      stopType: 'OVERNIGHT',
      orderId: null,
      label: 'Nocowanie kierowcy',
      plannedUnits: 0,
      distanceFromPrevKm: 0,
      durationFromPrevMin: 0,
      notes: 'Przekroczono docelowy dystans dobowy, dodano nocowanie.',
    });
  }

  const explanations = [
    `Dzień zawiera ${dailyStops} punktów i ${round2(totalKm)} km.`,
    `Ładunek dzienny: ${day.loadUnits} jednostek przy limicie ${plan.driver.vehicleCapacityUnits ?? options.vehicleCapacityUnits}.`,
  ];

  if (dailyStops < options.targetDailyStopsMin || dailyStops > options.targetDailyStopsMax) {
    explanations.push('Liczba punktów dziennie poza zakresem miękkim 15–20.');
  }

  return {
    dayIndex: day.dayIndex,
    serviceDate,
    km: round2(totalKm),
    durationMin: Math.round(totalDuration),
    stopCount: dailyStops,
    loadUnits: day.loadUnits,
    overnight,
    explanations,
    routeStops: stops,
  };
}

function buildDemoScenarios(): DemoScenario[] {
  return [
    {
      id: 'dolny-slask-balanced',
      name: 'Dolny Śląsk — scenariusz bazowy',
      description: 'Zbalansowany scenariusz z 3 kierowcami i 18 zamówieniami.',
      input: {
        weekStartDate: '2026-03-30',
        depot: { id: 'depot-wro', label: 'Wrocław Depot', location: { lat: 51.1079, lng: 17.0385 } },
        drivers: [
          { id: 'drv-1', name: 'Jan Kowalski', workDaysCount: 5, vehicleFuelConsumptionLPer100Km: 24 },
          { id: 'drv-2', name: 'Piotr Nowak', workDaysCount: 5, vehicleFuelConsumptionLPer100Km: 25 },
          { id: 'drv-3', name: 'Adam Wiśniewski', workDaysCount: 4, vehicleFuelConsumptionLPer100Km: 23 },
        ],
        orders: Array.from({ length: 18 }).map((_, index) => ({
          id: `ord-${index + 1}`,
          label: `ORD-${index + 1}`,
          location: {
            lat: 50.8 + (index % 6) * 0.14,
            lng: 16.6 + (index % 5) * 0.22,
          },
          units: 60 + ((index * 37) % 140),
          serviceDurationMin: 10 + (index % 4) * 5,
        })),
      },
    },
    {
      id: 'capacity-overflow',
      name: 'Przeciążenie pojemności',
      description: 'Celowo konfliktowy scenariusz do testów raportowania ograniczeń.',
      input: {
        weekStartDate: '2026-03-30',
        depot: { id: 'depot-poz', label: 'Poznań Depot', location: { lat: 52.4064, lng: 16.9252 } },
        drivers: [{ id: 'drv-a', name: 'Marek Testowy', workDaysCount: 2, vehicleCapacityUnits: 500 }],
        orders: [
          { id: 'ord-a', label: 'A', location: { lat: 52.3, lng: 16.7 }, units: 420 },
          { id: 'ord-b', label: 'B', location: { lat: 52.2, lng: 16.9 }, units: 390 },
          { id: 'ord-c', label: 'C', location: { lat: 52.1, lng: 17.1 }, units: 380 },
          { id: 'ord-d', label: 'D', location: { lat: 52.0, lng: 17.2 }, units: 350 },
        ],
      },
    },
  ];
}

export function listDemoScenarios() {
  return buildDemoScenarios().map(({ id, name, description, input }) => ({
    id,
    name,
    description,
    precheck: {
      totalOrders: input.orders.length,
      totalUnits: input.orders.reduce((sum, order) => sum + order.units, 0),
      totalWorkDays: input.drivers.reduce((sum, driver) => sum + driver.workDaysCount, 0),
    },
  }));
}

export function getDemoScenario(id: string) {
  return buildDemoScenarios().find((scenario) => scenario.id === id) ?? null;
}

export async function runOptimization(
  rawInput: OptimizationInput,
  provider: RoutingProvider = new HaversineRoutingProvider(),
): Promise<OptimizationResult> {
  const options = { ...defaultOptions, ...rawInput.options };
  const weekStart = parseIsoDate(rawInput.weekStartDate);
  const conflicts: ConflictItem[] = [];

  const duplicateConflicts = assertNoDuplicates(rawInput.orders);
  conflicts.push(...duplicateConflicts);

  for (const driver of rawInput.drivers) {
    if (driver.workDaysCount < 1 || driver.workDaysCount > 7) {
      conflicts.push({
        driverId: driver.id,
        code: 'INVALID_DRIVER_WORK_DAYS',
        reason: `Kierowca ${driver.name} ma niedozwoloną liczbę dni pracy (${driver.workDaysCount}).`,
      });
    }
  }

  const dailyCapacityTotal = rawInput.drivers.reduce(
    (sum, driver) => sum + (driver.vehicleCapacityUnits ?? options.vehicleCapacityUnits),
    0,
  );
  const totalWorkDays = rawInput.drivers.reduce((sum, driver) => sum + driver.workDaysCount, 0);
  const totalWeeklyCapacity = rawInput.drivers.reduce(
    (sum, driver) => sum + (driver.vehicleCapacityUnits ?? options.vehicleCapacityUnits) * driver.workDaysCount,
    0,
  );

  const totalUnits = rawInput.orders.reduce((sum, order) => sum + order.units, 0);

  if (totalUnits > totalWeeklyCapacity) {
    conflicts.push({
      code: 'CAPACITY_EXCEEDED',
      reason: `Suma ładunku (${totalUnits}) przekracza tygodniową pojemność floty (${totalWeeklyCapacity}).`,
    });
  }

  const points = [rawInput.depot.location, ...rawInput.orders.map((order) => order.location)];
  const matrix = await provider.getDistanceTimeMatrix(points, {
    forbidTollRoads: options.forbidTollRoads,
    averageSpeedKmh: options.averageSpeedKmh,
  });

  for (const violation of matrix.tollForbiddenViolations) {
    conflicts.push({
      code: 'TOLL_ROAD_REQUIRED',
      reason: `Połączenie ${violation.from} -> ${violation.to} wymaga drogi płatnej (${violation.reason}).`,
    });
  }

  const ordersById = new Map(rawInput.orders.map((order) => [order.id, order]));
  const indexByOrderId = new Map(rawInput.orders.map((order, idx) => [order.id, idx + 1]));

  const plans: MutablePlan[] = rawInput.drivers.map((driver) => ({
    driver,
    days: createDays(driver.workDaysCount),
  }));

  const sortedOrders = [...rawInput.orders].sort((a, b) => b.units - a.units);
  const unassigned = new Set<string>();

  for (const order of sortedOrders) {
    let bestCandidate: { plan: MutablePlan; day: MutableDay; score: number } | null = null;

    for (const plan of plans) {
      const capacity = plan.driver.vehicleCapacityUnits ?? options.vehicleCapacityUnits;
      if (order.units > capacity) {
        continue;
      }
      for (const day of plan.days) {
        if (day.loadUnits + order.units > capacity) {
          continue;
        }

        const projectedStops = day.orderIds.length + 1;
        const dayKmPenalty = Math.abs(projectedStops - ((options.targetDailyStopsMin + options.targetDailyStopsMax) / 2)) * 4;
        const loadPenalty = ((day.loadUnits + order.units) / capacity) * 35;
        const balancePenalty = day.orderIds.length * 3;
        const depotToOrder = matrix.distanceKm[0][indexByOrderId.get(order.id)!];
        const score = dayKmPenalty + loadPenalty + balancePenalty + depotToOrder;

        if (!bestCandidate || score < bestCandidate.score) {
          bestCandidate = { plan, day, score };
        }
      }
    }

    if (!bestCandidate) {
      unassigned.add(order.id);
      const tooLargeForAll = plans.every((plan) => order.units > (plan.driver.vehicleCapacityUnits ?? options.vehicleCapacityUnits));
      conflicts.push({
        orderId: order.id,
        code: tooLargeForAll ? 'ORDER_TOO_LARGE_FOR_VEHICLE' : 'NO_ELIGIBLE_DRIVER',
        reason: tooLargeForAll
          ? `Zamówienie ${order.id} (${order.units}) przekracza pojemność każdego pojazdu.`
          : `Brak kierowcy/dnia z dostępną pojemnością dla zamówienia ${order.id}.`,
      });
      continue;
    }

    bestCandidate.day.orderIds.push(order.id);
    bestCandidate.day.loadUnits += order.units;
  }

  const routePlans: RoutePlanResult[] = plans.map((plan) => {
    const routeDays = plan.days.map((day) =>
      buildStopsForDay(
        day,
        plan,
        addDays(weekStart, day.dayIndex - 1),
        indexByOrderId,
        matrix,
        ordersById,
        0,
        options,
      ),
    );

    const totalKm = round2(routeDays.reduce((sum, day) => sum + day.km, 0));
    const totalDurationMin = routeDays.reduce((sum, day) => sum + day.durationMin, 0);
    const totalStops = routeDays.reduce((sum, day) => sum + day.stopCount, 0);
    const totalLoadUnits = routeDays.reduce((sum, day) => sum + day.loadUnits, 0);
    const overnightCount = routeDays.filter((day) => day.overnight).length;
    const fuelConsumption = plan.driver.vehicleFuelConsumptionLPer100Km ?? 24;
    const totalFuelCost = calcFuelCost(totalKm, fuelConsumption, options.fuelPricePerLiter);

    const explanations = [
      `Plan wygenerowany providerem ${provider.name}.`,
      `Uwzględniono zakaz dróg płatnych: ${options.forbidTollRoads ? 'tak' : 'nie'}.`,
      `Kierowca ma ${plan.driver.workDaysCount} dni pracy; wygenerowano ${routeDays.length} RouteDay.`,
    ];

    return {
      driverId: plan.driver.id,
      driverName: plan.driver.name,
      vehicleCapacityUnits: plan.driver.vehicleCapacityUnits ?? options.vehicleCapacityUnits,
      totalKm,
      totalDurationMin,
      totalFuelCost,
      totalStops,
      totalLoadUnits,
      overnightCount,
      feasibilityStatus: 'FEASIBLE',
      explanations,
      routeDays,
    };
  });

  const workloads = routePlans.map((plan) => plan.totalLoadUnits);
  const avgWorkload = workloads.length === 0 ? 0 : workloads.reduce((a, b) => a + b, 0) / workloads.length;
  const balancePenalty = round2(workloads.reduce((sum, load) => sum + Math.abs(load - avgWorkload), 0));
  const totalKm = round2(routePlans.reduce((sum, plan) => sum + plan.totalKm, 0));
  const totalDurationMin = routePlans.reduce((sum, plan) => sum + plan.totalDurationMin, 0);
  const totalFuelCost = round2(routePlans.reduce((sum, plan) => sum + plan.totalFuelCost, 0));
  const dailyTargetPenalty = round2(
    routePlans
      .flatMap((plan) => plan.routeDays)
      .reduce((sum, day) => sum + Math.abs(day.km - options.targetDailyKm), 0),
  );

  const score = round2(totalKm * 1.2 + totalDurationMin * 0.35 + totalFuelCost * 2 + dailyTargetPenalty + balancePenalty);

  const status: OptimizationResult['status'] =
    conflicts.length === 0 ? 'FEASIBLE' : unassigned.size === rawInput.orders.length ? 'INFEASIBLE' : 'PARTIAL';

  const notes = [
    `Silnik wykonał wielodniowe przypisanie dla ${rawInput.drivers.length} kierowców.`,
    'Każde zamówienie jest przypisywane co najwyżej raz.',
    'Wynik zawiera gotowe struktury RoutePlan/RouteDay/RouteStop wraz z metrykami.',
  ];

  return {
    status,
    routePlans: routePlans.map((plan) => ({
      ...plan,
      feasibilityStatus: status === 'INFEASIBLE' ? 'INFEASIBLE' : conflicts.length > 0 ? 'WARNING' : 'FEASIBLE',
    })),
    report: {
      precheck: {
        totalOrders: rawInput.orders.length,
        totalUnits,
        totalWorkDays,
        totalVehicleCapacityPerDay: dailyCapacityTotal,
        totalWeeklyCapacity,
      },
      conflicts,
      unassignedOrderIds: Array.from(unassigned),
      objectiveBreakdown: {
        totalKm,
        totalDurationMin,
        totalFuelCost,
        dailyTargetPenalty,
        balancePenalty,
        score,
      },
      notes,
    },
  };
}
