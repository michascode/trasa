# Checklista produkcyjna

## Bezpieczeństwo
- [ ] Wymuszony silny `JWT_SECRET` (minimum 32 znaki).
- [ ] CORS ograniczony do domen produkcyjnych.
- [ ] Konta seed (`admin/manager/viewer`) z resetem hasła przy pierwszym logowaniu.
- [ ] Backup bazy i retencja min. 14 dni.

## Niezawodność
- [ ] Monitoring `/api/health`.
- [ ] Alerty na błędy 5xx.
- [ ] Logi aplikacyjne i audit trail centralizowane.
- [ ] Procedura rollback i test odtworzeniowy.

## Jakość
- [ ] `npm run test --workspace @trasa/backend` zielone na CI.
- [ ] Test smoke po wdrożeniu.
- [ ] Wersjonowanie migracji Prisma.

## Operacje
- [ ] Runbook incydentowy.
- [ ] Właściciele on-call.
- [ ] Harmonogram przeglądu uprawnień RBAC.
