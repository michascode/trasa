# Trasa — Specyfikacja planowania tras (wersja startowa)

## 1. Problem optymalizacyjny
VRP z ograniczeniami (capacity, liczba dni pracy, unikanie toll roads) i celami miękkimi (km/dzień, stopów/dzień).

## 2. Twarde ograniczenia
1. Planowanie w obrębie jednego `PlanningWeek`.
2. `vehicle_capacity_units` (domyślnie 1800) nieprzekraczalne.
3. Kierowca nie może mieć więcej dni trasy niż `work_days_count`.
4. Routing z opcją `avoid_tolls = true`.

## 3. Miękkie ograniczenia i cele
- ~15–20 stopów dziennie.
- ~400 km dziennie.
- Minimalizacja kosztu paliwa i kilometrów.
- Uwzględnienie czasu przejazdu (weighted objective).

## 4. Funkcja celu (propozycja)
Minimalizuj:
- `sum(km * fuel_cost_factor)`
- `+ sum(duration_min * time_cost_factor)`
- `+ penalties_soft_constraints`

Gdzie `penalties_soft_constraints` obejmuje przekroczenia celów miękkich (km/stopy).

## 5. Wejście do silnika
- Zamówienia z geolokalizacją i wolumenem.
- Kierowcy + dostępność tygodniowa.
- Parametry pojazdów.
- Macierze odległości/czasu z provider routing.
- Konfiguracja wag celu i limitów.

## 6. Wyjście silnika
- Przydział zamówień do kierowcy i dnia.
- Kolejność stopów per dzień.
- Metryki trasy: km, min, stop_count, load.
- Flagowanie konfliktów / niewykonalności.

## 7. Obsługa tras wielodniowych
- Silnik może przypisać kolejne segmenty tej samej trasy do różnych dni.
- Punkty `overnight` jako techniczne stop points.
- Kontynuacja kolejności następnego dnia.

## 8. Manual override
Po auto-planie dispatcher może:
- przenieść order między kierowcami/dniami,
- zmienić sekwencję stopów,
- dodać/usunąć stop.

Po każdej zmianie system liczy delta metryk i tworzy konflikty, jeśli naruszono ograniczenia.

## 9. Strategia obliczeń
- Async job: `GenerateWeeklyPlanJob`.
- Timeout + fallback do planu częściowego.
- Możliwość ponownego przeliczenia wybranego kierowcy/dnia.

## 10. Testy
- jednostkowe funkcji kosztu,
- scenariusze integracyjne (małe i średnie instancje VRP),
- testy regresyjne danych historycznych.
