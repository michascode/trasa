# Instrukcja wdrożenia (backend + frontend)

## 1. Wymagania produkcyjne
- Docker / Kubernetes runtime.
- PostgreSQL 15+ z backupem i monitoringiem.
- Sekrety: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.

## 2. Build artefaktów
```bash
npm ci
npm run build --workspaces
```

## 3. Migracje i seed środowiska demo
```bash
npm run db:migrate --workspace @trasa/backend
npm run db:seed --workspace @trasa/backend
```

## 4. Start usług
- Backend: `node dist/server.js` (workspace `@trasa/backend`).
- Frontend: `npm run preview --workspace @trasa/frontend` lub serwowanie `dist/` przez Nginx.

## 5. Smoke test po wdrożeniu
```bash
curl -sSf http://<backend-host>/api/health
curl -sSf http://<backend-host>/api/audit/events?limit=5
```

## 6. Rollback
1. Wstrzymaj ruch (maintenance).
2. Przywróć poprzedni obraz backend/frontend.
3. Przywróć backup DB jeśli migracja była destrukcyjna.
4. Wykonaj ponownie smoke test.
