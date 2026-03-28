# Trasa — ERD (model domenowy)

```mermaid
erDiagram
  User ||--o{ UserRoleAssignment : has
  Role ||--o{ UserRoleAssignment : grants

  Vehicle ||--o{ Driver : default_for
  PlanningWeek ||--o{ DriverWeeklyAvailability : defines
  Driver ||--o{ DriverWeeklyAvailability : available

  PlanningWeek ||--o{ OrderImportBatch : imports
  OrderImportBatch ||--o{ RawImportedOrderRow : contains
  RawImportedOrderRow }o--|| Order : normalized_to

  PlanningWeek ||--o{ Order : current_orders
  Order ||--o{ OrderWeekAssignment : history
  PlanningWeek ||--o{ OrderWeekAssignment : assignment_bucket

  BreedAliasDictionary ||--o{ OrderBreedQuantity : maps
  Order ||--o{ OrderBreedQuantity : has

  PlanningWeek ||--o{ RoutePlan : has
  Driver ||--o{ RoutePlan : assigned
  Vehicle ||--o{ RoutePlan : optional

  RoutePlan ||--o{ RouteDay : consists_of
  RouteDay ||--o{ RouteStop : contains
  Order ||--o{ RouteStop : delivered_at

  RoutePlan ||--o{ RouteManualEditLog : audited_by
  User ||--o{ RouteManualEditLog : edited_by

  RoutePlan ||--o{ ExternalRouteLink : exported
  User ||--o{ FuelPriceSetting : updates
  User ||--o{ SystemSetting : updates
```

## Najważniejsze relacje

1. `PlanningWeek` jest wersjonowany przez parę (`weekStartDate`, `version`) oraz referencję `previousVersionId`.
2. `Order` ma dwie reprezentacje: surową (`RawImportedOrderRow`) i znormalizowaną (`Order` + `OrderBreedQuantity`).
3. Przenoszenie zamówień między tygodniami jest zapisywane historycznie w `OrderWeekAssignment` (`isCurrent`, `assignedAt`, `unassignedAt`).
4. `RoutePlan` jest unikalny dla pary (`planningWeekId`, `driverId`) i posiada metryki (`totalKm`, `totalDurationMin`, `totalFuelCost`, itd.).
5. `RouteDay` i `RouteStop` modelują dzień i kolejność realizacji (`dayIndex`, `sequenceNo`) z metrykami dziennymi i odcinkowymi.
6. Każda ręczna zmiana trasy trafia do `RouteManualEditLog` z `beforeJson` i `afterJson`.
7. `ExternalRouteLink` przechowuje identyfikatory/URL tras z systemów zewnętrznych.
8. `FuelPriceSetting` i `SystemSetting` zapewniają konfigurację kosztów i parametrów systemowych z informacją, kto zmienił wartość.
