# SEC-04 — lokalny eksperyment Supabase Edge

Status: weryfikacja w CI, SEC-04 otwarty. Zatwierdzono kierunek Supabase Edge Functions jako zaplecza AI. Dodano funkcję `workshop-fixture`, która jest wyłączona bez jawnej konfiguracji testowej, nie wywołuje dostawcy AI i akceptuje tylko jeden fikcyjny tekst. Nie jest gotowym publicznym endpointem i nie należy jej wdrażać do projektu hostowanego.

Scenariusz CI ma uruchamiać prawdziwy lokalny runtime Edge oraz tymczasowe Supabase Auth i PostgreSQL. Funkcja weryfikuje użytkownika, origin, metodę, nagłówek i ograniczoną liczbę bajtów, rezerwuje limit przez funkcję SQL niedostępną dla użytkowników anon/authenticated, a następnie zwraca fikcyjną propozycję. Test sprawdza odmowę obcego konta, limit przy równoczesnych żądaniach oraz blokadę w razie błędu bazy. Nie używa konta produkcyjnego, danych klientów ani OpenAI. Wynik obowiązuje dopiero po sukcesie workflow dla konkretnego commitu.

Brak w tym etapie: rzeczywistego dostawcy AI i kontroli jego kosztów, limitu godzinowego i długości równoczesnych analiz, docelowego modelu uprawnień i wdrożenia, podłączenia funkcji Edge do głównej aplikacji, pełnej oceny bezpieczeństwa, przeglądu RLS i retencji danych oraz decyzji o dopuszczeniu danych klientów. Testowa tabela i procedura nie są migracją produkcyjną. Limit trzech wywołań istnieje wyłącznie do testu.
