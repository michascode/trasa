# Trasa — Model domenowy (wersja startowa)

## 1. Bounded contexts
1. **Identity & Access** — użytkownicy, role, autoryzacja.
2. **Orders Import & Parsing** — import Excel, parser, walidacja, korekty.
3. **Planning** — tydzień planistyczny, przydziały, konflikty.
4. **Routing & Optimization** — koszt, dystans, czas, ograniczenia.
5. **Dispatch Editing** — ręczne zmiany i audyt.
6. **Export & Reporting** — eksport zgodny z Excela i raporty.

## 2. Główne encje

## User
- id
- email
- password_hash
- role: `admin | manager | viewer`
- is_active
- created_at, updated_at

## Driver
- id
- code
- name
- default_vehicle_id (nullable)
- active
- created_at, updated_at

## Vehicle
- id
- code
- name
- capacity_units (default z konfiguracji, np. 1800)
- fuel_consumption_l_per_100km (opcjonalnie)
- active

## PlanningWeek
- id
- week_start_date (poniedziałek)
- status: `draft | planned | frozen`
- created_by
- created_at, frozen_at

## DriverAvailability
- id
- planning_week_id
- driver_id
- work_days_count
- allowed_weekdays (np. `[1,2,3,4,5]`)

## ImportBatch
- id
- planning_week_id
- source_filename
- source_hash
- imported_by
- imported_at
- total_rows
- success_rows
- error_rows
- status: `uploaded | parsed | validated | failed`

## ImportedRow
- id
- import_batch_id
- row_number
- raw_cells_json
- raw_order_text
- parse_status: `ok | warning | error | corrected`
- parse_errors_json
- normalized_order_id (nullable)

## Order
- id
- planning_week_id
- external_ref (nullable)
- raw_order_text
- postal_code
- address_line
- phone
- notes
- ordered_goods_text
- numbering_text
- status: `new | ok | moved | planned | unplanned | conflict`
- geo_point (nullable)
- created_at, updated_at

## OrderItem
- id
- order_id
- product_key (canonical, np. `rosa`)
- product_label (oryginalna nazwa)
- units

## ProductAlias
- id
- alias
- canonical_product_key
- display_group_column (np. `Rosa`, `Leghorn`)
- active

## RoutePlan
- id
- planning_week_id
- driver_id
- total_km
- total_duration_min
- total_fuel_cost
- overnight_count
- feasibility_status: `feasible | warning | infeasible`

## RouteDay
- id
- route_plan_id
- service_date
- day_index
- km
- duration_min
- stop_count
- load_units

## RouteStop
- id
- route_day_id
- sequence_no
- order_id (nullable dla stopów technicznych)
- stop_type: `delivery | break | overnight | depot`
- arrival_time (nullable)
- departure_time (nullable)
- planned_units

## PlanningConflict
- id
- planning_week_id
- conflict_type: `capacity | day_limit | distance_soft | stops_soft | geocode_missing | routing_error`
- severity: `info | warning | critical`
- entity_type
- entity_id
- description
- resolved

## AuditLog
- id
- planning_week_id
- actor_user_id
- action_type
- entity_type
- entity_id
- before_json
- after_json
- created_at

## ExportJob
- id
- planning_week_id
- export_type: `weekly_excel | driver_routes | quantity_summary`
- status: `queued | running | done | failed`
- file_path
- created_by
- created_at

## 3. Relacje krytyczne
- `PlanningWeek` 1..* `Order`
- `PlanningWeek` 1..* `DriverAvailability`
- `Driver` 1..* `RoutePlan` (per week max 1)
- `RoutePlan` 1..* `RouteDay`
- `RouteDay` 1..* `RouteStop`
- `Order` 1..* `OrderItem`
- `ImportBatch` 1..* `ImportedRow`
- `ImportedRow` 0..1 `Order`

## 4. Inwarianty domenowe
1. `PlanningWeek.week_start_date` musi być poniedziałkiem.
2. `Vehicle.capacity_units <= configured_max_capacity` lub równe polityce firmy.
3. Sumaryczne `planned_units` na `RouteDay` nie mogą przekroczyć capacity pojazdu.
4. Liczba aktywnych dni `RouteDay` kierowcy ≤ `work_days_count`.
5. Po `PlanningWeek.status = frozen` brak edycji planu (tylko odczyt/eksport).
6. Każda ręczna modyfikacja tras zapisuje wpis `AuditLog`.
