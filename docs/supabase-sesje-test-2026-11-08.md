# Lokalny Supabase — test sesji i bramki HTTP

Punkt bazowy: 76d8347bfea14da604e626f0d767bc5956190e3a. Status SEC-04: OTWARTY.

Rozszerzono istniejący test lokalnego Supabase o token z poprawnym podpisem i terminem ważności w przeszłości oraz token kontrolny z poprawnym podpisem i przyszłym terminem. Oba są utworzone wyłącznie dla fikcyjnego użytkownika przy pomocy tymczasowego sekretu instancji testowej. Test odmawia pracy dla nielokalnych adresów. Podpis kontrolnego tokenu pozwala odróżnić odmowę ze względu na wygaśnięcie od odmowy ze względu na niepoprawny podpis.

Dodatkowo test uruchamia na 127.0.0.1 tymczasową bramkę HTTP w skrypcie testowym. Brak tokenu, inny użytkownik, zmieniony podpis i wygasły token mają zostać odrzucone przed wywołaniem fikcyjnej analizy; dozwolone konto powinno ją wywołać. Bramka ta nie jest częścią aplikacji ani funkcją Edge i nie jest wystawiana publicznie.

Test musi zakończyć się sukcesem w GitHub Actions, aby jego wynik uznać za potwierdzony. Środowisko nie łączy się z kontem Supabase ani OpenAI. Test nie obejmuje odświeżania i cofania sesji, MFA, RLS, produkcyjnych danych i konfiguracji, publicznego endpointu AI ani limitów kosztu. Sekret lokalny i tokeny nie są zapisywane do repozytorium ani celowo logowane.
