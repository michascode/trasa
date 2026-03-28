# Trasa — foundation monorepo

To repozytorium zawiera fundament projektu Trasa (frontend + backend + baza + Docker).
Na tym etapie optimizer tras jest tylko stubem interfejsowym/serwisowym.

## 1) Struktura monorepo

- `apps/backend` — API (Express + Prisma + auth JWT + RBAC)
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

## 4) Uruchomienie lokalne (bez Docker)

```bash
npm install
npm run db:migrate:dev --workspace @trasa/backend
npm run db:seed --workspace @trasa/backend
npm run dev:backend
npm run dev:frontend
```

Backend: `http://localhost:4000`
Frontend: `http://localhost:5173`

## 5) Uruchomienie przez Docker Compose

```bash
docker compose up --build
```

Usługi:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`
- Healthcheck: `http://localhost:4000/api/health`

## 6) Migracje i seed

Migracje znajdują się w `apps/backend/prisma/migrations`.

Polecenia:

```bash
npm run db:migrate --workspace @trasa/backend
npm run db:seed --workspace @trasa/backend
```

Seed tworzy użytkowników testowych (hasło: `ChangeMe123!`):

- `admin@trasa.local` (ADMIN)
- `manager@trasa.local` (MANAGER)
- `viewer@trasa.local` (VIEWER)

## 7) Auth + role

Założenia:

- JWT bearer token
- Role: `ADMIN`, `MANAGER`, `VIEWER`
- Endpointy:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`

Endpoint stubu optimizera:

- `POST /api/optimizer/run` (tylko ADMIN/MANAGER, obecnie zwraca `501 STUB`)

## 8) Testy uruchomieniowe

Backend:

```bash
npm run test --workspace @trasa/backend
```

Frontend:

```bash
npm run test --workspace @trasa/frontend
```

## 9) Co jest stubem na tym etapie

- Silnik optymalizacji tras (`optimizer.service.ts`) — tylko odpowiedź placeholder.
- Brak pełnego workflow zadań optymalizacji i harmonogramowania.
- Brak zaawansowanego UI modułów domenowych.
