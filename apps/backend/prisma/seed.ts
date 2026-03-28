import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole, ImportBatchStatus, OrderStatus, PlanningWeekStatus, RawImportRowStatus, RouteFeasibilityStatus, RouteManualEditAction, RoutePlanStatus, RouteStopType, FuelPriceSource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  const roleRecords = [
    { code: 'ADMIN', name: 'Administrator' },
    { code: 'MANAGER', name: 'Manager planowania' },
    { code: 'VIEWER', name: 'Podgląd' },
  ];

  for (const role of roleRecords) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  const defaultUsers = [
    { email: 'admin@trasa.local', role: UserRole.ADMIN },
    { email: 'manager@trasa.local', role: UserRole.MANAGER },
    { email: 'viewer@trasa.local', role: UserRole.VIEWER },
  ];

  for (const user of defaultUsers) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role, isActive: true },
      create: {
        email: user.email,
        role: user.role,
        passwordHash,
      },
    });

    const role = await prisma.role.findUniqueOrThrow({ where: { code: user.role } });
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: created.id, roleId: role.id } },
      update: {},
      create: { userId: created.id, roleId: role.id },
    });
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@trasa.local' } });

  const vehicle = await prisma.vehicle.upsert({
    where: { code: 'CAR-01' },
    update: { name: 'Renault Master', capacityUnits: 1800 },
    create: { code: 'CAR-01', name: 'Renault Master', capacityUnits: 1800 },
  });

  const driver = await prisma.driver.upsert({
    where: { code: 'DRV-01' },
    update: { name: 'Jan Kowalski', defaultVehicleId: vehicle.id },
    create: { code: 'DRV-01', name: 'Jan Kowalski', defaultVehicleId: vehicle.id },
  });

  const planningWeek = await prisma.planningWeek.upsert({
    where: { weekStartDate_version: { weekStartDate: new Date('2026-03-23'), version: 1 } },
    update: { status: PlanningWeekStatus.DRAFT, isCurrentVersion: true, createdById: admin.id },
    create: {
      weekStartDate: new Date('2026-03-23'),
      version: 1,
      status: PlanningWeekStatus.DRAFT,
      createdById: admin.id,
      isCurrentVersion: true,
    },
  });

  await prisma.driverWeeklyAvailability.upsert({
    where: { planningWeekId_driverId: { planningWeekId: planningWeek.id, driverId: driver.id } },
    update: { workDaysCount: 5, allowedWeekdays: [1, 2, 3, 4, 5] },
    create: {
      planningWeekId: planningWeek.id,
      driverId: driver.id,
      workDaysCount: 5,
      allowedWeekdays: [1, 2, 3, 4, 5],
    },
  });

  const importBatch = await prisma.orderImportBatch.create({
    data: {
      planningWeekId: planningWeek.id,
      sourceFilename: 'seed-orders.xlsx',
      sourceHash: 'seed-hash-v1',
      importedById: admin.id,
      totalRows: 1,
      successRows: 1,
      errorRows: 0,
      status: ImportBatchStatus.VALIDATED,
    },
  });

  const aliasSeed = [
    { alias: 'rosa', canonicalBreedKey: 'rosa', displayGroupColumn: 'Rosa' },
    { alias: 'r', canonicalBreedKey: 'rosa', displayGroupColumn: 'Rosa' },
    { alias: 'kog', canonicalBreedKey: 'kogut', displayGroupColumn: 'Kogut' },
    { alias: 'kogut', canonicalBreedKey: 'kogut', displayGroupColumn: 'Kogut' },
    { alias: 'legh', canonicalBreedKey: 'leghorn', displayGroupColumn: 'Leghorn' },
    { alias: 'leghorn', canonicalBreedKey: 'leghorn', displayGroupColumn: 'Leghorn' },
    { alias: 'sandy', canonicalBreedKey: 'sandy', displayGroupColumn: 'Sandy' },
    { alias: 'astra', canonicalBreedKey: 'astra', displayGroupColumn: 'Astra' },
    { alias: 'stara', canonicalBreedKey: 'stara', displayGroupColumn: 'Stara' },
  ];

  for (const aliasEntry of aliasSeed) {
    await prisma.breedAliasDictionary.upsert({
      where: { alias: aliasEntry.alias },
      update: { canonicalBreedKey: aliasEntry.canonicalBreedKey, displayGroupColumn: aliasEntry.displayGroupColumn, isActive: true },
      create: { ...aliasEntry, isActive: true },
    });
  }

  const alias = await prisma.breedAliasDictionary.findUniqueOrThrow({ where: { alias: 'rosa' } });

  const order = await prisma.order.create({
    data: {
      currentPlanningWeekId: planningWeek.id,
      externalRef: 'EXT-001',
      rawOrderText: '02-001 Warszawa ul. Kwiatowa 1 tel 600700800 10 rosa',
      postalCode: '02-001',
      addressLine: 'Warszawa, ul. Kwiatowa 1',
      phone: '600700800',
      status: OrderStatus.NEW,
      weekAssignments: { create: { planningWeekId: planningWeek.id, isCurrent: true, transferReason: 'Initial import' } },
      orderItems: { create: [{ canonicalBreedKey: 'rosa', sourceLabel: 'Rosa', units: 10, breedAliasId: alias.id }] },
    },
  });

  await prisma.rawImportedOrderRow.create({
    data: {
      importBatchId: importBatch.id,
      rowNumber: 2,
      rawCellsJson: { 'Zamówienia surowe': order.rawOrderText },
      rawOrderText: order.rawOrderText,
      parseStatus: RawImportRowStatus.OK,
      normalizedOrderId: order.id,
    },
  });

  const routePlan = await prisma.routePlan.create({
    data: {
      planningWeekId: planningWeek.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: RoutePlanStatus.AUTO_PLANNED,
      totalKm: 120,
      totalDurationMin: 240,
      totalFuelCost: 180,
      totalStops: 1,
      totalLoadUnits: 10,
      feasibilityStatus: RouteFeasibilityStatus.FEASIBLE,
      routeDays: {
        create: {
          dayIndex: 1,
          serviceDate: new Date('2026-03-23'),
          status: RoutePlanStatus.AUTO_PLANNED,
          km: 120,
          durationMin: 240,
          stopCount: 1,
          loadUnits: 10,
          stops: {
            create: {
              sequenceNo: 1,
              orderId: order.id,
              stopType: RouteStopType.DELIVERY,
              plannedUnits: 10,
              distanceFromPrevKm: 120,
              durationFromPrevMin: 240,
            },
          },
        },
      },
    },
    include: { routeDays: true },
  });

  await prisma.routeManualEditLog.create({
    data: {
      routePlanId: routePlan.id,
      routeDayId: routePlan.routeDays[0]?.id,
      actorUserId: admin.id,
      actionType: RouteManualEditAction.UPDATE_METRICS,
      reason: 'Seed baseline audit entry',
      beforeJson: { totalKm: 0 },
      afterJson: { totalKm: 120 },
    },
  });

  await prisma.externalRouteLink.create({
    data: {
      routePlanId: routePlan.id,
      provider: 'google-maps',
      externalRouteId: 'seed-route-1',
      routeUrl: 'https://maps.google.com/?q=seed-route-1',
    },
  });

  await prisma.fuelPriceSetting.upsert({
    where: { effectiveFrom_currency: { effectiveFrom: new Date('2026-03-23'), currency: 'PLN' } },
    update: { pricePerLiter: 6.45, source: FuelPriceSource.MANUAL, updatedById: admin.id },
    create: {
      effectiveFrom: new Date('2026-03-23'),
      pricePerLiter: 6.45,
      currency: 'PLN',
      source: FuelPriceSource.MANUAL,
      updatedById: admin.id,
    },
  });

  await prisma.systemSetting.upsert({
    where: { settingKey: 'optimizer.max_daily_km' },
    update: { settingValue: 400, valueType: 'number', updatedById: admin.id },
    create: {
      settingKey: 'optimizer.max_daily_km',
      settingValue: 400,
      valueType: 'number',
      description: 'Docelowa miękka granica km/dzień',
      updatedById: admin.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
