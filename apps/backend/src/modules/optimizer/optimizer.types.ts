export type LatLng = { lat: number; lng: number };

export interface DepotInput {
  id: string;
  label: string;
  location: LatLng;
}

export interface OrderInput {
  id: string;
  label: string;
  location: LatLng;
  units: number;
  serviceDurationMin?: number;
}

export interface DriverInput {
  id: string;
  name: string;
  workDaysCount: number;
  vehicleCapacityUnits?: number;
  vehicleFuelConsumptionLPer100Km?: number;
  homeBase?: LatLng;
}

export interface OptimizationOptions {
  vehicleCapacityUnits?: number;
  targetDailyKm?: number;
  targetDailyStopsMin?: number;
  targetDailyStopsMax?: number;
  fuelPricePerLiter?: number;
  averageSpeedKmh?: number;
  forbidTollRoads?: boolean;
  allowOvernightStay?: boolean;
}

export interface OptimizationInput {
  weekStartDate: string;
  depot: DepotInput;
  drivers: DriverInput[];
  orders: OrderInput[];
  options?: OptimizationOptions;
}

export type ConflictCode =
  | 'ORDER_TOO_LARGE_FOR_VEHICLE'
  | 'CAPACITY_EXCEEDED'
  | 'WORKDAY_LIMIT_EXCEEDED'
  | 'INVALID_DRIVER_WORK_DAYS'
  | 'NO_ELIGIBLE_DRIVER'
  | 'DUPLICATE_ORDER'
  | 'TOLL_ROAD_REQUIRED';

export interface ConflictItem {
  orderId?: string;
  driverId?: string;
  dayIndex?: number;
  code: ConflictCode;
  reason: string;
}

export interface RouteStopResult {
  sequenceNo: number;
  stopType: 'DEPOT' | 'DELIVERY' | 'OVERNIGHT';
  orderId: string | null;
  label: string;
  plannedUnits: number;
  distanceFromPrevKm: number;
  durationFromPrevMin: number;
  notes?: string;
}

export interface RouteDayResult {
  dayIndex: number;
  serviceDate: string;
  km: number;
  durationMin: number;
  stopCount: number;
  loadUnits: number;
  overnight: boolean;
  explanations: string[];
  routeStops: RouteStopResult[];
}

export interface RoutePlanResult {
  driverId: string;
  driverName: string;
  vehicleCapacityUnits: number;
  totalKm: number;
  totalDurationMin: number;
  totalFuelCost: number;
  totalStops: number;
  totalLoadUnits: number;
  overnightCount: number;
  feasibilityStatus: 'FEASIBLE' | 'WARNING' | 'INFEASIBLE';
  explanations: string[];
  routeDays: RouteDayResult[];
}

export interface OptimizationReport {
  precheck: {
    totalOrders: number;
    totalUnits: number;
    totalWorkDays: number;
    totalVehicleCapacityPerDay: number;
    totalWeeklyCapacity: number;
  };
  conflicts: ConflictItem[];
  unassignedOrderIds: string[];
  objectiveBreakdown: {
    totalKm: number;
    totalDurationMin: number;
    totalFuelCost: number;
    dailyTargetPenalty: number;
    balancePenalty: number;
    score: number;
  };
  notes: string[];
}

export interface OptimizationResult {
  status: 'FEASIBLE' | 'PARTIAL' | 'INFEASIBLE';
  routePlans: RoutePlanResult[];
  report: OptimizationReport;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  input: OptimizationInput;
}
