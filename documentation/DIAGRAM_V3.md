# Diagram és kezelhetőség – 2026. augusztus 31.

## Használat

Frissítsd az alkalmazást (Ctrl+F5). A már megnyitott vagy mentett nézet régi pozícióit az **Automatikus elrendezés** gombbal rendezheted újra. A rögzített pozíciókat a frissítés továbbra sem írja felül; szükség esetén előbb oldd fel a rögzítéseket.

- **Kompakt szerverkeretek:** legfeljebb 30 látható objektumnál a tényleges csoportméretek és ütközések határozzák meg a térközt. Egy nagyobb keret nem távolít el automatikusan minden más objektumot. A közös szerveren lévő, egymással közvetlenül nem kapcsolódó alkalmazások helyi, tömör rácsot kapnak. A külső kapcsolati rangsor és a lépésszám szerinti elrendezés megmarad. A keret nélküli, korábban jól működő elrendezést megtartottuk.
- **Kattintáskor megmaradó vonalak:** az élréteget csak tényleges húzás rejti el. A Cytoscape `grab` eseménye egyszerű kattintáskor is bekövetkezik, a `dragfree` azonban csak mozgatás után; a korábbi kód ezért elrejthette a vonalakat egy sima kattintás után. A `drag`/`free` kezelés ezt javítja. Kijelölés nem indít elrendezést és nem rögzít pozíciót.
- **Teljes képernyő:** külön gomb, külön az ábra illesztésétől. A szűrők, kereső, nagyítás, kicsinyítés és export megmaradnak. Kilépés Esc-pel vagy ugyanazzal a gombbal. Az adatlap megnyitása előbb kilép a teljes képernyőből, hogy a normál adatlapablak látható legyen. Ha a böngésző tiltja a natív Fullscreen API-t, az alkalmazás a teljes rendelkezésre álló böngészőterületet tölti ki.
- **Összecsukható navigáció:** gomb a bal felső logó alatt. Ikonos állapotban is van felirat/tooltip és billentyűzettel elérhető navigáció. A tartalom a felszabaduló helyet használja. A választás helyi felületi beállításként megmarad; CMDB-adat nem kerül a localStorage-ba.
- **Oktató:** új menüpont, 12 lépéssel. Áttekintés, szerver, alkalmazás, adatbázis, integráció, kapcsolattartó, diagram, import/export, adatminőség, zónák, szótárak és felhasználók. A szerkeszthető mintarekordok, a kapcsolatirány-váltás és a mintaszerepkör csak memóriában élnek. Nincs oktatási API-írás és nem keletkezik valódi felhasználó. Az adminisztráció leírása mindenki számára olvasható, a valódi adminoldalakra vezető gomb csak adminnak jelenik meg.

## Export

**SVG:** önálló vektoros rajz, beágyazott betűkészletekkel. Minden objektum, felirat, nyíl és keresztezési megszakítás vektoros. Nem tartalmaz beágyazott diagramképet vagy külső betűkészlet-hivatkozást. A szövegek XML-escape-elve kerülnek bele.

**PDF:** valódi vektoros PDF, kijelölhető/kereshető szöveggel és beágyazott normál/félkövér Liberation Sans betűkészlettel. A magyar ő/ű karakterek megmaradnak. A csomópontok nyilvános Cytoscape-geometriájából és a képernyőn használt útvonalakból készül; nem a képernyő pillanatnyi nagyításának raszterképét menti. Az export elején pillanatfelvétel készül a geometriáról, így a közben végzett mozgatás nem keveredhet bele.

**PNG:** továbbra is képpontos formátum. Megmaradt a teljes diagram/látómező, fehér/átlátszó háttér és 1×/2×/3× képméret. A memóriahatár miatt a rajz legfeljebb körülbelül 4000×3800 pixelre készül. Nagyítható archiváláshoz az SVG vagy PDF ajánlott. Kis képeken a lábléc sorai most tördelődnek, nem lógnak ki.

A PDF A4/A3 fekvő lapra illeszthető vagy természetes méretből kiindulva csempézhető. A képméret-szorzó csak a PNG-re vonatkozik. A PDF fehér hátterű; az SVG lehet átlátszó. A lábléc jelzi a megrajzolt és sikertelen útvonalak számát. Mindhárom formátum a már kiszámított útvonalakat exportálja, nem indít új elrendezést.

