# Przegląd zależności SQL i Edge — 17 listopada 2026

Stan kodu poddanego przeglądowi: `6fbdbf3dd9fa617d1e3e0862ec6b8f0ccdb6c4a0`. Przegląd repozytorium, bez dostępu do konfiguracji docelowej bazy. To nie jest migracja ani zgoda na wdrożenie. Nie uruchamiano SQL na hoście ani płatnego API.

## Ustalenia

- `ai-quota-review.sql` to starszy, odrębny eksperyment z tabelą `architekt_ai_quota` i funkcją `architekt_ai_reserve()`. Obecny Edge z niego nie korzysta. Nie należy łączyć obu rozwiązań tylko dlatego, że nazwy się różnią.
- `ai-concurrency-review.sql` to eksperyment: tabela `public.architekt_ai_admission`, funkcje `public.architekt_ai_acquire()` i `public.architekt_ai_release(uuid)`. Edge wywołuje je przez PostgREST jako service_role. Brak rezerwacji lub błąd RPC powoduje odpowiedź 503 przed analizą; błąd zwolnienia także daje 503. Tworzenie tabeli i funkcji nie jest opakowane w transakcję w tym pliku: częściowe wykonanie jest możliwe przy sposobie uruchomienia bez transakcji.
- `ai-disable-admission-review.sql` jest eksperymentem operacyjnym: odbiera EXECUTE acquire i sprawdza skuteczne uprawnienie service_role w tej samej transakcji. Wykrycie dostępu powoduje wycofanie całej transakcji, więc odebranie uprawnień nie zostaje wtedy zastosowane. Nie blokuje działającej już analizy, innych ewentualnych ścieżek dostępu ani lokalnego serwera. Nie jest pełnym odtworzeniem poprzedniej konfiguracji.
- W repozytorium istniejąca aplikacja odczytuje `synthetic_processes`; projektowana tabela ma inną nazwę. To nie dowodzi braku kolizji lub wpływu na hostowany projekt, jego role, inne aplikacje, polityki, schemat API, funkcje i zależności.
- Znalezienie tych samych nazw funkcji także z innymi argumentami wymaga przeglądu: przeciążenia mogą wpływać na rozpoznawanie RPC. Należy sprawdzić wszystkie rodzaje obiektów w przestrzeni nazw public, w tym relacje, widoki, sekwencje, typy i funkcje oraz istniejące wpisy historii migracji. Nie używać automatycznego DROP ani CREATE OR REPLACE dla rozwiązania kolizji.
- Wymagane są istniejące role `anon`, `authenticated`, `service_role`, uprawnienia do schematu i tworzenia obiektów oraz odpowiedni właściciel funkcji SECURITY DEFINER mający wymagane prawa do tabeli. Sprawdzić efektywne uprawnienia, członkostwa, właściciela, domyślne granty, RLS i ustawienia ujawniania schematu PostgREST. Nie zakładać, że odebranie bezpośredniego grantu usuwa dostęp dziedziczony lub dostęp właściciela / superużytkownika.
- Licznik dotyczy dni UTC, limitu 10 prób i jednej pięciominutowej blokady. Wygasła blokada nie dowodzi zakończenia pracy dostawcy; limit prób nie jest limitem wydatków. W przypadku niejednoznacznego timeoutu RPC rezerwacja mogła zostać zapisana mimo odpowiedzi błędu. Nie ponawiać automatycznie.
- `today` w eksperymencie jest wyznaczany przed oczekiwaniem na blokadę wiersza. Zachowanie przy oczekiwaniu przez granicę dnia UTC wymaga osobnego testu i decyzji przed przygotowaniem migracji. Nie przedstawiać obecnego eksperymentu jako gotowego SQL.

## Warunki przygotowania kontrolowanej migracji

1. Zidentyfikować właściwy projekt i jego stan bez ujawniania kluczy lub danych; porównać obiekty, wersje, historię migracji, zależności oraz efektywne uprawnienia z wynikami przeglądu. Przerwać w razie kolizji lub nieznanej zależności.
2. Ustalić właściciela, role, granty i dostęp API; odtworzyć odpowiadający stan w odizolowanym środowisku. Przygotować wersjonowaną migrację z transakcyjnym wykonaniem i kontrolą warunków wejściowych; przećwiczyć także przerwanie w połowie i powtórzenie.
3. Dodać test granicy dnia i konkurencji, wykonać testy nowych obiektów, odmowy anon/authenticated oraz skutecznych uprawnień dziedziczonych, zachowania istniejącej aplikacji, RPC, błędów i odtworzenia. Sprawdzić plan kopii i odtworzenia danych, nie tylko deklarować jego istnienie.
4. Najpierw przygotować i przetestować SQL; Edge utrzymywać wyłączony, dopóki zależności, konfiguracja bramki i testy dostępu nie zostaną potwierdzone. Dopiero później rozważyć włączenie i osobną zgodę na płatnego dostawcę.
5. Przed jakąkolwiek zmianą hostowaną przedstawić dokładny projekt, zakres, wyniki, kolejność oraz przetestowany plan wycofania i uzyskać osobną zgodę. Zachować licznik i blokady; nie usuwać tabeli w ramach awaryjnego zatrzymania. Przywrócenie dostępu wymaga osobnej weryfikacji faktycznych uprawnień.

## Zakres dowodów

Cztery kontrole dla punktu wyjścia zakończyły się powodzeniem: [MVP](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44139931362), [SEC-04](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44139931396), [lokalny Supabase](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44139931602), [awaria procesu](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44139931380). Wcześniejszy test wyłączenia opisano w `przygotowanie-uruchomienia-2026-11-17.md`. Te wyniki nie potwierdzają hosta ani zachowania na granicy dnia. W obecnym środowisku przeglądu brak PostgreSQL i Dockera; nowych testów bazy nie wykonano. SEC-04 pozostaje otwarty.
