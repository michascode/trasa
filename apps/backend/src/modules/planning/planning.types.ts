export type PlanningOrderStatus = 'unassigned' | 'planned' | 'conflict' | 'moved' | 'skipped';

export type PlanningWeekArchiveStatus = 'draft' | 'archived';

export type RouteStopStatus = 'ok' | 'warning' | 'conflict';

export interface PlanningDriverAssignment {
  driverId: string;
  driverName: string;
  workDaysCount: number;
}

export interface PlanningOrderSelection {
  orderId: string;
  label: string;
  status: PlanningOrderStatus;
  transferredFromWeekId?: string;
}

export interface RouteStopRecord {
  id: string;
  orderId: string;
  label: string;
  sequenceNo: number;
  units: number;
  eta: string;
  lat: number;
  lng: number;
  status: RouteStopStatus;
  notes?: string;
}

export interface RouteDayRecord {
  day: number;
  date: string;
  stops: RouteStopRecord[];
  metrics: {
    km: number;
    durationMin: number;
    units: number;
    warnings: string[];
    conflicts: string[];
  };
}

export interface DriverRoutePlanRecord {
  driverId: string;
  driverName: string;
  color: string;
  externalRouteLink?: string;
  days: RouteDayRecord[];
  baselineMetrics: {
    weekKm: number;
    weekDurationMin: number;
    weekUnits: number;
  };
}

export interface ManualEditAuditRecord {
  id: string;
  weekId: string;
  actor: string;
  actionType:
    | 'MOVE_ORDER'
    | 'MOVE_DAY'
    | 'RESEQUENCE_STOP'
    | 'REMOVE_STOP'
    | 'ADD_STOP'
    | 'UPDATE_EXTERNAL_LINK';
  summary: string;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: string;
}

export interface PlanningWeekRecord {
  id: string;
  weekStartDate: string;
  status: PlanningWeekArchiveStatus;
  lockedAt: string | null;
  drivers: PlanningDriverAssignment[];
  orders: PlanningOrderSelection[];
  routePlans: DriverRoutePlanRecord[];
  auditLog: ManualEditAuditRecord[];
}

export interface WeekMetricsSummary {
  day: number;
  current: { km: number; durationMin: number; units: number };
  baseline: { km: number; durationMin: number; units: number };
  delta: { km: number; durationMin: number; units: number };
  warnings: string[];
}

export interface PlanningWeekDetails extends PlanningWeekRecord {
  availableDrivers: Array<{ id: string; name: string }>;
  availableOrders: Array<{ id: string; label: string; units: number; lat: number; lng: number }>;
  previousWeekId: string | null;
  orderStatusCounts: Record<PlanningOrderStatus, number>;
  weeklyDiff: {
    current: { km: number; durationMin: number; units: number };
    baseline: { km: number; durationMin: number; units: number };
    delta: { km: number; durationMin: number; units: number };
    warnings: string[];
  };
  dayDiff: WeekMetricsSummary[];
  mapMeta: {
    availableWeeks: Array<{ id: string; weekStartDate: string }>;
  };
}

export type ManualEditPayload =
  | {
      action: 'MOVE_ORDER';
      actor: string;
      orderId: string;
      fromDriverId: string;
      fromDay: number;
      toDriverId: string;
      toDay: number;
      toSequence?: number;
      reason?: string;
    }
  | {
      action: 'MOVE_DAY';
      actor: string;
      orderId: string;
      driverId: string;
      fromDay: number;
      toDay: number;
      toSequence?: number;
      reason?: string;
    }
  | {
      action: 'RESEQUENCE_STOP';
      actor: string;
      driverId: string;
      day: number;
      stopId: string;
      toSequence: number;
      reason?: string;
    }
  | {
      action: 'REMOVE_STOP';
      actor: string;
      driverId: string;
      day: number;
      stopId: string;
      reason?: string;
    }
  | {
      action: 'ADD_STOP';
      actor: string;
      driverId: string;
      day: number;
      orderId: string;
      toSequence?: number;
      reason?: string;
    }
  | {
      action: 'UPDATE_EXTERNAL_LINK';
      actor: string;
      driverId: string;
      externalRouteLink: string;
      reason?: string;
    };
