# Próba fikcyjnego warsztatu — 17 listopada 2026

Punkt wyjścia `9ff396138a67253fd90a712a83631d13e7d02389`. Wyłącznie fikcyjna rozmowa i z góry przygotowana odpowiedź dostawcy. Nie użyto OpenAI, rzeczywistych danych ani hostowanego Supabase. Scenariusz nie ocenia jakości rzeczywistego AI, jego bezpieczeństwa, konfiguracji usług ani kosztu.

Scenariusz prowadzi przez: utworzenie procesu → zapis tekstu → propozycję z fikcyjnego dostawcy → zapis i wybór dwóch kroków → AS-IS → zapis i ponowne otwarcie → ręczne ustalenie → TO-BE → interesariusza i RACI → raport → wywołanie wydruku. W lokalnym teście interfejsu scenariusz przeszedł (drukowanie zastąpiono atrapą; nie jest to test PDF ani ocena wyglądu). Dodano także test Chromium generujący przykładowy PDF; jego wynik należy sprawdzić w CI dla commitu zawierającego test. Testy nie stanowią oceny czytelności PDF ani potwierdzenia gotowości do spotkania z klientem.

Zaobserwowany zakres: opis analityczny i TO-BE wprowadzono ręcznie, a nie wygenerowano przez model. Role i pytania z propozycji nie przechodzą automatycznie do procesu; osoba prowadząca je weryfikuje. Raport przedstawia dane procesu i macierz RACI, a PDF powstaje z widoku drukowania przeglądarki. Formalna walidacja BPMN, prawdziwe AI, transkrypcja na żywo i copilot pozostają dalszymi etapami mapy rozwoju.

Próba nie jest formalnie zamknięta, dopóki wynik testu Chromium i czytelność oraz kompletność PDF nie zostaną zweryfikowane, a stwierdzone problemy poprawione. Dostęp do płatnego API i wdrożenie hostowanych funkcji wymagają osobnej decyzji. SEC-04 pozostaje otwarty.

Wynik dla `c7ddd8d82e3a7beae9f73ad31e1460b895164bc4`: [kontrola MVP](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44136027944) zakończona sukcesem, a log potwierdza przejście w Chromium do raportu i wytworzenie niepustego PDF. Sprawdzono treści w interfejsie raportu oraz wywołanie drukowania. Test nie sprawdza wizualnej czytelności ani pełnej treści pliku PDF; to pozostaje otwarte.
