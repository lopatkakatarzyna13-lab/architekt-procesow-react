# Odporność warsztatu — przegląd 17.11.2026

Stan przeglądu kodu 6ebcd13; dane testowe są fikcyjne. Obszar pozostaje otwarty.

- Istniejący test przeglądarki sprawdza pracę ręczną i zapis po utracie sieci na już otwartej stronie oraz odtworzenie po powrocie sieci i przeładowaniu. Nie potwierdza uruchomienia strony całkowicie offline.
- Sesja AI jest przechowywana w pamięci; po przeładowaniu wymaga ponownego logowania. Zapis transkrypcji i propozycji jest jawny, lokalny i zależy od dostępności pamięci przeglądarki. Niezapisane dane mogą przepaść.
- Test jednostkowy przerwania klienta nie jest testem awarii procesu. Kod SQL przewiduje wygaśnięcie blokady po pięciu minutach; lokalny test PostgreSQL symuluje upływ czasu przez zmianę daty wygaśnięcia i sprawdza ponowne przyjęcie oraz ochronę przed zwolnieniem nowej blokady starym identyfikatorem. Kolejne przyjęte żądanie zwiększa licznik. Nie jest to dowód zachowania po rzeczywistej awarii ani gwarancja kosztowa. Po wygaśnięciu poprzednia analiza może nadal działać, jeśli nie została zakończona, więc możliwe są równoległe wywołania dostawcy.
- Utrata odpowiedzi nie dowodzi, czy dostawca rozpoczął pracę. Nowy komunikat ostrzega o możliwym ponownym zużyciu próby i koszcie, wskazuje pracę ręczną; nie uruchamia automatycznego ponowienia.
- Nadal wymagają sprawdzenia: rzeczywiste zakończenie procesu z użyciem lokalnej bazy, rzeczywisty upływ czasu blokady, test ponownego logowania po przeładowaniu oraz granice awarii sieci w docelowym środowisku. SEC-04 pozostaje otwarty. Nie wdrażano SQL ani Edge.
