-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');
CREATE TYPE "PlanningWeekStatus" AS ENUM ('DRAFT', 'PLANNED', 'FROZEN', 'ARCHIVED');
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'PARSED', 'VALIDATED', 'FAILED');
CREATE TYPE "RawImportRowStatus" AS ENUM ('OK', 'WARNING', 'ERROR', 'CORRECTED', 'REJECTED');
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'OK', 'MOVED', 'PLANNED', 'UNPLANNED', 'CONFLICT', 'CANCELLED');
CREATE TYPE "RoutePlanStatus" AS ENUM ('DRAFT', 'AUTO_PLANNED', 'MANUAL_EDITED', 'APPROVED', 'CANCELLED');
CREATE TYPE "RouteFeasibilityStatus" AS ENUM ('FEASIBLE', 'WARNING', 'INFEASIBLE');
CREATE TYPE "RouteStopType" AS ENUM ('DELIVERY', 'BREAK', 'OVERNIGHT', 'DEPOT', 'TECHNICAL');
CREATE TYPE "RouteManualEditAction" AS ENUM ('MOVE_ORDER', 'RESEQUENCE_STOP', 'ADD_STOP', 'REMOVE_STOP', 'UPDATE_METRICS', 'REASSIGN_DRIVER');
CREATE TYPE "FuelPriceSource" AS ENUM ('MANUAL', 'API');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultVehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityUnits" INTEGER NOT NULL DEFAULT 1800,
    "fuelConsumptionLPer100Km" DECIMAL(8,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanningWeek" (
    "id" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrentVersion" BOOLEAN NOT NULL DEFAULT true,
    "status" "PlanningWeekStatus" NOT NULL DEFAULT 'DRAFT',
    "versionNotes" TEXT,
    "previousVersionId" TEXT,
    "createdById" TEXT,
    "frozenById" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanningWeek_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriverWeeklyAvailability" (
    "id" TEXT NOT NULL,
    "planningWeekId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "workDaysCount" INTEGER NOT NULL,
    "allowedWeekdays" INTEGER[],
    "unavailableReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriverWeeklyAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderImportBatch" (
    "id" TEXT NOT NULL,
    "planningWeekId" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "importedById" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "currentPlanningWeekId" TEXT NOT NULL,
    "externalRef" TEXT,
    "rawOrderText" TEXT NOT NULL,
    "postalCode" TEXT,
    "addressLine" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "orderedGoodsText" TEXT,
    "numberingText" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "geoLat" DECIMAL(10,7),
    "geoLng" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RawImportedOrderRow" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawCellsJson" JSONB NOT NULL,
    "rawOrderText" TEXT NOT NULL,
    "parseStatus" "RawImportRowStatus" NOT NULL DEFAULT 'OK',
    "parseErrorsJson" JSONB,
    "normalizedOrderId" TEXT,
    "correctedByUserId" TEXT,
    "correctionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RawImportedOrderRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderWeekAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "planningWeekId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "transferReason" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OrderWeekAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BreedAliasDictionary" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "canonicalBreedKey" TEXT NOT NULL,
    "displayGroupColumn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BreedAliasDictionary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderBreedQuantity" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "canonicalBreedKey" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "units" INTEGER NOT NULL,
    "breedAliasId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderBreedQuantity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutePlan" (
    "id" TEXT NOT NULL,
    "planningWeekId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "status" "RoutePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "totalKm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalDurationMin" INTEGER NOT NULL DEFAULT 0,
    "totalFuelCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalStops" INTEGER NOT NULL DEFAULT 0,
    "totalLoadUnits" INTEGER NOT NULL DEFAULT 0,
    "overnightCount" INTEGER NOT NULL DEFAULT 0,
    "feasibilityStatus" "RouteFeasibilityStatus" NOT NULL DEFAULT 'FEASIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoutePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteDay" (
    "id" TEXT NOT NULL,
    "routePlanId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "status" "RoutePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "km" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "durationMin" INTEGER NOT NULL DEFAULT 0,
    "stopCount" INTEGER NOT NULL DEFAULT 0,
    "loadUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RouteDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeDayId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "orderId" TEXT,
    "stopType" "RouteStopType" NOT NULL DEFAULT 'DELIVERY',
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "plannedUnits" INTEGER NOT NULL DEFAULT 0,
    "distanceFromPrevKm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "durationFromPrevMin" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteManualEditLog" (
    "id" TEXT NOT NULL,
    "routePlanId" TEXT NOT NULL,
    "routeDayId" TEXT,
    "routeStopId" TEXT,
    "actorUserId" TEXT,
    "actionType" "RouteManualEditAction" NOT NULL,
    "reason" TEXT,
    "beforeJson" JSONB NOT NULL,
    "afterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouteManualEditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalRouteLink" (
    "id" TEXT NOT NULL,
    "routePlanId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalRouteId" TEXT NOT NULL,
    "routeUrl" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalRouteLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FuelPriceSetting" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "pricePerLiter" DECIMAL(10,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "source" "FuelPriceSource" NOT NULL DEFAULT 'MANUAL',
    "updatedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FuelPriceSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "settingValue" JSONB NOT NULL,
    "valueType" TEXT NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OptimizationJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inputJson" JSONB,
    "resultJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OptimizationJob_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_key" ON "UserRoleAssignment"("userId", "roleId");
CREATE UNIQUE INDEX "Driver_code_key" ON "Driver"("code");
CREATE UNIQUE INDEX "Vehicle_code_key" ON "Vehicle"("code");
CREATE UNIQUE INDEX "PlanningWeek_weekStartDate_version_key" ON "PlanningWeek"("weekStartDate", "version");
CREATE INDEX "PlanningWeek_weekStartDate_isCurrentVersion_idx" ON "PlanningWeek"("weekStartDate", "isCurrentVersion");
CREATE UNIQUE INDEX "DriverWeeklyAvailability_planningWeekId_driverId_key" ON "DriverWeeklyAvailability"("planningWeekId", "driverId");
CREATE INDEX "OrderImportBatch_planningWeekId_importedAt_idx" ON "OrderImportBatch"("planningWeekId", "importedAt");
CREATE INDEX "Order_currentPlanningWeekId_status_idx" ON "Order"("currentPlanningWeekId", "status");
CREATE UNIQUE INDEX "RawImportedOrderRow_importBatchId_rowNumber_key" ON "RawImportedOrderRow"("importBatchId", "rowNumber");
CREATE INDEX "RawImportedOrderRow_normalizedOrderId_idx" ON "RawImportedOrderRow"("normalizedOrderId");
CREATE INDEX "OrderWeekAssignment_orderId_isCurrent_idx" ON "OrderWeekAssignment"("orderId", "isCurrent");
CREATE INDEX "OrderWeekAssignment_planningWeekId_isCurrent_idx" ON "OrderWeekAssignment"("planningWeekId", "isCurrent");
CREATE UNIQUE INDEX "BreedAliasDictionary_alias_key" ON "BreedAliasDictionary"("alias");
CREATE INDEX "OrderBreedQuantity_orderId_idx" ON "OrderBreedQuantity"("orderId");
CREATE INDEX "OrderBreedQuantity_canonicalBreedKey_idx" ON "OrderBreedQuantity"("canonicalBreedKey");
CREATE UNIQUE INDEX "RoutePlan_planningWeekId_driverId_key" ON "RoutePlan"("planningWeekId", "driverId");
CREATE UNIQUE INDEX "RouteDay_routePlanId_dayIndex_key" ON "RouteDay"("routePlanId", "dayIndex");
CREATE UNIQUE INDEX "RouteDay_routePlanId_serviceDate_key" ON "RouteDay"("routePlanId", "serviceDate");
CREATE UNIQUE INDEX "RouteStop_routeDayId_sequenceNo_key" ON "RouteStop"("routeDayId", "sequenceNo");
CREATE UNIQUE INDEX "ExternalRouteLink_provider_externalRouteId_key" ON "ExternalRouteLink"("provider", "externalRouteId");
CREATE UNIQUE INDEX "FuelPriceSetting_effectiveFrom_currency_key" ON "FuelPriceSetting"("effectiveFrom", "currency");
CREATE UNIQUE INDEX "SystemSetting_settingKey_key" ON "SystemSetting"("settingKey");

-- Foreign keys
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_defaultVehicleId_fkey" FOREIGN KEY ("defaultVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanningWeek" ADD CONSTRAINT "PlanningWeek_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "PlanningWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanningWeek" ADD CONSTRAINT "PlanningWeek_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanningWeek" ADD CONSTRAINT "PlanningWeek_frozenById_fkey" FOREIGN KEY ("frozenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverWeeklyAvailability" ADD CONSTRAINT "DriverWeeklyAvailability_planningWeekId_fkey" FOREIGN KEY ("planningWeekId") REFERENCES "PlanningWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverWeeklyAvailability" ADD CONSTRAINT "DriverWeeklyAvailability_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderImportBatch" ADD CONSTRAINT "OrderImportBatch_planningWeekId_fkey" FOREIGN KEY ("planningWeekId") REFERENCES "PlanningWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderImportBatch" ADD CONSTRAINT "OrderImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_currentPlanningWeekId_fkey" FOREIGN KEY ("currentPlanningWeekId") REFERENCES "PlanningWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RawImportedOrderRow" ADD CONSTRAINT "RawImportedOrderRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "OrderImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RawImportedOrderRow" ADD CONSTRAINT "RawImportedOrderRow_normalizedOrderId_fkey" FOREIGN KEY ("normalizedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderWeekAssignment" ADD CONSTRAINT "OrderWeekAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderWeekAssignment" ADD CONSTRAINT "OrderWeekAssignment_planningWeekId_fkey" FOREIGN KEY ("planningWeekId") REFERENCES "PlanningWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderBreedQuantity" ADD CONSTRAINT "OrderBreedQuantity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderBreedQuantity" ADD CONSTRAINT "OrderBreedQuantity_breedAliasId_fkey" FOREIGN KEY ("breedAliasId") REFERENCES "BreedAliasDictionary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_planningWeekId_fkey" FOREIGN KEY ("planningWeekId") REFERENCES "PlanningWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteDay" ADD CONSTRAINT "RouteDay_routePlanId_fkey" FOREIGN KEY ("routePlanId") REFERENCES "RoutePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeDayId_fkey" FOREIGN KEY ("routeDayId") REFERENCES "RouteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteManualEditLog" ADD CONSTRAINT "RouteManualEditLog_routePlanId_fkey" FOREIGN KEY ("routePlanId") REFERENCES "RoutePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteManualEditLog" ADD CONSTRAINT "RouteManualEditLog_routeDayId_fkey" FOREIGN KEY ("routeDayId") REFERENCES "RouteDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteManualEditLog" ADD CONSTRAINT "RouteManualEditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalRouteLink" ADD CONSTRAINT "ExternalRouteLink_routePlanId_fkey" FOREIGN KEY ("routePlanId") REFERENCES "RoutePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelPriceSetting" ADD CONSTRAINT "FuelPriceSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OptimizationJob" ADD CONSTRAINT "OptimizationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
