# Odporność warsztatu — przegląd 17.11.2026

Stan przeglądu kodu 6ebcd13; dane testowe są fikcyjne. Obszar pozostaje otwarty.

- Istniejący test przeglądarki sprawdza pracę ręczną i zapis po utracie sieci na już otwartej stronie oraz odtworzenie po powrocie sieci i przeładowaniu. Nie potwierdza uruchomienia strony całkowicie offline.
- Sesja AI jest przechowywana w pamięci; po przeładowaniu wymaga ponownego logowania. Zapis transkrypcji i propozycji jest jawny, lokalny i zależy od dostępności pamięci przeglądarki. Niezapisane dane mogą przepaść.
- Test jednostkowy przerwania klienta nie jest testem awarii procesu. Kod SQL przewiduje wygaśnięcie blokady po pięciu minutach; lokalny test PostgreSQL symuluje upływ czasu przez zmianę daty wygaśnięcia i sprawdza ponowne przyjęcie oraz ochronę przed zwolnieniem nowej blokady starym identyfikatorem. Kolejne przyjęte żądanie zwiększa licznik. Nie jest to dowód zachowania po rzeczywistej awarii ani gwarancja kosztowa. Po wygaśnięciu poprzednia analiza może nadal działać, jeśli nie została zakończona, więc możliwe są równoległe wywołania dostawcy.
- Utrata odpowiedzi nie dowodzi, czy dostawca rozpoczął pracę. Nowy komunikat ostrzega o możliwym ponownym zużyciu próby i koszcie, wskazuje pracę ręczną; nie uruchamia automatycznego ponowienia.
- Wymagają dalszego sprawdzenia: rzeczywisty upływ czasu blokady i granice awarii sieci w docelowym środowisku. Test przeglądarki sprawdził ponowne logowanie po przeładowaniu oraz odtworzenie zapisanej pracy na danych fikcyjnych. SEC-04 pozostaje otwarty. Nie wdrażano SQL ani Edge.

## Próba rzeczywistego zakończenia procesu

Dla commitu `6115b67a15152d050e3e648b11263fc64baceb73` [osobny test PostgreSQL](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44117655433) zakończył się powodzeniem. Proces obsługujący żądanie został zakończony SIGKILL po rozpoczęciu oczekiwania na fikcyjnego dostawcę. Przed i po zakończeniu kolejne żądanie było BUSY, licznik pozostawał na 1. Po ręcznym ustawieniu daty wygaśnięcia w przeszłość przyjęto nowe żądanie, licznik wzrósł do 2, a stary identyfikator nie zwolnił nowej blokady. Test nie odczekał rzeczywistych pięciu minut, nie zabijał procesu hostowanego Edge i nie mierzy zachowania rzeczywistego dostawcy.

W osobnym [przebiegu pełnego Supabase](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44116771917) baza weszła w tryb recovery przed nowym testem; przyczyna nieustalona. Wynik pełnego środowiska pozostaje niezależny od sukcesu powyższej próby. Nadal potrzebne są próby połączenia i odzyskania pracy w docelowym środowisku, przegląd bezpieczeństwa i ocena kosztów.

## Uzupełnienie z 20 listopada

- Kasia potwierdziła na nowym laptopie z Windows, że w trybie warsztatu lokalnego można bez internetu zapisać proces, zamknąć kartę i odczytać zachowany krok AS-IS po ponownym otwarciu procesu z biblioteki. Próba dotyczyła pracy ręcznej na fikcyjnym przykładzie.
- Na commicie `5f2be82` [pełna próba izolowanego Supabase](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44818934793) zakończyła się sukcesem. Wcześniejszy błąd połączenia się nie powtórzył. Jego przyczyna pozostaje nieustalona.
- W teście przeglądarkowym z lokalnym Edge dodano scenariusz utraty odpowiedzi po zakończonej analizie u fikcyjnego dostawcy. Sprawdza komunikat o możliwym zużyciu próby, faktyczny przyrost lokalnego licznika, zachowanie transkrypcji i AS-IS, dopisanie ustalenia oraz brak automatycznego ponowienia po przeładowaniu i ponownym logowaniu.
