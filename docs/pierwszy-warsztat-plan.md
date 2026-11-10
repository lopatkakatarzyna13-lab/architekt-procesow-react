# Pierwszy warsztat — lista do użycia aplikacji

Aktualizacja: 10 listopada 2026. Cel: osobista praca konsultantki z tekstem warsztatu, weryfikacją propozycji AI i przygotowaniem AS-IS. Zakres tego etapu nie obejmuje transkrypcji na żywo ani formalnego BPMN 2.0. Faktyczne dane klientów i płatne API dopiero po osobnej decyzji oraz spełnieniu warunków bezpieczeństwa.

## Punkt startowy — potwierdzone

- Edycja transkrypcji, ręczna propozycja, zapis i przeniesienie wybranych kroków do AS-IS są przygotowane.
- W CI sprawdzono rzeczywisty interfejs, lokalne logowanie i endpoint Edge z fikcyjnym dostawcą, zatwierdzenie i ponowne otwarcie. Nie jest to potwierdzenie działania hostowanego środowiska ani jakości rzeczywistego AI.
- Konto i zapis sesji AI są przygotowane na gałęzi rozwojowej; endpoint i SQL nie są wdrożone. SEC-04 pozostaje otwarty.
- Awaria testowej bazy nie została wyjaśniona. Pozostawiono diagnostykę; wrócić do niej, jeżeli ponownie wystąpi lub zablokuje dalsze prace.

## Zadania do pierwszej wersji

1. **Odporność podczas spotkania — w toku.** Zweryfikować utratę internetu, ponowne zalogowanie, przerwanie analizy i powrót do zapisanej pracy. Odróżnić zamknięcie karty od zakończenia procesu serwera, a ryzyko ponownego naliczenia jasno opisać. Gotowe, gdy scenariusze są sprawdzone oraz znane zachowanie i sposób odzyskania danych.
2. **Przegląd bezpieczeństwa i danych — do wykonania.** Sprawdzić m.in. przechowywanie transkrypcji w przeglądarce, dostęp do konta, sekrety, usuwanie danych, konfigurację Supabase oraz warunki przetwarzania przez dostawcę. Gotowe, gdy istnieje lista ustaleń, poprawki krytycznych braków i jasno opisane ryzyko pozostałe. Sam wynik automatycznych testów nie jest zatwierdzeniem zgodności.
3. **Koszty i konfiguracja AI — do wykonania.** Zweryfikować aktualne możliwości ograniczania wydatków i zasady danych u wybranego dostawcy; przedstawić Kasi konkretną propozycję ustawień. Dzienna liczba prób i blokada równoległości nie gwarantują limitu finansowego. Płatny dostęp wymaga osobnej decyzji.
4. **Próba na fikcyjnym warsztacie — do wykonania.** Przejść przygotowanie procesu, tekst, propozycje, sprawdzenie, przeniesienie do AS-IS, zapis, otwarcie i wynikowy raport. Oddzielić wynik fikcyjnego dostawcy od oceny rzeczywistego modelu. Gotowe, gdy zapisano wyniki i poprawiono blokujące problemy.
5. **Przygotowanie docelowego uruchomienia — do wykonania.** Przygotować konkretną listę konfiguracji, sprawdzenia i wycofania zmian, następnie poprosić o wymaganą zgodę na wdrożenie funkcji i SQL. Po zgodzie zweryfikować działanie w docelowym środowisku i przekazać prostą instrukcję.

Stan: **0 z 5 zadań zakończonych**, pierwsze w toku. Te punkty mają różną pracochłonność; nie należy traktować ich liczby jako procentu ukończenia. Zmiany wyłącznie na `feature/architekt-2-mvp`, bez prawdziwych danych i płatnego API przed osobną decyzją.
