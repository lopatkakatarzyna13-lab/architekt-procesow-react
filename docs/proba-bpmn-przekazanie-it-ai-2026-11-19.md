# Próba przekazania map BPMN do IT i AI

Próba z 19 listopada 2026 r. dotyczy fikcyjnego procesu skierowania na badania wstępne. Oba warianty zaczynają się od kierownika. Kierownik i HR mają osobne tory w basenie organizacji. Osoba przyjmowana ma własny basen i otrzymuje skierowanie z HR.

## Co można odczytać z modelu

| Pytanie odbiorcy | AS-IS | TO-BE |
| --- | --- | --- |
| Gdzie powstaje brak? | Kierownik sporządza papierowe zgłoszenie w swobodnym formacie. Pole opisu warunków pracy nie jest wymagane. | Portal blokuje wysłanie bez stanowiska i opisu warunków pracy. |
| Gdzie sprawa wraca i czeka? | HR odkrywa brak po otrzymaniu zgłoszenia. Ścieżka „Nie” wraca do kierownika. W fikcyjnym przykładzie oczekiwanie wynosi do dwóch dni. | Pętla pozostaje na wypadek opisu wymagającego doprecyzowania. HR sprawdza jego treść przed wygenerowaniem skierowania. Nie ma pomiaru oczekiwania w procesie docelowym. |
| Gdzie ktoś przepisuje dane? | HR wpisuje stanowisko i warunki pracy z papieru do systemu HR. Fikcyjny czas pracy wynosi pięć minut. | System HR odczytuje zatwierdzony rekord i generuje PDF. HR odpowiada za merytoryczne sprawdzenie danych. |

**Walidacja formularza** powinna wymusić kompletność przy zgłoszeniu. Trzeba uzgodnić, jak opisać warunki pracy i jakie dane są obowiązkowe dla danej sytuacji. **Integracja** powinna przenieść zatwierdzony rekord do systemu HR. Do uzgodnienia są identyfikator sprawy, mapowanie pól i odpowiedzialność za ponowienie transferu po błędzie. **OCR lub AI** warto rozważyć dla historycznych skanów lub formularzy, których nie da się zastąpić ustrukturyzowanym wejściem. Odczyt dokumentu nadal wymaga sprawdzenia pól niepewnych przez HR. Tekst brakujący w źródle wymaga uzupełnienia przez kierownika.

Zdarzenie czasowe ma sens, jeśli pilotaż wykaże potrzebę przypomnienia lub eskalacji po uzgodnionym terminie. Kroki w tej próbie mają kolejność zależną od wyniku poprzedniego działania, więc bramka równoległa nie jest potrzebna. Podproces warto rozważyć po sprawdzeniu, czy np. akceptacja i wysyłka skierowania są powtarzalnym fragmentem innych procesów.

## Weryfikacja techniczna

- Chromium sprawdził wznowienie szkicu wraz z otwartą edycją AS-IS po zamknięciu karty, anulowanie niezapisanej zmiany, kopiowanie mapy, edycję wariantu TO-BE oraz ponowne otwarcie zapisanego TO-BE z biblioteki. Sprawdzono też podgląd, pobieranie obu plików BPMN i raport PDF.
- Oba eksporty przeszły walidację względem BPMN 2.0 XSD. Osobno uruchomiony bpmn-js Modeler 18.19.0 otworzył je bez ostrzeżeń, pozwolił zmienić nazwę zadania i zapisać oba modele ponownie. Ponowne eksporty też przeszły walidację XSD. Modeler jest odrębną aplikacją testową z tej samej rodziny narzędzi co podgląd. W bpmn-visualization 0.48.0 import odczytał zadania, lecz wykres pominął obiekty danych i ich powiązania.
- Test regresyjny obejmuje zwykłe zadanie z wcześniejszego zapisu oraz dokumenty wewnątrz liniowej mapy. Próby przeglądarkowe objęły też wcześniejszy wariant skierowania, utratę połączenia oraz wznowienie fikcyjnego warsztatu.
- Na stronach 5 i 8 raportu A4 sprawdzono graficznie obie mapy, podpisane dokumenty, ścieżki powrotne oraz podpis przekazania skierowania. Drobne podpisy na pełnej mapie najlepiej odczytywać po powiększeniu PDF-u. Szczegóły kroków w tabelarycznym układzie są zapisane także pod diagramem.
- Analizę przekazania wykonano na mapach i raporcie. Odbiór przez osobę spoza warsztatu nadal wymaga osobnej próby.

Test w repozytorium działa po uruchomieniu Vite na porcie 5173. Ustawienie `REFERRAL_WITH_POOLS=1` włącza opisany scenariusz w `tests/browser-referral-workshop.mjs`. Opcjonalne `REFERRAL_PDF_PATH` i `REFERRAL_BPMN_PREFIX` zapisują wydruki do lokalnego przeglądu.

Dokumenty są przypisane do poszczególnych kroków. Sama zbieżność nazw nie łączy obiektów danych między zadaniami. Format, kanał i reguły są opisem do wdrożenia, a eksport BPMN ma status modelu dokumentacyjnego. Zapis sprawdzono lokalnie w przeglądarce. SEC-04 i weryfikacja środowiska docelowego pozostają otwarte.
