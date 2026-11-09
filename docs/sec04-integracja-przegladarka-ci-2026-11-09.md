# SEC-04 — odizolowany test integracji przeglądarki

Status: eksperyment testowy, SEC-04 nadal otwarty. Test używa wyłącznie tymczasowego lokalnego Supabase w GitHub Actions, fikcyjnych kont i stałej fikcyjnej odpowiedzi AI. Nie korzysta z OpenAI ani z produkcyjnego Supabase. Adresy usług są ograniczone do localhost.

`browser-test.html` i `browser-test.jsx` to osobny ekran testowy Vite, nie logowanie w produkcyjnej aplikacji. Ekran pobiera prawdziwą sesję z tymczasowego Auth, dodaje jej token do żądania warsztatu i wyświetla istniejący interfejs. `browser-integration.mjs` uruchamia lokalny, testowy serwer HTTP, sprawdza konto przez Auth, rezerwuje limit w tymczasowej tabeli PostgreSQL i zwraca fikcyjną propozycję. Tabela, konta i usługi istnieją tylko w runnerze. Nie używać bramki ani konfiguracji jako produkcyjnego zabezpieczenia.

Scenariusz ma sprawdzić dozwolone i obce konto, brak tokenu, logowanie, przejście warsztat → analiza → zatwierdzenie → AS-IS → zapis → otwarcie z biblioteki, równoczesne rezerwacje, limit, awarię tabeli i kontynuację pracy ręcznej. Awaria połączenia weryfikatora Auth jest sprawdzana przez próbę połączenia z niedostępnym lokalnym portem, a brak łączności przeglądarki z logowaniem przez blokadę sieci w Playwright. Nie są to testy awarii rzeczywistej usługi zdalnej.

Wynik tego scenariusza jest potwierdzony dopiero po pomyślnym przebiegu workflow dla konkretnego commitu. Nie sprawdza on produkcyjnego wdrożenia, RLS, MFA, ochrony kluczy dostawcy AI, budżetu u dostawcy, rzeczywistych danych klientów ani bezpieczeństwa endpointu publicznego. Przed zamknięciem SEC-04 należy przygotować i przetestować docelową implementację, ograniczenia nadużyć i kosztów, obsługę sesji oraz ocenę bezpieczeństwa; dane warsztatowe w localStorage wymagają osobnej oceny.

## Pierwszy wynik

[Test integracji w CI](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42572954773) dla `d3353bb6870119b601f741ed41e9c58ff248671d`: sukces, w tym scenariusz Chromium. W tym samym commicie lint wykrył brak eksportu komponentu testowego; poprawkę należy sprawdzić osobno na kolejnym commicie. Wynik nie zamyka SEC-04.

Ograniczenia interfejsu zaobserwowane w pierwszym teście: komunikaty o limicie i liczniku wskazywały ustawienia lokalnego serwera mimo zastosowania fikcyjnego PostgreSQL, a eksperymentalna weryfikacja nie rozróżniała odmowy dostępu od niedostępności Auth. W następnej zmianie poprawiono komunikaty oraz podział odpowiedzi 403/503; skuteczność trzeba potwierdzić w CI dla właściwego commitu. Eksperyment nadal nie jest docelową bramką.
