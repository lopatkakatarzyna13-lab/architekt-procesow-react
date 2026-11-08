# Architekt 2.0 — weryfikacja kierunku przeglądarkowego

Punkt bazowy: e4d976b3b78b4a4162dc9ae83d397625a1b80600. Kierunek zaakceptowany: aplikacja otwierana z linku w przeglądarce; AI wyłącznie po osobnym zabezpieczeniu serwera. Ocena kodu i dokumentacji usług, bez dostępu do konfiguracji produkcyjnej, kluczy, prawdziwych danych czy płatnego API.

## Stan kodu

- Proces, AS-IS, biblioteka i warsztat korzystają z localStorage. Dane nie synchronizują się między urządzeniami; logowanie w przyszłości nie zaszyfruje istniejących danych przeglądarki. Migracja bądź usuwanie danych wymaga odrębnego projektu zabezpieczającego przed utratą.
- Obecny klient Supabase ma wyłączone utrzymywanie sesji; aplikacja używa go do testowego odczytu synthetic_processes. Sam kod nie potwierdza konfiguracji Auth, RLS, widoczności bazy ani środowisk.
- Vite proxy kieruje ścieżkę AI do lokalnego serwera. To ustawienie serwera developerskiego; w repozytorium nie ma wdrożonego uwierzytelnionego publicznego endpointu. Flaga VITE_WORKSHOP_AI_ENABLED nie tworzy ani nie zabezpiecza takiego endpointu.
- Lokalny licznik nie jest odporny na równoczesne instancje, usunięcie obu plików ani nie wyznacza limitu u dostawcy. Przeniesienie go jako pliku do funkcji chmurowej nie zapewni wspólnego, trwałego limitu.

## Propozycja do wdrożenia etapami

1. Bez zmiany produkcji przygotować izolowane środowisko testowe i fikcyjne dane. Przeanalizować uprawnienia, konfigurację oraz ryzyko kosztów, nie kopiować istniejących sekretów ani danych klienta.
2. Zaprojektować logowanie jednego użytkownika i dopuszczenie wyłącznie właściwego konta. Rekomendowany wariant do weryfikacji: Supabase Auth, ponieważ biblioteka jest już zależnością. Serwer musi niezależnie zweryfikować token, następnie sprawdzić dozwoloną tożsamość. Sesja klienta sama nie jest autoryzacją serwerową. Zweryfikować konfigurację odzyskiwania dostępu i MFA.
3. Przygotować osobne zaplecze AI z zamkniętym domyślnie endpointem, limitem wielkości, timeoutem, walidacją, kontrolą kosztów i bezpiecznym raportowaniem błędów. Możliwa opcja: Vercel Functions lub Supabase Edge Functions. Ich wybór, konfiguracja i koszty wymagają porównania w środowisku testowym; obecny lokalny serwer nie stanowi bezpiecznej implementacji publicznej. Klucz AI pozostaje wyłącznie po stronie serwera.
4. Limity wywołań muszą być współdzielone i atomowe między instancjami, działać fail-closed oraz obejmować limity dla użytkownika i całej usługi, w tym czas trwania współbieżnych analiz. Sprawdzić oddzielne możliwości kontroli wydatków u dostawcy; limity liczby prób i tokenów nie są gwarantowaną kwotą wydatków.
5. Jeżeli w przyszłości zapisywać dane w Supabase, zaprojektować oddzielnie schemat, RLS i testy odmowy dostępu dla innego konta i niezalogowanych. Nie zakładać, że samo włączenie logowania chroni dane localStorage. Migracja i retencja wyłącznie po osobnej decyzji i testach odtwarzania.
6. Zweryfikować poprawność warsztatu, zapis i ponowne otwarcie, błędy sieci, cofnięcie zgody, blokadę nadużyć, logowanie i odnowienie sesji. Analizę modelu testować najpierw z fikcyjnym dostawcą.

## Źródła techniczne i ograniczenia

- Supabase: https://supabase.com/docs/reference/javascript/auth-getclaims oraz https://supabase.com/docs/guides/auth/server-side/creating-a-client — weryfikacja tożsamości serwerowej i rozróżnienie od sesji.
- Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security — reguły RLS zależą od właściwej konfiguracji.
- Vercel: https://vercel.com/docs/functions/limitations oraz https://vercel.com/docs/functions/configuring-functions/duration — limity zależne od konfiguracji i planu.

W repozytorium nie zmieniono uwierzytelniania, bazy, środowiska hostingu, ustawień konta ani faktycznej dostępności AI. Do czasu weryfikacji nie używać rzeczywistych danych klientów w prototypowej analizie. SEC-04 pozostaje otwarty.
