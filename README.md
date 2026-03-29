# Trasa — foundation monorepo

To repozytorium zawiera fundament projektu Trasa (frontend + backend + baza + Docker).
Na tym etapie optimizer tras jest rozszerzonym demo-silnikiem do walidacji workflow i edge-case'ów.

## 1) Struktura monorepo

- `apps/backend` — API (Express + Prisma + auth JWT + RBAC + audit trail)
- `apps/frontend` — UI (React + Vite)
- `packages/shared` — współdzielone typy/interfejsy
- `docker-compose.yml` — lokalne środowisko (Postgres + backend + frontend)

## 2) Wymagania

- Node.js 22+
- npm 10+
- Docker + Docker Compose (opcjonalnie)

## 3) Konfiguracja ENV

Skopiuj przykładowe pliki:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Kluczowe zmienne backendu:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `CORS_ORIGIN`

## 4) Dokładna instrukcja uruchomienia lokalnego

Najpierw utwórz pliki `.env` (to kluczowe dla Prisma):

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

```bash
npm install
npm run db:migrate:dev --workspace @trasa/backend
npm run db:seed --workspace @trasa/backend
npm run dev:backend
npm run dev:frontend
```

Backend: `http://localhost:4000`  
Frontend: `http://localhost:5173`

Szybki smoke test:

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/audit/events?limit=5
```

### Troubleshooting (Windows / brak DATABASE_URL)

- Jeśli zobaczysz `Environment variable not found: DATABASE_URL`, sprawdź czy istnieje `apps/backend/.env`.
- Komendy Prisma mają teraz fallback na lokalny DB URL (`postgresql://postgres:postgres@localhost:5432/trasa?schema=public`) i wyświetlą ostrzeżenie, gdy `DATABASE_URL` nie jest ustawione.
- `db:seed` uruchamia automatycznie `db:generate`, żeby uniknąć błędów typu `@prisma/client does not provide an export named ...`.

## 5) Uruchomienie przez Docker Compose

```bash
docker compose up --build
```

Usługi:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`
- Healthcheck: `http://localhost:4000/api/health`

## 6) Konta demonstracyjne i seed

Polecenia:

```bash
npm run db:migrate --workspace @trasa/backend
npm run db:seed --workspace @trasa/backend
```

Seed tworzy konta (hasło: `ChangeMe123!`):

- `admin@trasa.local` (ADMIN)
- `manager@trasa.local` (MANAGER)
- `viewer@trasa.local` (VIEWER)

Dodatkowo seed zawiera: plan tygodnia, aliasy ras, import batch i przykładową trasę.

## 7) Testy (unit / integration / e2e)

Backend:

```bash
npm run test:unit --workspace @trasa/backend
npm run test:integration --workspace @trasa/backend
npm run test:e2e --workspace @trasa/backend
```

Lub pełny zestaw:

```bash
npm run test --workspace @trasa/backend
```

## 8) Obsługa błędów, pustych stanów, logging i audit

- Ujednolicone błędy API (`VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`).
- Puste stany: brak endpointu, brak danych, brak rekordów dla zapytań limitowanych.
- Logging requestów z `x-request-id` i czasem odpowiedzi.
- Audit trail dostępny pod `GET /api/audit/events`.

## 9) Instrukcja wdrożenia i checklista produkcyjna

- Instrukcja wdrożenia: `docs/deployment.md`
- Checklista produkcyjna: `docs/production-checklist.md`
- Plan kolejnego etapu: `docs/next-stage-roadmap.md`

---

## 10) Finalne podsumowanie architektury

- **Warstwa API**: Express z modułami `auth`, `import`, `planning`, `optimizer`, `audit`.
- **Warstwa domenowa**: parser importu + planowanie tygodnia + ręczne edycje tras.
- **Warstwa danych**: Prisma + PostgreSQL z modelami dla importu, planu, tras i logów.
- **Warstwa operacyjna**: middleware request logger + globalny error handler + audit trail.

## 11) Lista funkcji gotowych

- JWT auth + role `ADMIN/MANAGER/VIEWER`.
- Import zamówień z walidacją parsera i edge-case'ów.
- Planowanie tygodnia: przypisania, statusy, transfery, ręczne edycje.
- Eksporty CSV dla operacji planowania.
- Testy unit/integration/e2e najważniejszych ścieżek.
- Seed demonstracyjny z kontami i danymi startowymi.

## 12) Znane ograniczenia

- Audit trail jest in-memory (brak trwałości po restarcie procesu).
- Import XLSX oparty o `unzip` (zależność systemowa).
- Brak twardego egzekwowania RBAC na wszystkich endpointach domenowych.
- Optymalizator jest trybem demo, nie produkcyjnym solverem.

## 13) Propozycja planu wdrożenia na produkcję

1. **Etap 1 (staging)**: build + migracje + seed demo + smoke test.
2. **Etap 2 (hardening)**: centralny logging, trwały audit trail, backup policy.
3. **Etap 3 (go-live)**: rolling deployment backend/frontend, monitoring 5xx i SLA.
4. **Etap 4 (stabilizacja)**: analiza incydentów, tuning limitów planera i importu.
