# Eksport decyzji i powrotów w BPMN

Po dodaniu alternatywnego połączenia użytkowniczka wpisuje dla danego kroku pytanie decyzji oraz warunek przejścia do kolejnego kroku w podstawowej kolejności. Opisy dodatkowych przejść pochodzą z wcześniej wprowadzonych połączeń. Następnie zapisuje decyzję oraz proces AS-IS. Eksport jest zablokowany, jeśli decyzja jest nieuzupełniona, niektóre odwołania są błędne, warunki wyjścia mają identyczne nazwy lub formularz jest niezapisany. Zmiany formularza są chronione przed niezamierzonym opuszczeniem i nadpisaniem.

Eksporter tworzy bramkę wyłączną (XOR) rozdzielającą przepływ oraz — gdy do kroku dochodzi kilka przepływów — bramkę wyłączną łączącą. Warunki są nazwami przepływów, a nie wykonywalnymi wyrażeniami; proces jest oznaczony jako niewykonywalny. Eksport obejmuje węzły, połączenia i BPMN DI. Zawartość należy merytorycznie sprawdzić: program nie potrafi potwierdzić, że warunki wzajemnie się wykluczają i obejmują wszystkie przypadki.

Dalej nie ma edytora/odczytu BPMN w aplikacji, torów ról, warunków maszynowych, równoległych ścieżek ani dowodu interoperacyjności z konkretnym zewnętrznym programem. Obecna mapa w aplikacji nadal nie jest mapą BPMN; bramki powstają w pobieranym pliku, natomiast PDF nie zawiera dodatkowych ścieżek. Walidacja XSD i odczyt nie stanowią potwierdzenia poprawności biznesowej. SEC-04 pozostaje otwarty.
