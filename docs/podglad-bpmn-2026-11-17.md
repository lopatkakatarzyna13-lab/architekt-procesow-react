# Podgląd BPMN AS-IS

Po zapisaniu procesu z obsługiwanymi danymi przycisk „Pokaż podgląd BPMN” otwiera w aplikacji diagram odczytany przez bpmn-js z tego samego modelu BPMN, którego używa przycisk pobierania pliku. Podgląd ma przyciski powiększania, pomniejszania i dopasowania, można też przesuwać i przybliżać go myszą. Jest to podgląd tylko do odczytu. Po zmianie procesu lub niezapisanej zmianie decyzji stara wersja przestaje być wyświetlana; po zapisaniu można ją otworzyć ponownie.

Obsługiwany zakres pozostaje taki jak eksport: start, zadania, koniec oraz wyłączne bramki wyboru i łączenia z opisowymi warunkami. To nie jest edytor, walidator poprawności biznesowej ani pełny BPMN; nie obejmuje torów ról i przebiegów równoległych. Dotychczasowa mapa w sekcji raportu i jej wersja drukowana nie są tym samym podglądem BPMN. Raport PDF nie zawiera dodatkowych ścieżek. Warunki nie są wykonywalnymi regułami. Weryfikacja w narzędziu zewnętrznym i testy złożonych układów pozostają otwarte. SEC-04 pozostaje otwarty.

Użyto biblioteki bpmn-js; jej informacja licencyjna jest dostępna w `public/licenses/bpmn-js.txt`, a wymagane oznaczenie projektu pozostaje widoczne na diagramie.
