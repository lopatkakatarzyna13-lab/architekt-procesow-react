# Test rzeczywistego lokalnego Supabase Auth w CI

Test na gałęzi rozwojowej uruchamia lokalny stos Supabase na tymczasowym runnerze GitHub Actions, bez łączenia z kontem Supabase i bez klucza OpenAI. Instalowana jest oficjalna akcja Supabase przypięta do SHA oraz określona wersja CLI. Repozytorium i token workflow mają tylko uprawnienie contents:read. Test używa fikcyjnych kont i lokalnych, tymczasowych kluczy, a przed połączeniem odrzuca każdy adres poza localhost. Nie tworzy kont w usłudze zdalnej i nie zmienia produkcji.

Skrypt sprawdza wydanie prawdziwych sesji przez lokalny serwis Auth, weryfikację dozwolonego i innego użytkownika, brak tokenu, błędny token oraz token ze zmodyfikowanym podpisem. Ten test nie obejmuje konfiguracji istniejącego projektu, wygasania sesji, MFA, RLS, bramki AI, limitów kosztów, retencji ani bezpieczeństwa hostingu. Test wymaga prawidłowego wykonania workflow; sam fakt dodania plików nie jest wynikiem testu. SEC-04 pozostaje otwarty.

## Wynik 8 listopada 2026

[Przebieg GitHub Actions](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42507110780) dla commitu `410b757d86def2c45012278011f2cc58bdeb6afd`: SUCCESS. Log potwierdza utworzenie lokalnych sesji, akceptację właściwego użytkownika oraz odrzucenie innego użytkownika i nieprawidłowych tokenów. Test uruchomiono na runnerze Ubuntu 24.04; lokalny serwis został zatrzymany po zakończeniu. Kontrole [SEC-04](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42507110558) i [MVP z Chromium](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42507110352) również zakończyły się sukcesem dla tego commitu.

Wciąż nie testowano wygasłego tokenu, MFA, RLS ani działania docelowego endpointu AI. Pozostałe ograniczenia opisane powyżej są aktualne; SEC-04 pozostaje otwarty.
