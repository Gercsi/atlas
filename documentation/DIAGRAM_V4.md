# Kattintható szerverkeretek és adatközponti topológia

## Három, körbejárható elrendezés

A **Nézet frissítése** és az **Automatikus elrendezés** minden kattintáskor a következő módszerre vált: **Kompakt pókháló**, **Kapcsolati rétegek**, majd **Tömör kapcsolati térkép**. A gomb előre kiírja a következő módot, az eszköztár pedig az aktív módot. A harmadik után a sorozat újraindul. Az első betöltés nem lépteti tovább a módot, és egy objektum kijelölése, adatlapjának megnyitása vagy középpontba helyezése sem vált elrendezést.

Mindhárom módszer először a kapcsolattal rendelkező összefüggő részeket rendezi el. A kapcsolat nélküli objektumok csak a már kész mag köré kerülnek, ezért nem növelik annak sugarát vagy rétegtávolságát. A kis és közepes gráfok térköze szűkebb; a nagy, sűrű gráfoknál a router számára szükséges biztonsági tér megmarad.

A közvetlen adatbázis-kapcsolatú alkalmazás és adatbázis egy elrendezési párként mozog, köztük 26 képpontos testközzel. Ez csak akkor történik meg, ha ugyanabban a fizikai csoportban vannak; a szerver- vagy adatközpont-határt a közelségi szabály nem írja felül. Ha egy alkalmazás több adatbázishoz kapcsolódik, az első stabilan rendezett pár kapja ezt a kötést, a többi kapcsolatot a normál topológia és az akadálykerülő router kezeli.

A mentett nézet az aktív elrendezési módot is megőrzi. A kézzel rögzített pozíciók mindhárom módban kemény korlátok maradnak.

## Szerverkeretek

Szerverkeretes infrastruktúranézetben a szerver egyetlen objektumként jelenik meg. A keret tartalmazza az alkalmazásokat és adatbázisokat, de nincs benne második kék szerverdoboz. A keret kijelölhető, kereshető, összecsukható, középre helyezhető és rögzíthető; az **Adatlap megnyitása** művelet az eredeti szerverrekordot nyitja meg. Alkalmazás nélküli szerver is megmarad kattintható szerverobjektumként.

A csomópontfeliratok csak az objektum nevét mutatják. A helyezés és a szomszédszám nem kerül rá a dobozokra; a szűrt gráfból számolt információ a **Kapcsolati rangsor** lenyitható listában maradt meg.

## Adatközpontok és külső hosztolás

Az új nézet a már meglévő, adminisztrálható mezőket használja:

- az `on_premise` szerver a megadott **Adatközpont** keretébe kerül;
- a `cloud` szerver és a szerver nélküli `saas` alkalmazás lila, szaggatott **Felhő** keretet kap;
- a `hosted` szerver külső szolgáltatói keretet kap;
- az explicit `external` vagy `partner` hálózati zóna külön külső hálózati keretet kap;
- a hiányzó vagy nem besorolható hely sárga, szaggatott keretben marad.

Az Atlas nem sorol egy IP-címet automatikusan internetes vagy belső címnek, és az `on_premise` értékből sem következtet hálózati határra. A külső jelöléshez explicit hosztolási vagy zónaadat kell.

Minden hely saját **Hálózati kijárat** csomópontot kap, ha másik hellyel dokumentált kapcsolata van. A helyek közötti élek a hálózati kapcsolatrekordokból, illetve zónahatárokból készülnek. A tiltó vagy inaktív szabály látható marad, de nem használható fel az útvonalkereséshez.

Két hely kiválasztásakor a backend szélességi kereséssel megtalálja a legrövidebb dokumentált útvonalat, így köztes adatközpontokat vagy partnerhálózatot is képes kiemelni. Az útvonal helyei, kijáratai és élei narancssárga jelölést kapnak; a fejléc szövegesen is felsorolja a láncot. Ez dokumentált topológia, nem élő csomagút, tűzfal-ellenőrzés vagy elérhetőségi mérés.

Az akadálykerülő útvonalvezetés, a keresztezésjelölés, a kézi pozíciók, a teljes képernyő és a vektoros SVG/PDF-export ebben a nézetben is ugyanazt a geometriát használja. A hálózati határ irány nélküli vonal, a hálózati szabály irányított nyilat kap.

## Automatizált ellenőrzés

A backend regressziós próba igazolja, hogy:

- a szerverkeret mögött a valódi szerverazonosító és rekordtípus marad;
- a külön szervercsomópont nem jelenik meg a saját keretében;
- az alkalmazás nélküli szerver nem tűnik el;
- a belső adatközpontok és a külső felhő eltérő besorolást kapnak;
- a DC-A → DC-B → DC-C kétélű útvonal mindhárom helyet és pontosan két útvonalélt jelöl.

A TypeScript-ellenőrzés, a production build és a diagram geometriateszt a közös képernyős/export renderert ellenőrzi.

A geometriateszt külön igazolja a három eltérő elrendezést, a közvetlen alkalmazás–adatbázis közelséget és azt, hogy új kapcsolat nélküli elemek nem mozdítják el a kapcsolt magot. A sűrű próba 220 objektum és 481 összevont kapcsolat minden útvonalát ellenőrzi.
