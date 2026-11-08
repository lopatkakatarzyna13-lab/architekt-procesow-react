# SEC-04 — weryfikacja i ryzyka pozostałe, 2026-11-08

Status: **OTWARTY**. Gałąź feature/architekt-2-mvp, badany commit 6f55f422275759edfae8cd6328cbc00c2f88e4b6. Niniejszy dokument nie potwierdza bezpieczeństwa danych klientów, zgodności z RODO ani gotowości produkcyjnej.

## Dowody wykonania

- [SEC-04 branch validation #23](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42382693745), push wskazanego commitu: logi 4/4 HTTP smoke, 174/174 Vitest, npm ci, ESLint i build przeszły. Node 22.23.4.
- [MVP 2.0 checks #55](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42382693748): 174/174, lint i build; Chromium wykonał warsztat ręczny przy utracie sieci, błąd AI oraz odtworzenie po powrocie połączenia. Nie testuje pełnego restartu offline.
- Lokalnie na tym samym commicie, Node 24.22.1: npm ci --ignore-scripts, 174/174 Vitest, lint, build, 4/4 HTTP smoke. Chromium nie uruchomiono lokalnie. Testy nie wykorzystywały prawdziwych danych ani płatnego API.
- W logu npm audit z 7.11: 4 moderate w zależnościach developerskich, 0 w produkcyjnych; wynik historyczny, nie bieżący. Workflow raportuje audyt, lecz nie blokuje go automatycznie. Ostrzeżenie dotyczy runtime Node 20 akcji checkout/setup-node, nie wersji Node 22 użytej do testowania aplikacji.

## Weryfikacja ochrony i ustalenia

1. Serwer wiąże 127.0.0.1:8787; akceptuje POST, określoną ścieżkę, Origin i JSON. Origin nie jest uwierzytelnieniem. Test z fikcyjnym dostawcą: bezpośrednie żądanie lokalne z podrobionym dozwolonym Origin zwróciło 200. Kod nie powinien być wystawiony publicznie; dla publicznego API konieczne są uwierzytelnienie, autoryzacja i oddzielne kontrole.
2. Licznik działa po ponownym utworzeniu serwera i blokuje uszkodzony plik. Test z limitem 1: pierwsze żądanie 200, kolejne 429; po usunięciu pliku kolejne 200. Brak pliku traktowany jest jak pierwsze uruchomienie. Nie jest to odporny na manipulację ani wieloprocesowy limit kosztów. Należy określić sposób inicjalizacji i bezpiecznego odtwarzania licznika, zbadać kontrole wieloprocesowe i ustawić niezależny limit po stronie dostawcy przed faktycznym użyciem API.
3. Jedno równoległe żądanie w procesie, 12 prób/godzinę, limit HTTP 120 000 bajtów, transkrypcja 20 000 znaków, timeout dostawcy 60 s i max_output_tokens 4000. Nie stanowią gwarantowanego limitu wydatków.
4. Klucz odczytywany przez serwer ze środowiska, nie jest częścią jawnej implementacji frontendu; nie przeprowadzono pełnego audytu historii Git ani ustawień Vercel/Supabase. Nie weryfikowano prawdziwego klucza ani odpowiedzi dostawcy.
5. Kod instruuje model, by traktować transkrypcję jako dane, stosuje schemat i sprawdza dosłowny cytat. Dodatkowy test ze spreparowaną odpowiedzią dostawcy: niepowiązana czynność z cytatem występującym w transkrypcji została zaakceptowana. To pokazuje ograniczenie walidacji, nie dowodzi skutecznego ataku na rzeczywisty model. Testu prompt injection na rzeczywistym dostawcy nie wykonano. Obowiązuje ręczna weryfikacja.
6. Testy symulują błędy dostawcy, błędne odpowiedzi, odmowę, równoległość i błędny JSON; pełna ocena odporności na nieautoryzowany dostęp oraz ryzyka kosztów nie jest zakończona.

## Decyzja i dalsza praca

SEC-04 pozostaje otwarty: kontrola dostępu do lokalnego serwera i odporność licznika na brak pliku nie zapewniają zabezpieczenia przed innym procesem lokalnym, a niezależny limit rozliczeń dostawcy nie został potwierdzony. Nie akceptowano ryzyka. Nie wykonano napraw ani zmian produkcyjnych. Przed wyborem zabezpieczeń należy rozstrzygnąć model zagrożeń i wpływ na sposób uruchamiania aplikacji; nie traktować Origin jako mechanizmu logowania.

Po SEC-04 priorytet: SEC-01 i SEC-05 (retencja/ochrona lokalnych danych oraz przekazywanie AI); równolegle kontrola sekretów i historii Git, następnie rzeczywista konfiguracja Supabase/RLS i Vercel. Zmiany planować z regresją warsztat → propozycje → zatwierdzenie → AS-IS → zapis → ponowne otwarcie.
