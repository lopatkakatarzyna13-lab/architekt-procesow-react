# Próba fikcyjnego warsztatu — 17 listopada 2026

Punkt wyjścia `9ff396138a67253fd90a712a83631d13e7d02389`. Wyłącznie fikcyjna rozmowa i z góry przygotowana odpowiedź dostawcy. Nie użyto OpenAI, rzeczywistych danych ani hostowanego Supabase. Scenariusz nie ocenia jakości rzeczywistego AI, jego bezpieczeństwa, konfiguracji usług ani kosztu.

Scenariusz prowadzi przez: utworzenie procesu → zapis tekstu → propozycję z fikcyjnego dostawcy → zapis i wybór dwóch kroków → AS-IS → zapis i ponowne otwarcie → ręczne ustalenie → TO-BE → interesariusza i RACI → raport → wywołanie wydruku. W lokalnym teście interfejsu scenariusz przeszedł (drukowanie zastąpiono atrapą; nie jest to test PDF ani ocena wyglądu). Dodano także test Chromium generujący przykładowy PDF; jego wynik należy sprawdzić w CI dla commitu zawierającego test. Testy nie stanowią oceny czytelności PDF ani potwierdzenia gotowości do spotkania z klientem.

Zaobserwowany zakres: opis analityczny i TO-BE wprowadzono ręcznie, a nie wygenerowano przez model. Role i pytania z propozycji nie przechodzą automatycznie do procesu; osoba prowadząca je weryfikuje. Raport przedstawia dane procesu i macierz RACI, a PDF powstaje z widoku drukowania przeglądarki. Formalna walidacja BPMN, prawdziwe AI, transkrypcja na żywo i copilot pozostają dalszymi etapami mapy rozwoju.

Kryterium próby to wynik Chromium, sprawdzenie wybranych treści i wyglądu raportu oraz poprawa znalezionych problemów w fikcyjnym przykładzie. Dostęp do płatnego API i wdrożenie hostowanych funkcji wymagają osobnej decyzji. SEC-04 pozostaje otwarty.

Wynik dla `c7ddd8d82e3a7beae9f73ad31e1460b895164bc4`: [kontrola MVP](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44136027944) zakończona sukcesem, a log potwierdza przejście w Chromium do raportu i wytworzenie niepustego PDF. Sprawdzono treści w interfejsie raportu oraz wywołanie drukowania. Test nie sprawdza wizualnej czytelności ani pełnej treści pliku PDF; to pozostaje otwarte.

Dla `a415fa357d93467778221b721f306e3763d44dd6` [przebieg MVP](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44136604102) potwierdził również przez odczyt tekstu wygenerowanego PDF obecność nazwy procesu, obu kroków, obserwacji, celu zmiany i roli. Nie sprawdzono wizualnej czytelności, kompletności całego PDF, jakości AI ani użyteczności warsztatu z klientem; punkt 4 pozostaje w toku.

Przegląd wizualny PDF wygenerowanego dla `c9c9f4950935bac222060174535559b6aa48c631`: cztery strony A4, nazwa, procesy, mapa i RACI widoczne; nagłówek interesariuszy został na końcu strony 3, a treść przeszła na stronę 4. Dodatkowo przy R/A pokazywały się puste wiersze R i A. Przygotowano poprawkę podziału strony i usunięcie pustych przypisań; weryfikacja po poprawce wymaga nowego wyniku CI i wizualnego przeglądu. Próba jest ograniczona do tego przykładu, nie zastępuje weryfikacji długich danych.

Wynik po poprawce dla `6e172d5db6efe0bd55220fcffda36f8f61ffc164`: [MVP i Chromium](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44137714296) zakończyły się sukcesem; PDF sprawdzono pod kątem wybranych treści oraz obejrzano wszystkie cztery strony A4. Nagłówek i pierwszy interesariusz są na jednej stronie; puste R i A przy R/A nie występują. W tym fikcyjnym przykładzie nie stwierdzono blokującego problemu układu. Punkt próby na fikcyjnym warsztacie zamknięto dla tego zakresu; nie obejmuje prawdziwego modelu, klienta, innych przeglądarek ani wielostronicowych nietypowo długich danych. SEC-04, koszty oraz wdrożenie pozostają otwarte.

## Ponowna próba 18 listopada 2026

Punkt wyjścia `4ec8193`. Przykład HR obejmuje kontrolę kompletności dokumentów, zwrot brakujących danych, uzgodnienie terminu przekazania, udział zewnętrznego biura i przypisanie odpowiedzialności.

- Po odświeżeniu karta wracała do poprzednio zapamiętanego ekranu, zwykle AS-IS. Aplikacja zapisuje teraz bieżący etap od AS-IS do raportu dla tej karty. Scenariusz sprawdza odświeżenie TO-BE i zapisanego raportu z macierzą RACI.
- Zapis etapu mógł pominąć wpis w otwartym formularzu kroku, ustalenia lub interesariusza. Zapis i przejście dalej wymagają dokończenia formularza. Eksport PDF również sprawdza formularz interesariusza.
- Raport dla `4ec8193` wykazał zmianę osoby odpowiedzialnej i jednocześnie policzył zero zmienionych kroków. Raport i widok wydruku oznaczają teraz powiązany krok jako zmieniony, gdy porównanie wykrywa różnicę w nazwie, odpowiedzialności lub systemie, a zapisany typ kroku to „Bez zmian”.
- Próba w Chromium obejmuje archiwizację i otwarcie z „Moich procesów”, odczyt eksportu BPMN i sprawdzenie tekstu wygenerowanego PDF. Odpowiedź AI pochodzi z fikcyjnej odpowiedzi zapisanej w teście.

[GitHub Actions dla `4ec8193`](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44301033471) potwierdza przejście od fikcyjnych ustaleń do PDF. Obejrzano wszystkie osiem stron A4 z tamtego przebiegu. Sprawdzono, że raport zawiera obie mapy, zmianę odpowiedzialności i macierz RACI. Sprawdzenie nowego PDF wymaga uruchomienia rozszerzonego scenariusza w Chromium dla wersji z poprawkami.
