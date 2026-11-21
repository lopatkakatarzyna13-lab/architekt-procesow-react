# Pierwsza próba warsztatu bez internetu

Wersja lokalna działa na laptopie. Pozwala ręcznie opracować ustalenia, zapisać proces i wrócić do niego po zamknięciu przeglądarki. Analiza AI i połączenie z Supabase są w tej wersji wyłączone. Do próby użyj fikcyjnych danych.

## Przed warsztatem

1. W folderze aplikacji na gałęzi `feature/architekt-2-mvp`, z zainstalowanym Node.js 22 lub 24, uruchom przy dostępie do internetu `npm ci`, a potem `npm run workshop:prepare`. Po zmianie kodu ponownie wykonaj oba polecenia.
2. Uruchom `npm run workshop:local` i otwórz adres `http://127.0.0.1:4173` w zwykłym profilu Chrome lub Edge. Zostaw otwarty terminal i zapisz adres jako zakładkę. Górny pasek pokaże „Warsztat lokalny · zapis w tej przeglądarce”.
3. Odłącz internet. Zapisz fikcyjny zakres, ustalenia i kroki AS-IS. Zamknij przeglądarkę, uruchom ją ponownie pod tym samym adresem, otwórz proces przez „Moje procesy” i sprawdź zapisane treści. Jeśli port 4173 jest zajęty, zakończ właściwy proces, który go używa, lub wróć do już uruchomionej aplikacji pod tym adresem i sprawdź oznaczenie wersji lokalnej.

## Podczas spotkania i po awarii

- Zacznij pracę pod adresem lokalnym. Zapisuj zakres, propozycję i poszczególne etapy przyciskami zapisu. Wersja otwarta pod adresem Vercel lub innym adresem lokalnym ma oddzielny zapis w przeglądarce.
- Jeśli zamknęła się karta, otwórz tę samą zakładkę w tym samym profilu. Jeśli zamknął się również terminal lub laptop się zrestartował, ponownie wykonaj `npm run workshop:local` w przygotowanym folderze. Do tego kroku wystarczy zapisany build i zainstalowane wcześniej zależności.
- W „Moje procesy” otwórz właściwą pozycję „W toku”. Po wyczyszczeniu danych witryny lub zmianie profilu zapis lokalny będzie niedostępny. Ta próba dotyczy wznowienia na tym samym laptopie i w tym samym profilu.

## Nagrywanie i odzyskiwanie dźwięku

1. Po uzgodnieniu nagrania z uczestnikami kliknij „Rozpocznij nagranie”. W trybie lokalnym aplikacja zapisuje dźwięk WebM w danych bieżącego procesu w przeglądarce. Nagrywarka przekazuje fragmenty zwykle co około 5 sekund. Komunikat „Fragment zapisany” potwierdza pierwszy udany zapis.
2. Po zatrzymaniu możesz odsłuchać i pobrać plik. Gdy karta zamknie się w trakcie, otwórz ten sam proces pod tym samym adresem i w tym samym profilu. Komunikat o przerwanym nagraniu oznacza, że można odsłuchać i pobrać zachowaną część. Dźwięk od ostatniego zapisu może przepaść.
3. „Usuń nagranie” usuwa dźwięk zapisany w przeglądarce. Przy następnym nagraniu w tym samym procesie aplikacja prosi o potwierdzenie zastąpienia. Jeśli przeglądarka nie obsługuje lokalnego zapisu WebM, pobierz plik przed opuszczeniem ekranu.

Krótka próba automatyczna zamyka kartę po zapisaniu pierwszego fragmentu i sprawdza odtwarzanie oraz pobranie po ponownym uruchomieniu przeglądarki. Próba 60 minut na Windows jest osobnym zadaniem pilotażowym.

## Próba czasu nagrania na Windows

Test w GitHub Actions uruchamia Chromium na Windows Server 2022 z wirtualnym mikrofonem. Sprawdza wariant 15 sekund i 60 minut rzeczywistego czasu. Po zatrzymaniu odtwarza i pobiera plik, a FFmpeg mierzy długość zdekodowanego dźwięku. Osobna próba zamyka kartę po około 27 sekundach i po ponownym uruchomieniu Chromium sprawdza odzyskaną część oraz podaje różnicę w sekundach. Przeglądarka podczas obu prób ma dostęp tylko do lokalnej aplikacji.

Próba w CI sprawdza Windows i Chromium w kontrolowanych warunkach. Na laptopie używanym podczas spotkania pozostaje sprawdzenie fizycznego mikrofonu oraz zachowania przeglądarki przy ustawieniach zasilania tego urządzenia.

## Lokalna transkrypcja nagrania

Przed pierwszym użyciem przygotuj FFmpeg, `whisper-cli` i wielojęzyczny model `ggml-small-q5_1.bin`. Programy mogą być w PATH. Umieść model w podfolderze `.local` katalogu aplikacji lub ustaw `WORKSHOP_WHISPER_MODEL` na jego pełną ścieżkę. Jeśli programów nie ma w PATH, ustaw też `FFMPEG_PATH` i `WHISPER_CLI_PATH` w tym samym terminalu przed uruchomieniem warsztatu. [Pobranie i przykładowa konfiguracja na Windows](../pierwszy-warsztat-plan.md#transkrypcja-pobranego-nagrania)

1. Zatrzymaj nagranie albo otwórz proces z odzyskanym plikiem. Kliknij „Utwórz transkrypcję”. Przeglądarka przekazuje dźwięk do lokalnego programu na tym samym laptopie.
2. Pozostań w widoku warsztatu do zakończenia. Możesz przerwać rozpoznawanie przyciskiem „Anuluj transkrypcję”. Nagranie pozostaje dostępne do kolejnej próby.
3. Porównaj tekst z dźwiękiem i kliknij „Zapisz transkrypcję”. Jeśli tekst już istnieje, aplikacja prosi o zgodę na zastąpienie. Jeżeli w trakcie rozpoznawania zmienisz tekst lub ustalenia, aplikacja nie podmienia ich automatycznie.

Przycisk działa pod `http://127.0.0.1:4173` po uruchomieniu `npm run workshop:local`. Plik może mieć do 160 MiB, a wynik do 100 000 znaków. W przypadku dłuższego nagrania dostępna jest także [transkrypcja pobranego pliku z terminala](../pierwszy-warsztat-plan.md#transkrypcja-pobranego-nagrania).

## Potwierdzenie techniczne

Test w GitHub Actions uruchamia przygotowany build w Chromium, blokuje żądania poza aplikacją i sprawdza zapis tekstu, propozycji i kroków AS-IS. Następnie ponownie uruchamia serwer oraz przeglądarkę, odczytuje proces z biblioteki i dopisuje kolejne ustalenie. Konfiguracja testu zawiera fikcyjne zmienne zdalnych usług, żeby sprawdzić izolację wersji lokalnej.

Na laptopie używanym podczas spotkania wykonaj krótką próbę z pierwszej sekcji. Próba lokalna i odbiór raportu przez IT są odrębnymi etapami pilota. SEC-04 i weryfikacja środowiska docelowego pozostają otwarte.
