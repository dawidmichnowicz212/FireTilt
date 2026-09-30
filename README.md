# FireTilt

Projekt zaliczeniowy z przedmiotu **Naturalne Interfejsy Użytkownika**.

Autor: **Dawid Michnowicz**

## O projekcie

FireTilt to prosta gra strażacka uruchamiana w przeglądarce. Gra jest wyświetlana na komputerze, a telefon działa jako kontroler ruchowy.

Sterowanie odbywa się przez przechylanie telefonu w lewo i w prawo. Ruch telefonu jest przesyłany do komputera i na jego podstawie obracana jest prądownica zamontowana na dachu wozu strażackiego. Celem jest ugaszenie wszystkich pożarów znajdujących się na planszy.

Chciałem w ten sposób wykorzystać telefon jako naturalny interfejs zamiast sterowania myszką albo klawiaturą.

## Jak uruchomić

Projekt najlepiej uruchamiać przez **GitHub Pages**, czyli z normalnego adresu HTTPS. Nie polecam uruchamiania gry przez dwuklik na lokalnym pliku `index.html`, ponieważ przeglądarki w telefonach mogą wtedy blokować dostęp do czujników ruchu albo część funkcji połączenia.

Po wrzuceniu projektu na GitHub Pages:

1. Otwórz stronę gry na komputerze.
2. Na ekranie pojawi się kod QR oraz kod pokoju.
3. Zeskanuj kod QR telefonem.
4. Na telefonie zezwól na dostęp do czujników ruchu.
5. Trzymaj telefon poziomo i naciśnij **Wycentruj**.
6. Po połączeniu można rozpocząć grę.

Jeżeli QR nie zadziała, kontroler można otworzyć ręcznie i wpisać kod pokoju pokazany na komputerze.

## Sterowanie

Telefon powinien być trzymany poziomo.

- przechylenie telefonu w lewo - prądownica obraca się w lewo,
- przechylenie telefonu w prawo - prądownica obraca się w prawo,
- **Wycentruj** - zapisuje aktualne ułożenie telefonu jako pozycję środkową.

Po obróceniu telefonu do innej orientacji kontroler wymaga ponownego wycentrowania. Dzięki temu sterowanie nie przeskakuje nagle w drugą stronę.

Do testów na komputerze zostawiłem też sterowanie klawiaturą za pomocą `A/D` albo strzałek.

## Jak działa gra

Do odczytu ruchu telefonu wykorzystane jest `DeviceOrientation API`. Odczyt z telefonu jest przeliczany na wartość sterującą i przesyłany do komputera przez PeerJS/WebRTC.

Na komputerze ta wartość ustawia kąt prądownicy. Ruch jest lekko wygładzany, żeby niewielkie drgania ręki nie powodowały ciągłego szarpania.

Woda jest generowana w postaci cząsteczek. Każda cząsteczka ma własną pozycję i kierunek ruchu, a trafienie nią w obszar pożaru zmniejsza jego intensywność. Ogień, dym, iskry i para są animowane w Canvasie.

Elementy planszy, takie jak budynki, drzewa, wóz strażacki czy hydrant, są zapisane jako osobne pliki SVG w katalogu `assets`.

## Wykorzystane technologie

- HTML i CSS,
- JavaScript,
- HTML5 Canvas,
- DeviceOrientation API,
- PeerJS / WebRTC,
- QRCode.js,
- grafiki SVG.

## Grafika

Część grafik użytych w projekcie została przygotowana z pomocą narzędzi AI, a następnie dopasowana do wyglądu i potrzeb gry. Animacje ognia, dymu, iskier, wody oraz sama logika rozgrywki są realizowane w kodzie JavaScript.

## Uwagi

Na iPhonie Safari wymaga osobnego zezwolenia na dostęp do danych z czujników ruchu, dlatego na ekranie kontrolera znajduje się przycisk do ich włączenia.

Do połączenia telefonu z komputerem oba urządzenia powinny mieć dostęp do Internetu. GitHub Pages jest najwygodniejszym sposobem uruchamiania projektu, ponieważ strona działa wtedy przez HTTPS i nie trzeba nic instalować na telefonie ani komputerze.
