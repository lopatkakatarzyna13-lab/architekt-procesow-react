# Pierwszy warsztat — lista do użycia aplikacji

Aktualizacja: 17 listopada 2026. Cel: osobista praca konsultantki z tekstem warsztatu, weryfikacją propozycji AI i przygotowaniem AS-IS. Zakres tego etapu nie obejmuje transkrypcji na żywo ani formalnego BPMN 2.0. Faktyczne dane klientów i płatne API dopiero po osobnej decyzji oraz spełnieniu warunków bezpieczeństwa.

## Rozpoczęcie spotkania bez transkrypcji

W sekcji „Ustalenia warsztatowe” wybierz „Opracuj ręcznie”. Dodaj pozycje i kliknij „Zapisz propozycję”. Jeśli później uzyskasz tekst rozmowy, dodaj go przez „Zapisz transkrypcję”. Ustalenia rozpoczęte bez transkrypcji zachowują się obok niej w tej samej przeglądarce. Uruchomienie analizy AI, która ma je zastąpić, wymaga potwierdzenia.

## Punkt startowy — potwierdzone

- Edycja transkrypcji, ręczna propozycja, zapis i przeniesienie wybranych kroków do AS-IS są przygotowane.
- W CI sprawdzono rzeczywisty interfejs, lokalne logowanie i endpoint Edge z fikcyjnym dostawcą, zatwierdzenie i ponowne otwarcie. Nie jest to potwierdzenie działania hostowanego środowiska ani jakości rzeczywistego AI.
- Konto i zapis sesji AI są przygotowane na gałęzi rozwojowej; endpoint i SQL nie są wdrożone. SEC-04 pozostaje otwarty.
- Awaria testowej bazy nie została wyjaśniona. Pozostawiono diagnostykę; wrócić do niej, jeżeli ponownie wystąpi lub zablokuje dalsze prace.

## Zadania do pierwszej wersji

1. **Odporność podczas spotkania — w toku.** Zweryfikować utratę internetu, ponowne zalogowanie, przerwanie analizy i powrót do zapisanej pracy. Odróżnić zamknięcie karty od zakończenia procesu serwera, a ryzyko ponownego naliczenia jasno opisać. Gotowe, gdy scenariusze są sprawdzone oraz znane zachowanie i sposób odzyskania danych.
2. **Przegląd bezpieczeństwa i danych — w toku.** Sprawdzić m.in. przechowywanie transkrypcji w przeglądarce, dostęp do konta, sekrety, usuwanie danych, konfigurację Supabase oraz warunki przetwarzania przez dostawcę. Gotowe, gdy istnieje lista ustaleń, poprawki krytycznych braków i jasno opisane ryzyko pozostałe. Sam wynik automatycznych testów nie jest zatwierdzeniem zgodności.
3. **Koszty i konfiguracja AI — w toku.** Zweryfikować aktualne możliwości ograniczania wydatków i zasady danych u wybranego dostawcy; przedstawić Kasi konkretną propozycję ustawień. Dzienna liczba prób i blokada równoległości nie gwarantują limitu finansowego. Płatny dostęp wymaga osobnej decyzji.
4. **Próba na fikcyjnym warsztacie — zakończona dla fikcyjnego scenariusza.** Przejść przygotowanie procesu, tekst, propozycje, sprawdzenie, przeniesienie do AS-IS, zapis, otwarcie i wynikowy raport. Oddzielić wynik fikcyjnego dostawcy od oceny rzeczywistego modelu. Gotowe, gdy zapisano wyniki i poprawiono blokujące problemy.
5. **Przygotowanie docelowego uruchomienia — w toku.** Przygotować konkretną listę konfiguracji, sprawdzenia i wycofania zmian, następnie poprosić o wymaganą zgodę na wdrożenie funkcji i SQL. Po zgodzie zweryfikować działanie w docelowym środowisku i przekazać prostą instrukcję.
6. **Rozbudowa i testy map BPMN dla IT i AI — wdrożono na gałęzi roboczej i sprawdzono na fikcyjnym przykładzie.** Odbiór przez osobę spoza warsztatu pozostaje do wykonania. [Wyniki próby](proba-bpmn-przekazanie-it-ai-2026-11-19.md).

Stan: **próba fikcyjnego warsztatu zakończona**, odporność, bezpieczeństwo oraz koszty w toku; uruchomienie docelowe w toku. Te punkty mają różną pracochłonność; nie należy traktować ich liczby jako procentu ukończenia. Zmiany wyłącznie na `feature/architekt-2-mvp`, bez prawdziwych danych i płatnego API przed osobną decyzją.

Przegląd na 17.11: [ustalenia o danych warsztatowych](przeglad-danych-warsztatowych-2026-11-17.md). Odporność pozostaje otwarta: pełny test Supabase dla `e87c6df` nie przeszedł, mimo pomyślnych testów odzyskania i awarii procesu; przyczyna 503 pozostaje nieustalona. Nie używać danych klienta ani nie wdrażać hostowanego SQL lub Edge przed spełnieniem pozostałych warunków.

