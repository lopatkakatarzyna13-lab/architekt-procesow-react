# Lokalny Supabase — test sesji i bramki HTTP

Punkt bazowy: 76d8347bfea14da604e626f0d767bc5956190e3a. Status SEC-04: OTWARTY.

Rozszerzono istniejący test lokalnego Supabase o rzeczywisty token wydany fikcyjnemu użytkownikowi. Instancja w CI ma testowo ustawiony 60-sekundowy czas ważności sesji; test sprawdza ten sam token przed i po jego wygaśnięciu. Test odmawia pracy dla nielokalnych adresów.

Dodatkowo test uruchamia na 127.0.0.1 tymczasową bramkę HTTP w skrypcie testowym. Brak tokenu, inny użytkownik, zmieniony podpis i wygasły token mają zostać odrzucone przed wywołaniem fikcyjnej analizy; dozwolone konto powinno ją wywołać. Bramka ta nie jest częścią aplikacji ani funkcją Edge i nie jest wystawiana publicznie.

Test musi zakończyć się sukcesem w GitHub Actions, aby jego wynik uznać za potwierdzony. Środowisko nie łączy się z kontem Supabase ani OpenAI. Test nie obejmuje odświeżania i cofania sesji, MFA, RLS, produkcyjnych danych i konfiguracji, publicznego endpointu AI ani limitów kosztu. Tokeny nie są zapisywane do repozytorium ani celowo logowane. Pierwsza próba testu nie powiodła się, ponieważ błędnie zakładała algorytm HS256; nowy scenariusz wykorzystuje rzeczywisty token wydany przez usługę.

## Wynik

[Przebieg CI](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42507892055) dla commitu `61cddffdc03f995af7f05d92aa4cf92ca838fecf` zakończył się pomyślnie. Prawdziwie wydany token konta testowego przeszedł weryfikację przed wygaśnięciem, a po wygaśnięciu został odrzucony również przez testową bramkę; licznik fikcyjnej analizy nie wzrósł. Ten sam przebieg potwierdził blokadę innych kont, braku tokenu i zmienionego podpisu. [SEC-04](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42507892053) oraz [MVP](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42507892042) również przeszły. Wnioski ograniczają się do środowiska i warunków testu opisanych powyżej.
