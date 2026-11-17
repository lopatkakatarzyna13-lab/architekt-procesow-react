# Eksport liniowego modelu BPMN 2.0

W trybie listy kroków można po zapisaniu AS-IS pobrać plik `.bpmn` dla przebiegu liniowego. Model zawiera zdarzenie początkowe, zadania, zdarzenie końcowe, przepływy oraz dane położenia diagramu (BPMN DI). Nie jest modelem wykonywalnym. Dokument nie zawiera ról, systemów, opisów, ustaleń ani innych danych procesu. Eksport zostaje zablokowany, gdy występują dodatkowe przejścia albo niepoprawne dane kroków; nic nie jest po cichu pomijane w zakresie przejść. Edycja i import BPMN do aplikacji nie zostały dodane.

Testy sprawdzają serializację i odczyt z użyciem `bpmn-moddle`, strukturę węzłów, przepływy oraz odniesienia diagramu; przygotowano test przeglądarkowy pobierania pliku, odczytu i kontroli schematu BPMN 2.0 XSD z biblioteki (wynik należy sprawdzić dla commitu w CI). Poza CI sprawdzono również przykładowy plik walidatorem XSD. Walidacja XSD i odczyt nie potwierdzają poprawności biznesowej ani zgodności ze wszystkimi narzędziami. Bramek, warunków, wariantów, ścieżek wyjątkowych, ról w torach, konwersji istniejących dodatkowych połączeń i importu nie obsłużono. Dopóki nie powstaną oraz nie zostaną sprawdzone, nie należy uznawać etapu formalnej mapy BPMN za zamknięty.

Punkty odniesienia: OMG BPMN 2.0.2 — https://www.omg.org/spec/BPMN/2.0.2/About-BPMN/ ; `bpmn-moddle` — https://github.com/bpmn-io/bpmn-moddle . SEC-04 pozostaje otwarty.
