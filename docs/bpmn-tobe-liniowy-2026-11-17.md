# Pierwszy wariant BPMN TO-BE

Zapisana lista kroków TO-BE może być pokazana, pobrana jako `proces-tobe.bpmn` i dołączona do raportu PDF. Model przedstawia kroki w kolejności listy, ze zdarzeniami o ogólnych nazwach „Początek” i „Koniec”. Nie przenosi z AS-IS decyzji, dodatkowych przejść, torów, basenów ani wiadomości; nie przenosi również opisów, ról i systemów jako elementów BPMN. Nie jest wykonywalny. Po zmianie TO-BE podgląd znika, a eksport wymaga ponownego zapisu.

To wariant liniowy, a nie pełny edytor BPMN TO-BE. Jeżeli w zapisanych danych pojawi się nieobsługiwana struktura BPMN, eksport jest blokowany zamiast ją po cichu pomijać. PDF opisuje ten zakres i wskazuje, jeśli diagramu nie udało się utworzyć. Przyszłe prace obejmują świadome określanie decyzji, powrotów i współpracy zewnętrznej w procesie docelowym oraz ich niezależną weryfikację. Zgodność XSD nie potwierdza poprawności biznesowej.
