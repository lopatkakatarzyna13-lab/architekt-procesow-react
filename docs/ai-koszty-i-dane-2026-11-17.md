# Pierwszy warsztat — koszty i dane AI

Stan źródeł i kodu: 17 listopada 2026, kod bazowy `ac59f1d61c920f76e17243a003bd015fd8e4ef9d`. Przegląd nie obejmuje ustawień konta Kasi ani umów; nie uruchomiono płatnego API, nie wysłano danych klientów i nie wprowadzono ustawień na koncie. SEC-04 pozostaje otwarty.

## Co robi projekt

Po potwierdzeniu użytkowniczki prototyp przesyła tekst do OpenAI Responses API. Kod wskazuje `gpt-4.1-mini`, `store: false`, do 20 000 znaków transkrypcji i do 4000 tokenów odpowiedzi. Testy używają fikcyjnego dostawcy, więc nie potwierdzają jakości modelu, jego dostępności na koncie ani rzeczywistej ceny konkretnego wywołania. Projektowany limit 10 przyjętych prób na dobę UTC i wygasająca blokada nie są limitem finansowym. Przerwanie oczekiwania nie gwarantuje przerwania po stronie dostawcy.

## Dane

Zgodnie z [dokumentacją OpenAI o danych API](https://developers.openai.com/api/docs/guides/your-data), dane przesłane do API nie są domyślnie używane do trenowania modeli bez zgody klienta. `store: false` ogranicza zapis odpowiedzi jako stanu aplikacji, ale samo nie wyłącza rejestrowania na potrzeby monitorowania nadużyć. Standardowo może ono zawierać treści żądań i odpowiedzi oraz trwać do 30 dni, z opisanymi w dokumentacji wyjątkami. Rozwiązania ograniczające retencję zależą od uprawnień, zatwierdzenia, konfiguracji i ograniczeń danego endpointu. Nie stwierdzono, że są dostępne lub włączone na koncie Kasi. Dodatkowo tekst pozostaje w przeglądarce po zapisaniu; sprawdzenia retencji i zabezpieczeń Supabase, urządzenia, kopii i dostawcy są odrębne.

Przed rzeczywistymi danymi: ustalić kategorie informacji, anonimizację, role i podstawę przetwarzania, warunki z klientem, wymagane umowy, lokalizację przetwarzania oraz ustawienia i okresy przechowywania. W razie potrzeby ocenić je ze specjalistą RODO. Do tego czasu wyłącznie dane fikcyjne.

## Koszt — przykład, nie wycena

Według [cennika modelu](https://developers.openai.com/api/docs/models/gpt-4.1-mini) stawka standardowa tekstu na dzień przeglądu to **0,40 USD za milion tokenów wejściowych** i **1,60 USD za milion tokenów wyjściowych**; ceny i dostępność mogą się zmienić. Dla przykładowych 3000 tokenów wejścia i 1000 wyjścia: 3000 × 0,40 / 1 000 000 + 1000 × 1,60 / 1 000 000 = **0,0028 USD** za analizę, czyli 0,28 USD za 100 takich analiz. To ilustracja, nie pomiar aplikacji i nie gwarancja: liczba tokenów nie jest liczbą znaków, obejmuje także instrukcję i schemat; rzeczywiste użycie, ponowienia, podatki i ewentualne inne usługi mogą zmienić koszt. Dane konta i rozliczenia nie zostały sprawdzone.

## Zabezpieczenia proponowane przed płatną próbą

1. Użyć osobnego projektu API dla Architekta, z ograniczonym dostępem i osobnym kluczem serwerowym; nie umieszczać sekretu w przeglądarce ani repozytorium.
2. W ustawieniach projektu `Limits → Spend` ustalić niski miesięczny limit oraz, jeśli opcja jest dostępna dla konta, **włączyć wymuszanie limitu** i sprawdzić zapisane ustawienie. Kwotę należy uzgodnić przed opłaceniem lub uruchomieniem API; nie ustawiono żadnej kwoty.
3. Ustawić alerty poniżej limitu, ograniczyć dostępny model i tempo żądań, sprawdzić uprawnienia i odpowiedzialność za monitorowanie. Zgodnie z [dokumentacją limitów wydatków](https://developers.openai.com/api/docs/guides/spend-limits), alert nie zatrzymuje API; wymuszany limit może zadziałać z opóźnieniem i nie gwarantuje idealnego nieprzekroczenia kwoty. Potwierdzić rzeczywiste możliwości danego konta.
4. Na fikcyjnym materiale zmierzyć tokeny i rachunek dopiero po osobnej decyzji o płatnym teście; nie ekstrapolować kosztu na podstawie liczby znaków lub prób. Obecna zmiana kodu pozwala rozpoznać wybrane błędy limitu wydatków/środków bez ujawniania szczegółów dostawcy i zachowuje ręczną pracę; wynik testów dla właściwego commitu sprawdzić w CI.
5. Sprawdzić konfigurację dostępu, retencji, RLS i zasady wycofania przed osobną decyzją o wdrożeniu Edge/SQL. Nie włączać automatycznych ponowień błędów rozliczeniowych.

Stan: analiza źródeł i propozycja zabezpieczeń są przygotowane; ustawień konta, budżetu, umów, kosztu faktycznego wywołania i dopuszczalności danych klientów nie potwierdzono. Obszary bezpieczeństwa oraz kosztów pozostają w toku.
