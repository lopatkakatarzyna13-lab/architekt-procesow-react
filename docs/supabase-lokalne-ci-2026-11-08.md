# Test rzeczywistego lokalnego Supabase Auth w CI

Test na gałęzi rozwojowej uruchamia lokalny stos Supabase na tymczasowym runnerze GitHub Actions, bez łączenia z kontem Supabase i bez klucza OpenAI. Instalowana jest oficjalna akcja Supabase przypięta do SHA oraz określona wersja CLI. Repozytorium i token workflow mają tylko uprawnienie contents:read. Test używa fikcyjnych kont i lokalnych, tymczasowych kluczy, a przed połączeniem odrzuca każdy adres poza localhost. Nie tworzy kont w usłudze zdalnej i nie zmienia produkcji.

Skrypt sprawdza wydanie prawdziwych sesji przez lokalny serwis Auth, weryfikację dozwolonego i innego użytkownika, brak tokenu, błędny token oraz token ze zmodyfikowanym podpisem. Ten test nie obejmuje konfiguracji istniejącego projektu, wygasania sesji, MFA, RLS, bramki AI, limitów kosztów, retencji ani bezpieczeństwa hostingu. Test wymaga prawidłowego wykonania workflow; sam fakt dodania plików nie jest wynikiem testu. SEC-04 pozostaje otwarty.
