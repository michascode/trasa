# Trasa — Specyfikacja importu Excel (wersja startowa)

## 1. Cel
Zapewnić import danych z istniejącego arkusza bez zmiany stylu pracy kierownika.

## 2. Oczekiwane kolumny wejściowe
- Kierowca
- Nr Przystanku
- Zamówienia surowe
- Status
- Adres
- Telefon
- Rosa
- Leghorn
- Sandy
- Astra
- Stara
- Kogut
- UWAGI
- ZAMOWIONE TOWARY
- do numerowania

System ma akceptować drobne różnice wielkości liter/spacji poprzez mapowanie nagłówków.

## 3. Pipeline importu
1. Upload pliku `.xlsx`.
2. Walidacja schematu i nagłówków.
3. Zapis surowego wiersza (`raw_cells_json`) i `raw_order_text`.
4. Parsowanie `Zamówienia surowe` do struktury.
5. Enrichment z kolumn pomocniczych (Adres, Telefon, UWAGI, itp.).
6. Walidacja biznesowa (np. poprawność kodu, telefonu, ilości > 0).
7. Zapis `Order` + `OrderItem`.
8. Raport błędów/ostrzeżeń.

## 4. Parser `raw_order_text`
Parser oparty o:
- słownik regex patternów,
- słownik aliasów produktów,
- konfigurację priorytetów reguł.

## 4.1 Pola parsowane
- `postal_code` (regex np. `\b\d{2}-\d{3}\b`)
- `phone` (ciąg cyfr 9 lub z prefiksem kraju)
- `address_line` (pozostały tekst adresowy)
- `items[]` (np. `9/39 rosa 1 kog`)
- `notes` (np. część po myślniku)
- `ordered_goods_text`
- `numbering_text`

## 4.2 Aliasowanie produktów
Przykład:
- alias: `kog`, `kogut`, `kgt` -> canonical `kogut`
- alias: `rosa`, `r` -> canonical `rosa`

Aliasy przechowywane w tabeli `product_aliases`, edytowalne przez admina.

## 5. Statusy importu i rekordów
- batch: `uploaded | parsed | validated | failed`
- row: `ok | warning | error | corrected`

## 6. Korekty ręczne
Manager może:
- poprawić pola parsowania,
- zatwierdzić rekord z warningiem,
- wymusić mapowanie aliasu,
- oznaczyć rekord jako odrzucony.

Wszystkie korekty są audytowane.

## 7. Eksport kompatybilny z Excelem
Eksport tygodnia odtwarza kolumny i styl pracy:
- zachowuje `raw_order_text`,
- uzupełnia kolumny ilościowe i tekstowe,
- utrzymuje numerację i kolejność stopów.

## 8. Testy (minimum)
- jednostkowe parsera regex + aliasy,
- integracyjne importu z przykładowym plikiem,
- regresyjne dla znanych trudnych formatów wpisów.
