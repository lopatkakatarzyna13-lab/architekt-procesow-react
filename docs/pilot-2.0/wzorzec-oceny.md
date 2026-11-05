# Wzorzec oceny analizy warsztatów — pilot 2.0

## Cel i sposób użycia

Ten dokument opisuje oczekiwane wyniki trzech fikcyjnych warsztatów. To wzorzec do oceny przez człowieka, a nie wynik działania modelu ani potwierdzenie, że przeprowadzono test z API.

1. Do aplikacji wklej tylko sekcję „Transkrypcja” z jednego pliku scenariusza, bez sekcji „Wzorzec oceny” i bez tego dokumentu.
2. Zapisz datę, nazwę modelu, jego konfigurację oraz pełną odpowiedź. Powtórz osobno dla trzech scenariuszy. Nie wklejaj danych klientów.
3. Dla każdego punktu oznacz: **TAK** — wynik oddaje istotę, **CZĘŚCIOWO** — informacja jest niepełna, **NIE** — brakuje informacji lub jest błędna. Synonimy są dopuszczalne; musi zgadzać się znaczenie.
4. Zaznacz osobno błąd krytyczny, pytania otwarte, ocenę cytatów i istotne różnice. Wynik należy sprawdzić w kontekście całej wypowiedzi, nie tylko obecności cytatu.
5. Ten sam materiał i te same kryteria zastosuj przy każdym kolejnym teście. Ostateczna ocena należy do osoby prowadzącej warsztat.

**Ograniczenie obecnej funkcji:** analiza zwraca listy kroków, ról, decyzji i pytań. Nie zapisuje jeszcze formalnych połączeń pomiędzy krokami ani nie generuje BPMN. Warunki i zależności można dziś ocenić tylko na podstawie tekstu odpowiedzi; pełną ocenę przepływów wykonamy po dodaniu modelu połączeń.

## Zasady oceny

- **Kompletność:** w każdym scenariuszu licz TAK, CZĘŚCIOWO i NIE według punktów poniżej. Cel pilota: co najmniej 80% punktów TAK w każdym scenariuszu; CZĘŚCIOWO nie liczy się jako TAK.
- **Błąd krytyczny:** stwierdzenie niepotwierdzonego działania jako faktu, pominięcie lub odwrócenie wskazanej decyzji prowadzące do błędnego przebiegu, albo przypisanie odpowiedzialności niewłaściwej roli. Wystąpienie choć jednego błędu krytycznego oznacza, że scenariusz nie przechodzi, niezależnie od wyniku procentowego.
- **Cytaty:** każdy element oznaczony jako oparty na rozmowie musi mieć dokładny cytat z tekstu i dawać się nim merytorycznie uzasadnić. Zgodność cytatu znak po znaku sprawdza obecna walidacja; ocenę znaczenia wykonuje człowiek. Brak lub błędny cytat oznacza NIE dla danego punktu.
- **Braki:** co najmniej jedno wskazane dla scenariusza pytanie otwarte musi zostać rozpoznane jako brak informacji lub pytanie. Nie musi mieć identycznego brzmienia.
- **Ocena całego pilota:** wszystkie trzy scenariusze muszą osiągnąć cel kompletności i rozpoznać wymagany brak, bez błędów krytycznych. To wstępna próba na fikcyjnych danych, nie dowód jakości w każdych rzeczywistych warunkach.

## 1. Przygotowanie pierwszego dnia pracy

Źródło: [01-onboarding.md](01-onboarding.md), wyłącznie sekcja „Transkrypcja”.

| Nr | Oczekiwane ustalenie | Podstawa w wypowiedzi | Ocena |
|---|---|---|---|
| 1 | Menedżer przekazuje HR informację o przyjęciu oferty i dacie rozpoczęcia. | Wypowiedź 2 | ☐ |
| 2 | HR prosi nową osobę o potrzebne dane i dokumenty. | Wypowiedź 3 | ☐ |
| 3 | Po otrzymaniu dokumentów HR przygotowuje dokumenty zatrudnienia i osobno zleca IT przygotowanie konta i laptopa. | Wypowiedź 4 | ☐ |
| 4 | IT przygotowuje konto i laptop oraz informuje HR o gotowości. | Wypowiedź 5 | ☐ |
| 5 | HR umawia podpisanie dokumentów oraz pierwszego dnia przekazuje pracownikowi dokumenty i informację o odbiorze laptopa. | Wypowiedź 6 | ☐ |
| 6 | Menedżer przeprowadza rozmowę wprowadzającą. | Wypowiedź 8 | ☐ |

