# Kapcsolatalapú diagram és akadálykerülő útvonalak

> A v3 frissítés kompakt keretes elrendezést, vektoros SVG/PDF-exportot, teljes képernyőt és kezelhetőségi javításokat hozott. Aktuális használat és tesztek: [DIAGRAM_V3.md](DIAGRAM_V3.md). Az alábbi v2 exportleírás és mérés történeti állapot.

## Motorvizsgálat és döntés

A Cytoscape.js megmaradt a csomópontok, csoportok, kijelölés, húzás, pan/zoom és minitérkép motorjaként. A beépített `round-taxi` legfeljebb két látható törést kezel, és az újravezetése közelítő; nem oldja meg a tetszőleges objektumhalmaz kerülését. A `segments` vezérlőpontjaihoz szintén külön akadálykeresés szükséges. Forrás: [Cytoscape.js edge styles](https://js.cytoscape.org/#style/edge-line).

Megvizsgáltuk a külön WASM-os Libavoid irányt is: [Adaptagrams](https://www.adaptagrams.org/documentation/libavoid.html), [libavoid-js](https://github.com/Aksem/libavoid-js). A jelenlegi, beágyazott csoportoknál kapcsolatonként eltér, mely csoporthatárok keresztezhetők. Emiatt így is külön csoportkapu-logika és export renderer kellett volna. A projekt saját, tiszta TypeScript elrendező/útvonalvezető modult kapott, külső bináris és új runtime függőség nélkül.

## Használat és elrendezés

- A rangsor kizárólag a megjelenített, szűrt gráfból készül. A többszörös integráció és az ellenirány egy adott szomszédot nem számol többször.
- Szervernézetben szerver, alkalmazásnézetben alkalmazás lehet automatikus központ. Az infrastruktúranézetben a látható szerverek/alkalmazások közül választ. A stabil holtversenyt az objektumazonosító dönti el.
- A csomópont felirata és a lenyitható rangsor mutatja a helyezést és szomszédszámot; a lista a kapcsolati lépésszámot is megadja. A közvetlen szomszédok az első, a többlépéses objektumok a külső gyűrűkre kerülnek. A komponenseket ütközésmentes térbeli csomagolás választja szét.
- Az `Automatikus elrendezés` újrarendez, a `Középpontba helyezés` felülírja az automatikus központot. Az `Automatikus központ` visszaállítja a fokszám szerinti választást.
- A húzott objektum automatikusan rögzített lesz. A rögzítés objektumonként vagy egyben feloldható. Csoport húzásakor a benne lévő levelek rögzülnek.
- A mentett nézet 2-es sémája pozíciót, rögzített ID-ket és központ-felülbírálást tárol. Régi mentett nézetnél a pozíciókat rögzítésként vesszük át, hogy a korábbi munka megmaradjon; teljes újrarendezéshez előbb oldd fel őket.

## Útvonalvezetés

A Web Worker 12 egységgel növelt objektumakadályok között keres derékszögű útvonalat. Rövid L/Z jelöltek után adaptív 14/28/42 egységes keresőrácsot próbál. A forrás és cél saját felmenő csoportjai kapcsolatonként átjárhatók, idegen csoportok és minden fejléc/felirat akadály.

Minden végpont külön kerületi portot kap. Az alap párhuzamos távolság 7 egység, a szűk csatornákban legalább 3,5. A vonal nem futhat megkülönböztethetetlenül egy másik szakaszon. A nyílhegy a tényleges célhatárra mutató külön poligon.

A merőleges keresztezésnél az egyik vonalból 10 egységes, valóban átlátszó szakasz hiányzik. Ez átlátszó PNG-n sem fehér maszkolás. A jelmagyarázat megmagyarázza, hogy a megszakítás keresztezés, nem csomópont.

Az összevont él elsőbbséggel kis `N×` jelvényt kap. A tooltip, részletpanel és akadálymentes kapcsolati lista megmutatja az irányt, a darabszámot és a mögöttes kapcsolatokat. A felirat csak akkor kerül a vonalra, ha sem objektumot, sem másik vonalat/feliratot nem takar.

Ha nem található elkülönülő útvonal, nincs objektumokon átvágó tartalék egyenes: a felület és az export összesítője hibaként jelzi, a kapcsolat a részletlistában megmarad.

## Stabil működés és export

Adat-/szűrőfrissítés, explicit automatikus elrendezés és központváltás rendezhet. A keretösszecsukás újrarajzol, de a többi objektum pozícióját visszaállítja. Kijelölés, tooltip, pan/zoom és adatlapnyitás nem rendez. Húzás után csak az útvonalak számolódnak újra.

A képernyő, PNG és PDF ugyanazt a pontlistát, nyilat, címkedobozt és átlátszó keresztezési megszakítást rajzolja. Az export a Cytoscape csomópontképével kompozitálja ezt, azonos koordinátatranszformációval. A teljes/viewport, fehér/átlátszó PNG, A4/A3 és illesztett/csempézett PDF megmaradt. A lábléc tartalmazza a megrajzolt és hiányzó útvonalak számát.

Mozgatáskor az élek gyorsítótárazott PNG-előnézete látszik; 160 ms nyugalom után visszatér a pontos vektoros réteg. A koordináták frissítése nem indít teljes Vue-újrarajzolást. Az export mindig a pontos geometriát használja.

## Tesztek és mért kompromisszumok

`pnpm test:diagram`: ortogonalitás, idegen objektum/csoport/felirat kerülése, tényleges végpont, egymásra futó szakaszok tiltása, szűrt rangsor, több komponens, rögzítés, kézi központ, beágyazott zónák, önhivatkozás, ellenirány, aggregáció és szándékosan lehetetlen elhelyezés ellenőrzése.

- A 200 üzleti objektumos, 20 keretes és 500 nyers integrációs fixture-ben **481 összevont élből 481 kapott útvonalat**.
- A 100 közvetlen szomszédos szerverhub mind a 100 kapcsolatának külön végpontja van; a geometriai teszt 0,4 másodperc alatt futott.
- A 481 útvonalat és több mint 3500 keresztezést tartalmazó szélsőséges fixture újraszámítása **kb. 6–7 másodperc** (3 ismétlésben 6060 ms p95), háttérszálon. A felület közben reagál és készültségszámlálót mutat. Húzás után jelenleg a teljes útvonalkészlet újraszámolódik.
- A helyi beágyazott Chromiumban, 1280×720-on mért sűrű pan/zoom **34 FPS medián**, **0 darab 200 ms feletti képkocka**. Ez nem 60 FPS; a kevésbé sűrű nézet lényegesen könnyebb feladat.
- A sűrű fixture-ben **140 élcímke** nem fér a vonalra átfedés nélkül. Teljes szöveg és darabszám ilyenkor is elérhető a tooltipben/részletlistában. Ez szándékos kompromisszum, nem eltűnt kapcsolat.
- A keretek megtartása és a rögzített pozíciók elsőbbséget kapnak a tökéletes körszimmetriával szemben. Egyazon szerverhez tartozó, logikailag külön komponensek fizikailag közös keretben maradnak.
- Az útvonalkeresés és keresztezésszám-csökkentés közelítő, korlátos keresés; nem garantál globális minimumot vagy minden tetszőleges kézi elhelyezés mellett megoldást. Sikertelenséget mindig láthatóan jelez.
- A PDF továbbra is raszteres, legfeljebb körülbelül 4000×3800 rajzpixeles képből készül. A teljes 200 objektumos hálózat egyetlen lapra zsugorítva nem tesz minden feliratot olvashatóvá; ehhez szűkebb nézet vagy csempézés szükséges.

Az adatbázis, az importált ügyféladatok, a felhasználók és a backend jogosultságok nem változtak. A böngészős tesztek a valódi Diagram komponenst használó, kizárólag szintetikus `proof.html` oldalon futottak.
