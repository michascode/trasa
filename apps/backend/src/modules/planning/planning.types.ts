export type PlanningOrderStatus = 'unassigned' | 'planned' | 'conflict' | 'moved' | 'skipped';

export type PlanningWeekArchiveStatus = 'draft' | 'archived';

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

export interface PlanningWeekRecord {
  id: string;
  weekStartDate: string;
  status: PlanningWeekArchiveStatus;
  lockedAt: string | null;
  drivers: PlanningDriverAssignment[];
  orders: PlanningOrderSelection[];
}

export interface PlanningWeekDetails extends PlanningWeekRecord {
  availableDrivers: Array<{ id: string; name: string }>;
  availableOrders: Array<{ id: string; label: string }>;
  previousWeekId: string | null;
  orderStatusCounts: Record<PlanningOrderStatus, number>;
}
