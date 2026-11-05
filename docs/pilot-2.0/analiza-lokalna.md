# Analiza warsztatu — lokalny prototyp

Ta wersja jest przeznaczona wyłącznie do testów lokalnych i nie jest gotowa do publicznego wdrożenia. Dostawca AI: OpenAI Responses API; domyślny model `gpt-4.1-mini`. Można go zmienić zmienną `OPENAI_MODEL`. Korzystanie z API może wymagać osobnej konfiguracji rozliczeń i wiązać się z kosztami. Konto ChatGPT nie jest automatycznie konfiguracją klucza API.

1. Zainstaluj zależności: `npm ci`.
2. Utwórz lokalny plik `.env` na podstawie `.env.example` i uzupełnij `OPENAI_API_KEY` po stronie serwera. Nigdy nie używaj prefiksu `VITE_` dla tego klucza i nie dodawaj pliku `.env` do repozytorium.
3. Uruchom w jednym terminalu `npm run workshop:server`, a w drugim `npm run dev`. Otwórz lokalny adres Vite na porcie 5173.
4. Zapisz zakres procesu, przejdź do AS-IS, wklej przykładową transkrypcję i wybierz „Analizuj transkrypcję”. Przed wysłaniem tekstu pojawi się potwierdzenie.

Serwer nasłuchuje tylko na `127.0.0.1`, dopuszcza wyłącznie żądania z lokalnego adresu Vite oraz jedno żądanie naraz. Limit tekstu dla analizy wynosi 20 000 znaków. Odpowiedź zawierająca przypisany dowód, którego nie ma w tekście, jest odrzucana. Cytat nie gwarantuje jednak, że interpretacja jest poprawna: wynik musi sprawdzić człowiek. Wynik można poprawić i zapisać ręcznie w przeglądarce, po wcześniejszym zapisaniu transkrypcji. Jest przypisany do dokładnej wersji tekstu i nie jest automatycznie przenoszony do procesu. Po zmianie transkrypcji poprzedni wynik nie jest pokazywany jako aktualny; jego zastąpienie wymaga potwierdzenia.

Bez klucza API można wybrać „Opracuj ręcznie” i samodzielnie dodawać, edytować i usuwać kroki, role, decyzje oraz pytania. Nie jest to test automatycznej analizy. Transkrypcja i propozycja są przechowywane w przeglądarce oddzielnie od snapshotu biblioteki procesów i nie synchronizują się między urządzeniami.

Klucz pozostaje na serwerze; transkrypcja jest przesyłana do dostawcy po potwierdzeniu. Żądanie ustawia `store: false`, co nie zastępuje sprawdzenia polityk dostawcy, wymagań klienta, retencji innych danych oraz uprawnień przed użyciem rzeczywistych danych. Dla publicznej wersji należy osobno zaprojektować logowanie, autoryzację, limity, kontrolę kosztów, retencję i bezpieczne wdrożenie. Nie wystawiać tego serwera w internecie.

Testy adaptera używają zasymulowanego dostawcy. Nie potwierdzają jakości działania rzeczywistego modelu; do oceny jakości potrzebny jest klucz API oraz uruchomienie trzech scenariuszy z tego katalogu.