### Korlátok

- A teljes 200 objektumos ábra áttekintő nézetében a feliratok továbbra is kicsik lehetnek. SVG-ben és PDF-ben nagyíthatók, nem pixelesednek. A vektoros formátum nem rendez át automatikusan egy megnyitott dokumentumot.
- A csempézés megőrzi a koordinátákat, ezért a lapváltás objektumot vagy feliratot is kettévághat. Az oldalszám, sor és oszlop segít összeilleszteni a lapokat. Legfeljebb 64 oldal készíthető; ennél nagyobb kérésnél látható hiba jelenik meg, nincs csendes csonkítás.
- A sűrű hálózatnál megmaradnak a v2 útvonalvezetési kompromisszumai: háttérszálas, közelítő keresés; néhány élcímke csak a tooltipben és részletlistában fér el. A kapcsolat ilyenkor látható marad. A kézi rögzítés elsőbbséget élvez a tömör elrendezéssel szemben.

## Ellenőrzés

- `pnpm check`, `pnpm build`, `pnpm test:diagram` sikeres.
- Új regressziós hálózat: 7 alkalmazás, 5 keret, az egyik keretben 3 alkalmazás; kompakt mérethatár, csoportütközés-mentesség, rögzítés, rangsor és mind a 6 útvonal ellenőrizve. Keret nélküli párja külön próba.
- Megmaradt a 10/7 szomszédos rangsor, a több komponens, ellenirány, összevonás, önhivatkozás, beágyazott zóna és a 100 szomszédos szerver tesztje.
- Böngészőben valódi mutatókattintás után is látható maradt a 6 él, új elrendezés és pozíciórögzítés nélkül. Teljes képernyő, Esc, menüösszecsukás és oktatói mintaűrlapok kipróbálva a közös alkalmazáskomponensekkel.
- A kereszteződési próba SVG-jének **mind a 7 útvonal- és nyílgeometriája pontosan megegyezik a látható SVG-réteggel**.
- Az egy objektumos, kereszteződési, kétoldalas csempézett és 200 objektumos PDF-ekben **0 raszterkép** található. Magyar szövegkinyerés és vizuális PDF-renderelés ellenőrizve. A 200 objektumos PDF nagyított részletét 1200 DPI-s renderrel is vizsgáltuk.
- A 200 objektum / 20 keret / 500 nyers integráció próbában **481/481 összevont kapcsolat** kapott útvonalat. A helyi Chromium 1280×720-as, 10 másodperces pan/zoom próbáiban **26–52 FPS medián**, **0 darab 200 ms feletti képkocka** adódott. A 3 teljes újrarajzolást is végző mérés p95 ideje **13,5 másodperc**, háttérszálon. A sűrű próba tehát nem garantált 60 FPS; a mérési jegyzőkönyv a terhelés alatti eredményt is tartalmazza.

A próbák elkülönített, szintetikus `proof.html` adatokkal futnak. A helyi CMDB adatbázisát, felhasználóit és backend jogosultságait ez a módosítás nem érinti. A próbaoldal az alkalmazás valódi Diagram, AppSidebar és Tutorial komponenseit használja; nem kerül meg bejelentkezést.

## Függőségek és források

- [Cytoscape események](https://js.cytoscape.org/#events/user-input-device-events): kattintás, húzás és elengedés eltérő eseményei.
- [svg2pdf.js](https://github.com/yWorks/svg2pdf.js): a projekt jsPDF motorjához illeszkedő, böngészős vektoros SVG → PDF átalakítás. Verzió: 2.7.0, MIT licenc. Csak a saját, kontrollált renderer SVG-jét kapja, tetszőleges feltöltött SVG-t nem.
- [Liberation Fonts](https://github.com/liberationfonts/liberation-fonts): Arial-metrikákkal kompatibilis betűcsalád; a szükséges fájlok és a SIL OFL licenc a `frontend/assets/fonts` könyvtárban vannak. Export közben nincs internetes fontletöltés.
