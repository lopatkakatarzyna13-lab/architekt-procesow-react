# SEC-04 — przegląd propozycji i dostęp lokalny

Punkt wyjścia e45d2594eda46d427d80ceead94d050aa07ee152; status SEC-04 pozostaje OTWARTY.

## Wykonane

Aplikacja Vite przekazuje żądanie /api/analyze-workshop do serwera 127.0.0.1:8787. Serwer sprawdza Origin i typ danych, ale nie uwierzytelnia lokalnego procesu; żądanie spoza przeglądarki może podrobić Origin. Nie wolno wystawiać serwera publicznie. Ograniczenia licznika opisuje SEC-04-licznik-2026-11-08.md.

Uzupełniono interfejs o komunikat, że cytat nie potwierdza poprawności propozycji i należy sprawdzić jej kontekst. Test UI potwierdza, że propozycja AI nie jest przenoszona automatycznie: użytkownik zapisuje transkrypcję i propozycję oraz wybiera krok. Osobny test potwierdza dostęp do ręcznej edycji przy niedostępności licznika.

Test z fikcyjną wrogą transkrypcją i spreparowaną odpowiedzią dostawcy potwierdza ograniczenie: jeśli cytat występuje w tekście, walidacja nie stwierdza, czy propozycja jest z nim logicznie zgodna. To test symulowany, bez wywołania modelu i bez dowodu na jego podatność w danym scenariuszu. Weryfikacja człowieka pozostaje niezbędna.

Lokalnie: 179/179 testów Vitest, 4/4 smoke HTTP, ESLint i build; dane fikcyjne, bez OpenAI API. Test w przeglądarce uruchamia GitHub Actions.

## Niewykonane i dalsza decyzja

Do odróżnienia uprawnionego programu lokalnego potrzebny jest model dostępu dopasowany do rzeczywistego uruchamiania aplikacji i założeń zaufania do urządzenia. Sekret dostępny dla przeglądarki, proxy lub procesów z tym samym kontem nie jest ochroną przed złośliwym programem z tym samym poziomem dostępu. Rozwiązania takie jak izolacja konta systemowego lub osobne uwierzytelnienie wymagają oceny wpływu na sposób używania i architekturę; nie zostały wdrożone. Rzeczywisty model pracy właścicielki oraz ustawienia finansowe dostawcy nie zostały zweryfikowane. Nie resetować limitu automatycznie i nie traktować go jako limitu płatności dostawcy. Bez zakończenia oceny dostępu i kosztów nie zamykać SEC-04.
