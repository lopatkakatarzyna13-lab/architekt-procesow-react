# Lokalny Supabase — odnowienie i zakończenie sesji

Punkt wyjścia: a2c2c65e85c69d0646a374549b2e674317a986e6. Status SEC-04: OTWARTY.

Rozszerzono test w izolowanym Supabase o faktyczne odnowienie sesji testowego użytkownika po wygaśnięciu tokenu dostępu. W ramach scenariusza nowy token powinien zostać poprawnie zweryfikowany i dopuszczony przez testową bramkę do fikcyjnej analizy. Po globalnym wylogowaniu test próbuje odnowić sesję tym samym tokenem odświeżania i oczekuje odmowy.

Próba działa wyłącznie w GitHub Actions na tymczasowym lokalnym Supabase, bez prawdziwego konta i bez OpenAI. Przebieg należy oceniać dopiero po odczytaniu wyniku CI dla konkretnego commitu. Bramka jest częścią testu, nie jest docelową funkcją Edge i nie jest podłączona do aplikacji. Odmowa odświeżenia nie oznacza, że wszystkie już wydane tokeny dostępu przestają być natychmiast ważne. Nie sprawdzono zarządzania sesją w przeglądarce, MFA, RLS, aktualnej konfiguracji kont, produkcyjnego API, limitów ani kosztów.

## Potwierdzony wynik

[GitHub Actions — Supabase Auth](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42508523071) dla commitu `b1ee33597c8d71e28c304df38d95a177bc2e4f1d`: sukces. Test potwierdził wygaśnięcie sesji, odnowienie i dostęp do testowej bramki oraz odmowę ponownego użycia tokenu odświeżania po wylogowaniu. Również [walidacja SEC-04](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42508523076) i [testy MVP](https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42508523055) przeszły. Ograniczenia testu przedstawione wyżej nadal obowiązują.
