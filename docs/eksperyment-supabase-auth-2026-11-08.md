# Izolowany eksperyment Supabase Auth

Punkt wyjścia: c8d80f87ec4229bc8c2a9561d5736c47c6cb5bb4. Data: 2026-11-08.

W katalogu experiments/supabase-auth przygotowano odizolowany moduł testowy używający istniejącej biblioteki @supabase/supabase-js i metody auth.getUser(token). W testach cały transport sieciowy jest symulowany, adres i dane są fikcyjne; nie użyto prawdziwego Supabase, sesji, danych klienta ani OpenAI.

Testy weryfikują akceptację wyłącznie skonfigurowanego identyfikatora użytkownika po symulowanej odpowiedzi usługi, przekazanie tokenu w nagłówku, odmowę dla innego użytkownika i braku tokenu, a także odmowę w razie błędu tokenu lub sieci. To potwierdza zachowanie eksperymentu z biblioteką, a nie poprawność konfiguracji prawdziwej usługi czy bezpieczne logowanie do aplikacji.

Moduł nie jest podłączony do aplikacji, lokalnego serwera ani żadnego publicznego endpointu; nie wdraża logowania, autoryzacji AI, limitów, zabezpieczenia sesji ani ochrony danych. Nie traktować go jako gotowego zabezpieczenia produkcyjnego. Dalsze prace wymagają izolowanego środowiska testowego, weryfikacji prawdziwej konfiguracji i przeglądu sposobu zarządzania sesjami, MFA, limitów, sekretów oraz testów dostępu HTTP. Nie zmieniono produkcji ani danych użytkownika. SEC-04 pozostaje otwarty.
