# Zintegrowana próba uwierzytelnienia, limitu i fikcyjnej analizy

Punkt bazowy: 387ba90d74fb786f9c0393bb7021dbb2a44d6a20. SEC-04: OTWARTY.

W odizolowanym CI rozszerzono lokalną bramkę testową o sprawdzenie rzeczywistej sesji Supabase Auth i atomową rezerwację w tymczasowej bazie PostgreSQL przed uruchomieniem fikcyjnej analizy. Testy mają potwierdzić odmowę bez uprawnień, wygasłą sesję, odnowienie, limit przy jednoczesnych żądaniach oraz blokadę przy błędzie bazy. Wszystkie konta i dane są fikcyjne; test odrzuca adresy usług poza komputerem lokalnym.

To wyłącznie kod testowy i tymczasowa tabela bez danych użytkownika. Nie wdrożono publicznego endpointu, funkcji Edge, RLS, limitu godzinowego, kontroli kosztów dostawcy ani integracji aplikacji. Wynik należy potwierdzić w GitHub Actions; w środowisku lokalnym nie ma Dockera. Nie korzystać z danych klientów ani prawdziwego API na podstawie tego testu.
