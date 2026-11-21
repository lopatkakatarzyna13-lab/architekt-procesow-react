# Próba lokalnej transkrypcji rozmowy kadrowej

21 listopada 2026 r. · Fikcyjny proces skierowania na badania wstępne

Próba obejmowała 14 wypowiedzi dwóch syntetycznych polskich głosów, około 2 min 12 s rozmowy i 253 słowa odniesienia. Ten sam dialog sprawdzono w czystym pliku WebM oraz po dodaniu białego szumu. Oba modele uruchomiono na procesorze z Whisper.cpp 1.8.3 i zablokowaną siecią w środowisku Linux. Wyniki dotyczą tej próbki. Do sprawdzenia pozostają głosy naturalne, nakładanie się wypowiedzi i dłuższe spotkanie na laptopie z Windows.

## Co poprawiono

Wyłączone przewidywanie znaczników czasu powodowało w tej próbie pomijanie odpowiedzi zawierających m.in. warunek zatwierdzenia i regułę przypomnienia. Skrypt używa domyślnego przewidywania znaczników do ustalania granic wypowiedzi. Eksport TXT nadal zawiera sam tekst.

## Wyniki porównania

| Model i ustawienie | Błędy słów bez dodanego szumu | Błędy słów z dodanym szumem |
| --- | ---: | ---: |
| `ggml-base.bin` przed poprawką | 65,6% | 66,4% |
| `ggml-base.bin` po poprawce | 13,4% | 13,4% |
| `ggml-small-q5_1.bin` po poprawce | 5,1% | 7,1% |

Wskaźnik obejmuje pominięcia, zamiany i dodane słowa w stosunku do 253 słów dialogu. Pominięto interpunkcję i wielkość liter. Zapis „4” i „cztery” liczy się jako zamiana. W próbie z szumem sam silnik pracował około 11,5 s z modelem `base` i 34 s z modelem `small-q5_1`.

Do pilotażu wybrano `small-q5_1`. W obu wariantach zachował powrót do kierownika, termin dwóch dni roboczych, ponowną kontrolę, zakaz generowania PDF przed zatwierdzeniem i termin przypomnienia. W obu wariantach przekręcił skrót OCR. W wersji z szumem raz przekręcił też BHP, mimo że drugi raz zapisał je prawidłowo.

## Co sprawdzić przed odwzorowaniem procesu

| Ustalenie do potwierdzenia z nagraniem | Oczekiwana treść |
| --- | --- |
| Wejście | Kierownik podaje stanowisko, miejsce pracy i planowaną datę rozpoczęcia. Dołącza opis narażeń z karty stanowiska. |
| Źródło aktualnych danych | Kadry porównują kartę z rejestrem BHP. Sprawdzają wersję i nazwę stanowiska. |
| Ścieżka powrotu | Kadry zwracają zgłoszenie do kierownika. Kierownik uzupełnia ten sam formularz w ciągu dwóch dni roboczych. Kadry sprawdzają zgłoszenie ponownie. |
| Kontrola człowieka | Zatwierdza specjalistka ds. kadr. Bez zatwierdzenia system nie generuje PDF. |
| Potwierdzenie i przypomnienie | Pracownik potwierdza odbiór w portalu. Jeśli tego nie zrobi do końca następnego dnia roboczego, kadry wysyłają przypomnienie. |
| Usprawnienia | Walidacja sprawdza obowiązkowe pola. Integracja pobiera aktualną kartę z rejestru BHP. OCR służy do odczytu załączonego skanu, a wynik sprawdza człowiek. |

Porównując tekst z nagraniem, oznacz każdy punkt jako potwierdzony, wymagający korekty lub nieustalony. Sprawdź zwłaszcza skróty, zaprzeczenia i terminy. Do mapy przenieś potwierdzone ustalenia, a pozostałe zapisz jako pytania otwarte.

## Dialog do powtórzenia próby

1. **Głos A.** Zaczynamy od skierowania na badania wstępne. Zgłoszenie wysyła kierownik przez formularz w portalu kadrowym. Co musi wpisać?
2. **Głos B.** W formularzu podaje nazwę stanowiska, miejsce pracy i planowaną datę rozpoczęcia pracy. Dołącza też opis narażeń z aktualnej karty stanowiska.
3. **Głos A.** Skąd kadry mają wiedzieć, czy karta jest aktualna? Czasem kierownik wysyła kopię sprzed kilku miesięcy.
4. **Głos B.** Specjalistka do spraw kadr porównuje kartę z rejestrem BHP. Sprawdza datę wersji i zgodność z nazwą stanowiska. W portalu zaznacza wynik kontroli.
5. **Głos A.** A co robimy, jeżeli brakuje opisu narażeń albo dane na karcie się nie zgadzają?
6. **Głos B.** Kadry zwracają zgłoszenie do kierownika. Kierownik uzupełnia ten sam formularz w ciągu dwóch dni roboczych. Potem zgłoszenie wraca do kadr do ponownej kontroli.
7. **Głos A.** Czy po poprawce system może już automatycznie wygenerować skierowanie?
8. **Głos B.** Dopiero po zatwierdzeniu przez specjalistkę do spraw kadr. Jeżeli specjalistka nie zatwierdzi danych, system nie generuje pliku PDF. To ważna kontrola człowieka.
9. **Głos A.** Kto otrzymuje podpisane skierowanie i jak dowiadujemy się, że dotarło?
10. **Głos B.** Kadry wysyłają skierowanie do pracownika przez portal. Pracownik potwierdza odbiór w portalu. Jeżeli nie potwierdzi do końca następnego dnia roboczego, kadry wysyłają przypomnienie.
11. **Głos A.** Zapiszmy też propozycję usprawnienia. Obowiązkowe pola w formularzu wykryją brak daty i miejsca pracy już podczas zgłoszenia.
12. **Głos B.** Integracja z rejestrem BHP pozwoli pobrać aktualną kartę stanowiska. OCR przyda się tylko wtedy, gdy załącznikiem jest skan, z którego trzeba odczytać dane. Wynik odczytu nadal sprawdza człowiek.
13. **Głos A.** Kto zdecyduje, czy warto zamówić integrację? Na razie nie znamy liczby zgłoszeń w miesiącu.
14. **Głos B.** Właściciel procesu zbierze liczbę zgłoszeń i poprawek przez cztery tygodnie. Na tej podstawie wybierze usprawnienie razem z zespołem IT.
