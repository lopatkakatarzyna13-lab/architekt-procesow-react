# Przegląd danych warsztatowych — 17 listopada 2026

Punkt odniesienia: `e87c6df5fa3ad4081f8e7480345306371c9c68d7`. Przegląd kodu i istniejących testów; bez danych klientów, dostępu do hostowanej konfiguracji ani testu penetracyjnego. Nie jest zgodą na użycie poufnych danych. SEC-04 pozostaje otwarty.

## Ustalenia

| Obszar | Stan i następne działanie |
| --- | --- |
| Transkrypcja | Po jawnym zapisaniu pozostaje w localStorage przeglądarki w czytelnej postaci; dostęp mogą uzyskać skrypty tej samej domeny lub osoby korzystające z profilu. Dane nie są przenoszone między urządzeniami. Ustalić zasady urządzenia, retencji i danych klientów przed zastosowaniem. |
| Propozycja | Nowy format nie powiela całej transkrypcji, lecz może zawierać jej cytaty i ustalenia. Starszy format zawiera pełną kopię do czasu udanej migracji podczas odczytu. Znacznik wersji nie jest szyfrowaniem ani ochroną poufności. |
| Usuwanie warsztatu | Przycisk usuwa tekst i propozycję wybranego warsztatu po potwierdzeniu; nie usuwa kroków AS-IS ani zapisów biblioteki. W istniejących testach sprawdzono także zachowanie innego warsztatu i cofnięcie częściowego błędu. Samo usunięcie z localStorage nie dowodzi bezpiecznego skasowania kopii systemowych ani nośnika. |
| Proces i biblioteka | Przeniesione kroki oraz inne sekcje są zapisywane osobno i mogą zawierać informacje z rozmowy. W sprawdzonym interfejsie biblioteki nie stwierdzono funkcji usuwania zapisanego procesu; sposób usuwania wszystkich kopii i retencję trzeba zaprojektować i sprawdzić. Nie zakładać, że usunięcie warsztatu usuwa cały proces. |
| Usuwanie niepełne | Dotychczas przy niepowodzeniu usuwania i przywracania aplikacja ostrzegała, ale pozwalała kontynuować edycję. Przygotowano zmianę blokującą edycję w takim stanie i umożliwiającą skopiowanie widocznego tekstu; wymaga wyników CI dla commitu z poprawką. |
| Analiza AI i sesja | W kodzie analiza następuje po potwierdzeniu; sesja AI jest trzymana w pamięci, a logowanie nie szyfruje localStorage. Wstrzymanie oczekiwania nie gwarantuje zatrzymania serwera ani dostawcy. Rzeczywiste konto, MFA, uprawnienia, sekrety, retencja i warunki dostawcy nie zostały tu zweryfikowane. |
| Hostowane usługi | Projekt SQL i Edge nie były wdrożone w ramach tej pracy; faktycznej konfiguracji RLS, sekretów, nagłówków, kopii, uprawnień i ustawień kosztowych hosta nie oceniono. Nie traktować testów lokalnych jako dowodu konfiguracji produkcji. |

## Odporność i granice

Dla `e87c6df` test MVP, przeglądarki, SEC-04 i odizolowanego zakończenia procesu przeszły. Pełny test Supabase nie przeszedł: po pomyślnym teście przerwania i odzyskania pracy test Edge otrzymał 503 zamiast oczekiwanego 403 dla innego konta. To nie oznacza udzielenia dostępu; przyczyna odpowiedzi i niestabilności środowiska nie jest ustalona. Szczegóły: https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/44119223558. Wcześniejszy pełny przebieg `de74747` zakończył się sukcesem. Nie uznano obszaru odporności za formalnie zamknięty ani aplikacji za gotową do poufnych danych.

## Otwarte decyzje i prace

1. Zaprojektować czytelne, potwierdzane usuwanie procesu i jego danych wraz z omówieniem, które kopie pozostaną; zachować ochronę przed przypadkową utratą innych procesów.
2. Sprawdzić ustawienia konta, urządzenia, uprawnienia i retencję oraz warunki wybranego dostawcy; nie korzystać z prawdziwych danych ani płatnego API bez osobnej decyzji.
3. Zweryfikować faktyczne ustawienia hostowanego Supabase i sposób odtworzenia zmian przed ewentualną zgodą na wdrożenie; sam kod eksperymentalny nie jest dowodem ustawień hosta.
4. Wyjaśnić niestabilne testy pełnego Supabase na podstawie diagnostyki, gdy blokują ocenę; niezależne testy nie zastępują pełnej integracji.