**Sprawdź brak informacji:** co, jeśli laptop lub dostęp nie jest gotowy pierwszego dnia?

**Przykłady błędu krytycznego:** wymyślenie, że IT podpisuje dokumenty zatrudnienia; przedstawienie gotowości IT jako warunku umówienia podpisania, choć rozmowa tego nie ustala.

## 2. Przekazanie danych do biura rachunkowego

Źródło: [02-dane-do-biura.md](02-dane-do-biura.md), wyłącznie sekcja „Transkrypcja”.

| Nr | Oczekiwane ustalenie | Podstawa w wypowiedzi | Ocena |
|---|---|---|---|
| 1 | Menedżerowie przekazują HR dane o nieobecnościach i zatwierdzonych premiach do piątego dnia miesiąca. | Wypowiedź 2 | ☐ |
| 2 | HR przygotowuje zestawienie i sprawdza kompletność. | Wypowiedź 3 | ☐ |
| 3 | Gdy czegoś brakuje, HR prosi odpowiedniego menedżera o uzupełnienie. | Wypowiedź 5 | ☐ |
| 4 | Po uzupełnieniu HR ponownie sprawdza kompletność. | Wypowiedź 5 | ☐ |
| 5 | Kompletne zestawienie HR przekazuje do biura, a biuro potwierdza odbiór. | Wypowiedzi 6–7 | ☐ |

**Sprawdź brak informacji:** nie ma ustalonej ścieżki eskalacji, gdy menedżer nie odpowiada przed terminem [8–9].

**Przykłady błędu krytycznego:** twierdzenie, że biuro otrzymuje niekompletne dane; podanie piątego dnia jako ustalonego terminu wysyłki do biura; wymyślenie osoby odpowiedzialnej za eskalację.

## 3. Korekta danych pracownika

Źródło: [03-korekta-danych.md](03-korekta-danych.md), wyłącznie sekcja „Transkrypcja”.

| Nr | Oczekiwane ustalenie | Podstawa w wypowiedzi | Ocena |
|---|---|---|---|
| 1 | Pracownik zgłasza błąd do HR, które sprawdza sprawę i dokument potwierdzający. | Wypowiedź 2 | ☐ |
| 2 | Jeżeli brakuje dokumentu, HR prosi pracownika o jego dostarczenie i czeka na odpowiedź. | Wypowiedź 3 | ☐ |
| 3 | Po otrzymaniu potwierdzenia HR wprowadza korektę w systemie kadrowym. | Wypowiedź 4 | ☐ |
| 4 | Druga osoba z HR porównuje zmianę z dokumentem. | Wypowiedź 6 | ☐ |
| 5 | Jeżeli kontrola wykryje błąd, pierwsza osoba HR poprawia zmianę i przekazuje ją ponownie do kontroli. | Wypowiedź 6 | ☐ |
| 6 | Jeżeli kontrola nie wykryje błędu, HR informuje pracownika o zakończeniu sprawy. | Wypowiedź 7 | ☐ |

**Sprawdź brak informacji:** czy aktualizacja w innych systemach jest automatyczna? Rozmówczyni tego nie wie [8–9].

**Przykłady błędu krytycznego:** przypisanie IT wprowadzenia korekty jako ustalonego kroku; pominięcie powtórnej kontroli po wykryciu błędu; stwierdzenie, że synchronizacja z innymi systemami jest automatyczna.

## Karta wyniku — do uzupełnienia po teście

| Scenariusz | TAK / liczba punktów | Wymagany brak rozpoznany | Błąd krytyczny | Wynik |
|---|---:|---|---|---|
| 1. Pierwszy dzień pracy | — / 6 | — | — | Nie testowano |
| 2. Dane do biura | — / 5 | — | — | Nie testowano |
| 3. Korekta danych | — / 6 | — | — | Nie testowano |

Data i model: nie testowano. Koszt: nie testowano. Uwagi oceniającej: do uzupełnienia.
