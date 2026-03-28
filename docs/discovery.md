# Trasa — Discovery (analiza problemu)

## 1. Kontekst biznesowy
Trasa ma być centralnym systemem do:
- importu zamówień z istniejącego arkusza Excel bez zmiany stylu pracy kierownika,
- planowania tygodniowego tras kierowców,
- automatycznej optymalizacji tras z ograniczeniami operacyjnymi,
- ręcznej korekty planu przez dispatchera/kierownika,
- eksportu wyników z powrotem do formatu zgodnego z obecnym procesem.

## 2. Najważniejsze cele biznesowe
1. Zwiększenie jakości planu tras (koszt + wykonalność).
2. Zachowanie kompatybilności z obecnym procesem Excel.
3. Skrócenie czasu planowania tygodnia.
4. Pełna audytowalność ręcznych zmian.
5. Zachowanie historii tygodni i możliwości przenoszenia wybranych zamówień.

## 3. Kluczowe procesy end-to-end
1. **Import tygodnia**
   - Manager tworzy tydzień planistyczny (od poniedziałku).
   - Importuje plik Excel.
   - System waliduje, parsuje i zapisuje surowe oraz znormalizowane dane.
   - Manager poprawia rekordy z błędami parsowania.

2. **Planowanie automatyczne**
   - System agreguje wolumen i ograniczenia kierowców/pojazdów.
   - Silnik optymalizacji generuje przydział zamówień do kierowców i dni.
   - System oznacza konflikty (pojemność, dni pracy, nadmierne km itp.).

3. **Ręczna dyspozycja**
   - Manager przenosi zamówienia między kierowcami/dniami.
   - Zmienia kolejność stopów, dodaje/usuwa punkty.
   - System przelicza metryki i flaguje konflikty.
   - Każda zmiana trafia do audytu.

4. **Publikacja i eksport**
   - Manager zamraża tydzień (snapshot historyczny).
   - Eksportuje tydzień do Excel zgodnego z dotychczasowym stylem.
   - Opcjonalnie generuje eksport tras kierowców i podsumowania ilościowe.

## 4. Wymagania jakościowe i operacyjne
- Modułowość i testowalność (backend, parser, optimization engine).
- Uruchomienie lokalne przez Docker Compose.
- Role: admin, manager, viewer.
- Audit log zmian manualnych.
- Provider abstraction dla geokodowania/routingu (możliwość podmiany dostawcy).

## 5. Proponowana architektura (high-level)
- **Monorepo** z aplikacjami i pakietami współdzielonymi.
- **Frontend**: Next.js + TypeScript.
- **Backend API**: Node.js + TypeScript (REST + async jobs).
- **DB**: PostgreSQL.
- **Routing/Geocoding adapter**: warstwa providerów (np. OSRM/GraphHopper/Nominatim).
- **Silnik optymalizacji**: Python + OR-Tools (osobny serwis, asynchroniczny).
- **Kolejka zadań**: Redis + BullMQ (planowanie, geokodowanie wsadowe, eksporty).
- **Mapy**: Leaflet + OpenStreetMap.

## 6. Dlaczego ta architektura
- OR-Tools najlepiej pasuje do VRP z wieloma ograniczeniami.
- Node/TS przyspiesza development API i spójność kontraktów z frontem.
- Oddzielny optimization service pozwala skalować obliczenia niezależnie.
- Provider abstraction ogranicza vendor lock-in.

## 7. Zakres etapu 0 (obecny)
- Dokumentacja analityczna i architektoniczna.
- Definicja domeny i kontraktów importu.
- Ustalenie roadmapy iteracyjnej.
- Brak pełnej implementacji UI w tym etapie.

## 8. Plan wdrożenia etapami
1. **Etap 0 — Discovery & ADR**
   - Dokumenty analityczne, model domeny, założenia, ADR.

2. **Etap 1 — Fundamenty monorepo i infra lokalna**
   - Struktura workspace, Docker Compose (Postgres, Redis, API, web, optimizer).
   - Podstawowe auth + role.

3. **Etap 2 — Orders + Excel import + parser**
   - CRUD zamówień.
   - Import batchowy, historia importów, raport walidacji.
   - Parser regex + alias dictionary + ręczne poprawki.

4. **Etap 3 — Drivers + Weekly planning core**
   - CRUD kierowców/pojazdów.
   - Dostępność tygodniowa, dni pracy, tworzenie i freeze tygodnia.

5. **Etap 4 — Optimization engine (MVP)**
   - Integracja API ↔ Python OR-Tools.
   - Hard constraints: capacity, dni pracy, avoid tolls.
   - Soft constraints: km/stopy dziennie.

6. **Etap 5 — Manual dispatch editing + audit**
   - Interfejs planowania (drag & drop).
   - Rekalkulacja metryk i konflikty po zmianach.
   - Pełny audit log akcji.

7. **Etap 6 — Maps + export/reporting**
   - Wizualizacja tygodnia na mapie.
   - Eksport do Excel kompatybilny z obecnym stylem.
   - Eksport tras kierowców i podsumowań.

8. **Etap 7 — Hardening produkcyjny**
   - Testy integracyjne end-to-end.
   - Monitoring, backup, retry policy, performance tuning.

## 9. Ryzyka i miejsca niejednoznaczne
- Duża zmienność jakości danych wejściowych w `Zamówienia surowe`.
- Możliwe niejednoznaczności aliasów handlowych towarów.
- Jakość geokodowania adresów wiejskich/niekompletnych.
- Różnice między „optymalnym matematycznie” planem a preferencjami operacyjnymi kierowników.
- Wydajność routingu i macierzy odległości przy większej skali tygodnia.
- Definicja dokładnego kosztu paliwa może wymagać dodatkowych danych (pojazd, spalanie, cena paliwa).

## 10. Proponowana struktura repozytorium (docelowa)
```text
trasa/
  apps/
    web/                  # Next.js frontend
    api/                  # Node.js API
    optimizer/            # Python OR-Tools service
  packages/
    shared-types/         # wspólne typy i DTO
    config/               # centralna konfiguracja i env schema
    parser/               # parser raw orders (TS)
    routing-adapters/     # provider abstraction (TS)
    eslint-config/
    tsconfig/
  infra/
    docker/
    compose/
  docs/
    adr/
    discovery.md
    domain-model.md
    import-spec.md
    route-planning-spec.md
    assumptions.md
  samples/
    excel/
  scripts/
    seed/
```
