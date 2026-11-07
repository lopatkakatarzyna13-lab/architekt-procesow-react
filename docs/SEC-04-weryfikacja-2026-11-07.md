# SEC-04 — lokalny serwer AI: wynik weryfikacji częściowej

Data: 2026-11-07
Gałąź: `feature/architekt-2-mvp`
Punkt bazowy: `2c5eeef2bd12dbe56318776b7725970ef46a5b21`

## Zakres

Zweryfikowano odczytem GitHub moduły:
- `server/security.js`
- `server/persistentUsageGuard.js`
- `server/workshopHandler.js`
- `.github/workflows/sec04-validation.yml`

Zgodność gałęzi z punktem bazowym w chwili odczytu: identyczna.

## Wynik dynamiczny

Odtworzono powyższe trzy moduły w odizolowanym katalogu testowym Node.js 22, bez klucza OpenAI. Uruchomiono 4 testy HTTP przy użyciu fikcyjnych danych i symulowanego dostawcy:

| Scenariusz | Wynik |
| --- | --- |
| Limit utrzymuje się po utworzeniu nowego handlera | PASS |
| Nieczytelny plik limitu blokuje żądanie (503) | PASS |
| Błędny JSON jest odrzucany (400) bez wywołania dostawcy | PASS |
| Niedozwolony Origin jest odrzucany (403) bez wywołania dostawcy | PASS |

Testy lokalne: 4/4 PASS. Nie są one dowodem ukończenia pełnej regresji repozytorium ani uruchomienia aktualnego workflow w GitHub Actions.

## Zastrzeżenia / ryzyko pozostałe

1. Nie potwierdzono wyników `npm ci`, `npx vitest run`, `npm run lint`, `npm run build` ani testu Chromium dla aktualnego commitu. Pobieranie repozytorium przez Git z tego środowiska było zablokowane przez DNS.
2. Dostępny odczyt workflow dla commitu filtruje uruchomienia PR i nie pozwala wnioskować o uruchomieniach typu push. Status Vercel nie dowodzi zaliczenia GitHub Actions.
3. Lokalny limit jest przeznaczony dla pojedynczej instancji. Nie jest autoryzacją, limitem kosztów po stronie dostawcy ani bezpiecznym rozwiązaniem publicznego API.
4. Nie zweryfikowano rzeczywistego przetwarzania danych u dostawcy AI ani warunków RODO.
5. Do czasu zakończenia audytu testować wyłącznie na danych fikcyjnych lub skutecznie zanonimizowanych.

## Następna bramka jakościowa

Uzyskać w GitHub Actions wynik przebiegu dla najnowszego commitu: `node --test server/security.smoke.mjs server/persistentUsage.smoke.mjs`, `npm ci`, `npx vitest run`, `npm run lint`, `npm run build`. Zarejestrować identyfikator przebiegu, liczbę testów, wyniki i ewentualne poprawki. Nie scalać z `main` ani nie publikować produkcyjnie bez osobnej decyzji.

**Status SEC-04: częściowo zweryfikowany, otwarty.**
