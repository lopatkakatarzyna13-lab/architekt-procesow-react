# Przygotowanie uruchomienia pierwszego warsztatu

Data: 17 listopada 2026. Punkt wyjścia: `b91ec7f31d318ab20b6b919fc1d0c31124030bcd`. Dokument przygotowawczy; nie jest zgodą na wdrożenie, użycie danych klientów, zmianę konta ani płatne API. `main` i hostowany Supabase bez zmian. SEC-04 pozostaje otwarty.

## Konkretny zakres do przyszłej oceny

- Interfejs gałęzi `feature/architekt-2-mvp`: warsztat z tekstem, ręczna ocena i przeniesienie wybranych kroków, zapis lokalny, analiza/TO-BE/raport oraz przycisk przerwania oczekiwania. Sam podgląd funkcji nie wymaga uruchamiania prawdziwego dostawcy.
- Opcjonalna analiza: `supabase/functions/workshop-ai/index.ts`, `handler.js` oraz `_shared/analyzeWorkshop.js` i walidator. Dostęp wyłącznie dla jednego zweryfikowanego identyfikatora, dozwolonego originu i po jawnym włączeniu funkcji. Należy sprawdzić również rzeczywistą konfigurację bramki, JWT i uprawnienia; kod i testy jej nie potwierdzają.
- Eksperymentalny SQL `experiments/supabase-auth/ai-concurrency-review.sql` tworzy tabelę `architekt_ai_admission` i funkcje `architekt_ai_acquire()` i `architekt_ai_release(uuid)`. To nie jest gotowa migracja: przed jakąkolwiek zgodą potrzeba sprawdzenia kolizji obiektów, roli, uprawnień, przeglądu SQL i procedury migracji dla konkretnego projektu. Nie stosować go na hoście w obecnej postaci z automatu.
- Przygotowany `experiments/supabase-auth/ai-disable-admission-review.sql` odbiera uprawnienia wywołania funkcji przyjmującej nowe żądania; nie usuwa tabeli ani licznika i zachowuje dostęp do zwolnienia już przydzielonej blokady. To projekt do przeglądu, a nie wykonana operacja na hoście. Skrypt zgłasza błąd, jeśli `service_role` zachowałoby dostęp przez inne role. Test wyłącznie w odizolowanym PostgreSQL; wynik należy potwierdzić dla właściwego commitu.

## Warunki przed prośbą o wdrożenie

1. Wybrać odizolowany projekt i adres podglądu; potwierdzić właścicielkę, konta, dostęp, MFA, uprawnienia i wpływ na istniejącą aplikację oraz polityki bazy. Przygotować plan kopii i odtworzenia; bez publikowania sekretów, identyfikatorów kont ani treści warsztatu w logach.
2. Potwierdzić stan wszystkich kontroli dla wskazanego commitu. Sporadyczna awaria lokalnego Supabase oraz przyczyny błędów bramki pozostają nieustalone; sukces testu jednostkowego ani niezależnego PostgreSQL nie zastępuje pełnego uruchomienia Edge.
3. Uzgodnić rodzaj danych, zasady urządzenia i usuwania, warunki dostawcy, retencję i ewentualną ocenę prawną. Do tego czasu używać tylko fikcyjnych przykładów. Zapis w localStorage nie jest szyfrowany; usuwanie w przeglądarce nie usuwa eksportów ani kopii zapasowych.
4. Przed płatną analizą niezależnie ustalić kwotę, sprawdzić na właściwym koncie dostępność i włączenie limitu wydatków oraz alertów. Limit dostawcy może działać z opóźnieniem; licznik prób i blokada nie stanowią limitu finansowego. Brak płatnej analizy bez osobnej decyzji.
5. Przygotować zatwierdzoną migrację, wartości ustawień bez ujawniania sekretów, kolejność wdrożenia, kontrolę dostępu innego konta, brak logów treści i plan wstrzymania. Przed włączeniem na prawdziwym dostawcy pokazać Kasi zakres, wyniki oraz sposób wycofania; uzyskać osobne zgody.

## Sposób wycofania do przetestowania w konkretnym środowisku

1. Wstrzymać nowe uruchomienia analizy; ukrycie przycisku nie jest zabezpieczeniem serwera. Wersję interfejsu można przywrócić do wcześniej zatwierdzonej wersji, po sprawdzeniu wpływu na pozostałe funkcje i dane przeglądarki.
2. Po zatwierdzeniu i sprawdzeniu wpływu na dany projekt wyłączyć serwerową funkcję AI (`ARCHITEKT_AI_ENABLED`), zapewnić zastosowanie zmiany do działających instancji i potwierdzić, że nowy request nie dochodzi do dostawcy. Nie zakładać natychmiastowego zastosowania samej zmiany konfiguracji. Lokalny serwer developerski jest osobną ścieżką i ta flaga go nie blokuje.
3. Jeśli trzeba dodatkowo zablokować nowe rezerwacje, po osobnej zgodzie zweryfikować i zastosować skrypt cofnięcia uprawnienia wyłącznie dla właściwej bazy; sprawdzić również uprawnienia dziedziczone i rzeczywisty dostęp. Nie stosować SQL automatycznie ani nie usuwać tabeli, licznika, blokad czy kluczy w ramach tego kroku.
4. Rozpoczęte wywołanie może mimo to działać i generować koszt. Monitorować istniejące zadania i rozliczenia, pozwolić na zwolnienie blokady; pięciominutowa blokada nie gwarantuje zatrzymania dostawcy. Nie ponawiać automatycznie niejednoznacznych prób.
5. Sprawdzić brak nowych przyjęć przy użyciu fikcyjnego kontrolowanego żądania oraz zachowanie zapisanego licznika i możliwości ręcznej pracy. Dopiero po osobnym przeglądzie zdecydować o przywróceniu uprawnień, dalszym usunięciu usług, retencji i kluczach. Cofnięcie uprawnień nie cofa treści już wysłanej dostawcy ani lokalnych danych przeglądarki.

