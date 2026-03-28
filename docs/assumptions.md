# Trasa — Założenia projektowe (na start)

1. Tydzień planistyczny jest identyfikowany przez datę poniedziałku w strefie lokalnej firmy.
2. Jeden `Order` należy do dokładnie jednego `PlanningWeek`.
3. Brak geokodu nie blokuje importu, ale blokuje pełną optymalizację (konflikt `geocode_missing`).
4. Domyślny limit pojemności pojazdu to `vehicle_capacity_units = 1800`, konfigurowalny globalnie i per pojazd.
5. Jeżeli wiersz Excela ma zarówno `Zamówienia surowe`, jak i osobne kolumny (Adres/Telefon), parser traktuje `Zamówienia surowe` jako źródło główne, a kolumny osobne jako nadpisanie po walidacji.
6. Unikanie dróg płatnych realizujemy przez provider routingu, który obsługuje flagę `avoid_tolls`.
7. „Ekonomiczność paliwowa” modelujemy jako funkcję celu opartą na km oraz czasie przejazdu z wagami konfigurowalnymi.
8. Role systemowe na start: `admin`, `manager`, `viewer`; granularne permissiony można rozszerzyć później.
9. Po statusie `frozen` plan tygodnia jest niemodyfikowalny biznesowo (dopuszczalne tylko eksporty/odczyt).
10. Dane historyczne tygodni są przechowywane bez nadpisywania (immutable snapshots przez status i audyt zmian).