Przegląd źródeł OpenAI i przykład kosztu: [AI — koszty i dane](ai-koszty-i-dane-2026-11-17.md). Ustawienia konta, rzeczywiste wydatki, warunki przetwarzania i zgoda na płatne API pozostają niezweryfikowane. Pełny test lokalnego Supabase dla `ac59f1d` nie przeszedł z powodu niedostępności lokalnej bazy; zob. https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44127165561.

Próba fikcyjnego warsztatu i wybrane treści w PDF: [wyniki](proba-fikcyjnego-warsztatu-2026-11-17.md). Sprawdzono tekst wybranych elementów oraz wygląd czterech stron w jednym fikcyjnym przykładzie; nie oceniono wszystkich możliwych danych ani prawdziwego AI.

Przygotowanie do przeglądu: [zakres i plan wycofania](przygotowanie-uruchomienia-2026-11-17.md). Nie potwierdzono ustawień konta ani hosta i nie udzielono zgody na wdrożenie.

## Rozbudowa i testy map BPMN dla IT i AI

Punktem wyjścia są mapy z próby skierowania na badania wstępne. Pokazują start u kierownika, tory kierownika i HR, oddzielny basen osoby przyjmowanej, decyzję o kompletności, powrót po uzupełnienie oraz przekazanie skierowania. [Sprawdzony przebieg w Chromium](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44339216593).

Wynik rozbudowy, diagnozę i ograniczenia opisano w [próbie przekazania map do IT i AI](proba-bpmn-przekazanie-it-ai-2026-11-19.md).

Drugą próbę przeprowadzono na fikcyjnym [przekazaniu danych do biura rachunkowego](pilot-2.0/proba-bpmn-przekazanie-do-biura.md). Sprawdzono termin na kroku menedżera, powrót do kontroli HR i potwierdzenie odbioru jako oddzielną wiadomość z biura.

### Zakres pierwszej rozbudowy

- Umożliwić wybór typu zadania na AS-IS i TO-BE. W pierwszej kolejności dodać zadanie ręczne, zadanie użytkownika i zadanie systemowe. Istniejące kroki zachowują ogólny typ zadania do czasu świadomej zmiany.
- Powiązać dokumenty wejściowe i wyjściowe z krokami jako obiekty danych BPMN. Zapisać ich format, np. papier, skan, PDF, formularz lub rekord w systemie. Przy przekazaniu zapisać kanał, np. osobiście, poczta, e-mail lub integracja. Przepływy wiadomości między basenami zachowują znaczenie BPMN.
- Przy kroku umożliwić opisanie roli i systemu, wymaganych danych, reguły decyzji, obsługi wyjątku i zatwierdzenia przez człowieka. Tam, gdzie wartości są znane, zapisać częstotliwość, czas pracy i czas oczekiwania. Na diagramie pokazać dane potrzebne do zrozumienia przebiegu, a szczegóły przekazać w opisie kroku i raporcie.
- Po tej próbie ustalić, czy scenariusze pilota wymagają zdarzeń czasowych, działań równoległych lub podprocesów.

### Testy i kryteria odbioru

1. **Poprawność modelu i trwałość danych.** Sprawdzić zapis i wznowienie szkicu z obiema mapami, ponowne otwarcie procesu oraz zachowanie danych przy kopiowaniu mapy AS-IS do TO-BE. Zweryfikować zgodność eksportu ze schematem BPMN 2.0 i import do niezależnego modelera. Sprawdzić obecność typów zadań i obiektów danych, powiązania z krokami, podpisy kanałów i zgodność przebiegu w podglądzie, pliku BPMN i PDF. Obejrzeć raport pod kątem obciętych nazw i kolizji etykiet z liniami.
2. **Diagnoza na fikcyjnym procesie HR.** Porównać papierowe lub mailowe zgłoszenie z formularzem. W scenariuszu AS-IS umieścić brak opisu warunków pracy, powrót do kierownika, oczekiwanie na odpowiedź i ponowne wpisywanie danych. Podczas odbioru sprawdzić, czy odbiorca potrafi wskazać z mapy i szczegółów kroku miejsca powstania błędów i ich skutek oraz co zmienia TO-BE.
3. **Przekazanie do IT i AI.** Osoba, która nie uczestniczyła w warsztacie, powinna móc wskazać dla wybranego kroku wejście, wyjście, wykonawcę, system, regułę, wariant awaryjny i moment kontroli człowieka. Na podstawie tego samego materiału powinna umieć uzasadnić, gdzie rozważyć walidację formularza, gdzie integrację, a gdzie OCR lub AI do odczytu nieustrukturyzowanych dokumentów. Brakującą informację odnotować jako pytanie do wyjaśnienia.
