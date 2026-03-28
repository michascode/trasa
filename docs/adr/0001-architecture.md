# ADR 0001: Wybór architektury systemu Trasa

- Status: Accepted
- Data: 2026-03-28

## Kontekst
System musi obsłużyć import Excel w legacy formacie, planowanie tygodniowe i optymalizację VRP z wieloma ograniczeniami oraz manualną dyspozycję.

## Decyzja
Przyjmujemy architekturę:
- monorepo,
- frontend: Next.js + TypeScript,
- backend API: Node.js + TypeScript,
- baza danych: PostgreSQL,
- cache/kolejka: Redis + BullMQ,
- optimization service: Python + OR-Tools,
- mapy: Leaflet + OpenStreetMap,
- routing/geocoding: provider abstraction.

## Uzasadnienie
1. **OR-Tools**: dojrzałe narzędzie dla VRP i constraints.
2. **Node + TS**: szybki rozwój API i dobry DX przy integracji z frontem TS.
3. **Monorepo**: łatwe współdzielenie typów i kontraktów.
4. **Provider abstraction**: elastyczność wyboru geocoding/routing bez przepisywania logiki.

## Konsekwencje
### Plusy
- Skalowalny model obliczeń (oddzielny optimization worker).
- Czytelny podział odpowiedzialności.
- Lepsza testowalność parsera i planowania.

### Minusy
- Większa złożoność operacyjna (Node + Python + Redis + Postgres).
- Potrzeba stabilnych kontraktów między API i optimization service.

## Alternatywy rozważone
1. **Całość w Node.js** (bez Pythona): łatwiejsze utrzymanie stacku, słabsze wsparcie zaawansowanych VRP.
2. **Django + React**: silne zaplecze administracyjne, mniejsza spójność z wymaganym stackiem i monorepo TS.

## Plan migracji / wdrożenia
- Etapowo: najpierw import i model danych, potem planowanie, następnie manual dispatch i raporty.
