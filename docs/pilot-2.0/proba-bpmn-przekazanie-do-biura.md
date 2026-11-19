# Próba BPMN przekazania danych do biura rachunkowego

Próba wykorzystuje [fikcyjną transkrypcję](02-dane-do-biura.md). Porównaj mapę AS-IS i mapę TO-BE oraz sprawdź, które informacje można odczytać bez rozmowy z prowadzącą.

| Co sprawdzić | Gdzie szukać |
| --- | --- |
| Kto ma termin do piątego dnia miesiąca? | Szczegóły kroku dotyczącego przekazania danych przez menedżera do HR. Data wysyłki do biura wymaga ustalenia. |
| Co dzieje się, gdy są braki? | Po kontroli HR ścieżka wraca do właściwego menedżera. Uzupełnienie ponownie trafia przez zestawienie do kontroli. |
| Kiedy proces jest zakończony? | HR przekazuje komplet do biura. W osobnym basenie biuro potwierdza odbiór. Wiadomość z potwierdzeniem trafia do ostatniego kroku HR. |
| Co zmienia propozycja TO-BE? | Oddziela wysyłkę od oczekiwania na potwierdzenie. Proponowane typy zadań BPMN pomagają zobaczyć oba momenty na mapie. |
| Co wymaga decyzji przed wdrożeniem? | Eskalacja przy braku odpowiedzi menedżera, uzgodniony kanał i format wysyłki oraz postępowanie przy braku potwierdzenia z biura. |

Termin wykonania jest polem opisowym kroku. Nie ustalono daty eskalacji ani sposobu ponowienia wysyłki, więc oba warianty zachowują pytanie o eskalację w raporcie. Powód zwrotu jest zapisany w etykiecie przejścia. Model nie uruchamia automatycznej wysyłki ani odliczania czasu.

Próbę uruchamia `node tests/browser-accounting-handoff.mjs` po uruchomieniu aplikacji na porcie 5173. Zmienne `ACCOUNTING_PDF_PATH` i `ACCOUNTING_BPMN_PREFIX` pozwalają zapisać raport i eksporty. Próba w Chromium obejmuje wprowadzenie mapy AS-IS, skopiowanie jej do TO-BE, oba pobrania BPMN 2.0, sprawdzenie przebiegu oraz raport PDF.
