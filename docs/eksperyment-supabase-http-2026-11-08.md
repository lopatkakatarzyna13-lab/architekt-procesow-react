# Eksperyment HTTP weryfikacji tożsamości — 2026-11-08

Punkt wyjściowy: 76d03849310eb5ef5250b7ac417608d6f2614501. Status SEC-04: OTWARTY.

W odizolowanym teście Vitest uruchomiono na 127.0.0.1 dwa tymczasowe serwery HTTP: fikcyjną usługę Auth oraz bramkę testową. Istniejący klient Supabase z eksperymentu wysyłał rzeczywiste żądania HTTP do lokalnej fikcyjnej usługi, a nie do Supabase. Test wykorzystuje wyłącznie fikcyjne tokeny i dane. Usługa testowa nie sprawdza podpisów ani ważności prawdziwych JWT.

Wynik: brak tokenu, odrzucony token, inny użytkownik i błąd usługi Auth blokują wywołanie symulowanej analizy; poprawny użytkownik przechodzi raz. Do testu nie podłączono OpenAI, produkcyjnej aplikacji ani konta Supabase.

Brak dostępnego w środowisku polecenia Docker i Supabase CLI uniemożliwił uruchomienie lokalnej instancji Supabase. Nie wykonano więc testu rzeczywistego logowania, wydawania i odnawiania tokenów, MFA, konfiguracji RLS, limi­tów ani mechanizmów Edge Functions. Bramka istnieje wyłącznie w kodzie testu, nie jest gotowym publicznym endpointem ani funkcją Supabase. Kod produkcyjny nie został zmieniony.

Następne kroki: odizolowana prawdziwa instancja testowa lub lokalne Supabase w środowisku z Dockerem, scenariusze tworzenia i wygasania sesji, autoryzacji konkretnego użytkownika, nieprawidłowych i wygasłych tokenów oraz odmowy dostępu do fikcyjnej analizy; następnie wspólne trwałe limity. Dopiero po tych kontrolach oceniać podłączenie funkcji AI. Nie przenosić istniejących klientów ani sekretów do testów.
