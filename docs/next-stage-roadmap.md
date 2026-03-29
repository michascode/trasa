# Kolejny etap rozwoju

1. **Trwały audit trail w DB** zamiast pamięci procesu.
2. **Realny silnik planowania tras** (constraint solver / OR-Tools + ETA z map provider).
3. **Obsługa importu XLSX biblioteką parsera** (bez zależności od `unzip`).
4. **Observability stack**: OpenTelemetry + trace ID end-to-end.
5. **UI dla pustych stanów i błędów** z pełnym flow retry/recover.
6. **E2E browser tests** (Playwright) z pokryciem krytycznych ekranów.
7. **Hardening auth**: refresh tokeny, rotacja, blokada brute-force.