Ten plan nie potwierdza skuteczności wycofania w hostowanym środowisku. Żaden z punktów nie jest gotowością do użycia rzeczywistych danych ani automatyczną zgodą na operację.

## Wynik próby lokalnej

Dla `400e6788c98ef6e8e2ac86769f32270eba27d6fe` [test na odizolowanym PostgreSQL](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44139671457) zakończył się sukcesem: po wycofaniu prawa do nowych rezerwacji licznik pozostał bez zmian, aktywny identyfikator mógł zostać zwolniony, a dodatkowe uprawnienie odziedziczone przez inną rolę spowodowało wykrycie nieskutecznego wyłączenia. Nie jest to potwierdzenie zachowania bramki, kluczy, wdrożenia ani dostawcy w projekcie hostowanym.

## Przegląd przed uruchomieniem — 20 listopada 2026

Punkt odniesienia to `e9196af`. W izolacji przeszły logowanie właścicielki, odmowa dla drugiego konta, przyjęcie i naliczenie analizy mimo utraty odpowiedzi oraz powrót do zapisanej pracy. Osobne CI sprawdza tymczasową migrację, kontrolę do odczytu, zmianę dnia UTC podczas oczekiwania na blokadę i wstrzymanie nowych rezerwacji. [Test Supabase](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44830119710) · [Testy PostgreSQL](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44830119825)

Supabase przewiduje wycofanie starszych kluczy `anon` i `service_role` do końca 2026 r. Kod Edge odczytuje teraz domyślne klucze z `SUPABASE_PUBLISHABLE_KEYS` i `SUPABASE_SECRET_KEYS`, z powrotem do starszych zmiennych, gdy brakuje poprawnej wartości domyślnej. Sprawdzenie użytkowniczki używa jej tokenu sesji i klucza publicznego. Połączenie Edge z funkcjami bazy używa nowego klucza serwerowego tylko w nagłówku `apikey`. Test bez sieci sprawdza oba formaty, kolejność wywołań oraz odmowę przy niewłaściwym kluczu, gdy brakuje wartości zapasowej. [Migracja kluczy Supabase](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) · [Zmienne Edge](https://supabase.com/docs/guides/functions/secrets) · [Nagłówki autoryzacji](https://supabase.com/docs/guides/functions/auth-headers)

| Obszar | Co trzeba potwierdzić przed próbą na hoście |
| --- | --- |
| Projekt i podgląd | Wskazać konkretny projekt testowy Supabase i stały adres Vercel Preview. Sprawdzić właścicieli, MFA, ochronę podglądu i zakres zmiennych dla gałęzi. Zapisać wyłącznie identyfikator projektu i wynik kontroli. W przeglądarce używać klucza publicznego. [Zmienne Vercel](https://vercel.com/docs/environment-variables) · [Ochrona podglądu](https://vercel.com/docs/deployment-protection) |
| Dostęp do Edge | Sprawdzić zgodność adresu w `ARCHITEKT_AI_ORIGIN`, typ kluczy dostępnych w konkretnej funkcji i ustawienie `verify_jwt` dla wywołań z tokenem użytkowniczki. Funkcja dodatkowo sprawdza konto właścicielki. Po zgodzie na próbę potwierdzić odmowę bez sesji i dla innego konta oraz brak przyjęcia tych żądań w liczniku. [Nagłówki autoryzacji Supabase](https://supabase.com/docs/guides/functions/auth-headers) |
| Baza i wycofanie | Po wskazaniu bazy wykonać [istniejącą kontrolę do odczytu](../experiments/supabase-auth/migration-draft/00-read-only-preflight.sql) na koncie przewidzianym do ewentualnej migracji. Ocenić rzeczywiste kolizje, granty i historię. Sprawdzić dostępność kopii i przywracania na wybranym planie. Wstrzymanie analiz ma blokować nowe rezerwacje i zachować licznik. Przywrócenie całej bazy to osobna operacja. [Kopie Supabase](https://supabase.com/docs/guides/platform/backups) |
| Dane i retencja | Pierwsza próba wyłącznie na fikcyjnym warsztacie. Zapis w przeglądarce, wygenerowane pliki i dostawca API to odrębne miejsca przechowywania. Ustawienie `store: false` ogranicza zapis odpowiedzi jako stanu aplikacji. Standardowe monitorowanie nadużyć może nadal przechowywać treść do 30 dni, z wyjątkami wskazanymi przez dostawcę. [Zasady danych OpenAI](https://developers.openai.com/api/docs/guides/your-data) |
| Koszty | Przed płatną próbą osobno potwierdzić projekt OpenAI, limit i alert. Jeśli konto pozwala wymusić limit, sprawdzić włączenie opcji. Egzekwowanie może działać z opóźnieniem. Dziesięć prób na dobę UTC w aplikacji ogranicza przyjęcia, a sam alert informuje o wydatkach. [Limity wydatków OpenAI](https://developers.openai.com/api/docs/guides/spend-limits) |

**Kolejność decyzji.** Najpierw wskazanie odizolowanego projektu i zgoda na przegląd ustawień oraz odczyt metadanych. Wynik przeglądu określi, czy składać osobną propozycję wdrożenia testowego. Uruchomienie `workshop-ai` w obecnej postaci wymaga konfiguracji dostawcy, a płatna analiza ma odrębną zgodę. W tym przeglądzie użyto kodu, izolowanych wyników i publicznej dokumentacji. Ustawienia kont oraz działanie w środowisku docelowym pozostają do zweryfikowania. SEC-04 jest otwarty.
