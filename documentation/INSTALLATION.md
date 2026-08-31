# Első indítási telepítés

## Állapotok

| Állapot | Felület / viselkedés |
| --- | --- |
| Nincs privát konfiguráció | Adatbázis-telepítő, működő adatbázis-kapcsolat nélkül is |
| Új adatbázis és séma kész, nincs felhasználó | Első admin felhasználóneve, jelszava és jelszómegerősítése |
| Van konfiguráció és felhasználó | Normál bejelentkezés |
| Van, de hibás a konfiguráció / nem érhető el az SQL | Hiba; nincs újratelepítés vagy automatikus felülírás |

A `GET /session` válasz `installation_required` és `setup_required` mezői vezérlik ezt. A `POST /install` CSRF-védett, kizárólag hiányzó konfiguráció mellett érhető el. A meglévő `POST /setup` létrehozza az első admint; a tranzakciós revíziózár és az ismételt ellenőrzés megakadályozza két első admin párhuzamos létrehozását.

## Telepítő

1. Ellenőrzi a PHP-verziót, bővítményeket, a bemeneti mezőket és a privát tároló helyét.
2. Kizáró fájlzárat fog a konfiguráció mappájában, majd ismét ellenőrzi, hogy nincs konfiguráció.
3. SQL-adminnal csatlakozik a helyi szerverhez. `CREATE DATABASE` parancsot futtat, szándékosan `IF NOT EXISTS` nélkül: meglévő, akár üres adatbázist sem foglal el.
4. Létrehozza a sémát és az alap szótárakat. Nem importál Excelt vagy demórekordokat.
5. Véletlen SQL-felhasználót és 256 bites véletlen jelszót generál. Csak a létrehozott adatbázisra ad SELECT/INSERT/UPDATE/DELETE/CREATE/ALTER/INDEX/REFERENCES jogokat. Az adatbázisnév aláhúzásait a GRANT-mintában escape-eli.
6. Az új fiókkal külön kapcsolódik, és ellenőrzi az üzleti táblák, valamint a users tábla ürességét.
7. Privát ideiglenes fájlból aktiválja a konfigurációt. Az SQL-admin jelszavát nem tárolja, hibanaplóba sem írja.
8. A felület az első admin létrehozására vált. A worker automatikusan észleli a konfigurációt.

Az SQL-szerver és a PHP/Composer/frontend-függőségek telepítése előfeltétel, nem a varázsló feladata. Az SQL-adminnak az új adatbázisra adható jogok mellett CREATE DATABASE és CREATE USER jogosultság szükséges. A varázsló helyi címeket fogad el; a szervernek a választott címen/porton figyelnie kell.

## Adatvédelem és hibák

Az alkalmazás localhost/loopback címet és helyi klienscímet vár. A módosító kérésekhez a helyi session CSRF-tokenje szükséges. Az első admin jelszava legalább 12 karakter, legfeljebb 72 UTF-8 bájt; hash formájában kerül az adatbázisba. A telepítési fázis nem helyettesít operációsrendszer-hozzáférésvédelmet: a megbízható helyi felhasználó fejezze be a beállítást.

A konfiguráció alapértelmezett helye a projekten kívüli `<projekt>-private/config.json`; ismert Apache webroot mappákból (`htdocs`, `www`, `html`, `wwwroot`) még egy szinttel feljebb kerül. A `CMDB_CONFIG` abszolút útvonallal felülírja ezt. A tároló nem lehet a projektben vagy a webszerver publikus gyökerén belül. Egyedi webszerver-/symlink-elrendezésnél az üzemeltető ellenőrizze, hogy másik alias sem szolgálja ki a privát mappát. Windows alatt az NTFS-jogokat külön kell korlátozni.

A telepítő nem használ DROP DATABASE műveletet. Mivel a DDL nem egy visszagörgethető üzleti tranzakció, félbeszakadt telepítés után új, részlegesen létrehozott adatbázis/fiók megmaradhat. A konfiguráció csak a sikeres ellenőrzés után aktiválódik. Az SQL-admin ellenőrizze a részleges állapotot; új próbához válasszon másik adatbázisnevet. A konfigurációs fájl kézi törlése nem támogatott újratelepítési eljárás.

## Ellenőrzés, 2026-08-31

`tests/installer.php`: **53 sikeres ellenőrzés**, valódi HTTP-kérésekkel és elkülönített SQL-adatbázisokkal. Lefedés:

- adatbázis nélküli indulás, PHP-előfeltételek, CSRF és Host ellenőrzés;
- rendszeradatbázis és SQL/DSN-injekció elutasítása;
- hibás SQL-jelszó kezelése titokszivárgás nélkül, párhuzamos telepítő kizárása;
- üres üzleti nyilvántartások és felhasználótábla, külön SQL-fiók;
- adatbázisra korlátozott GRANT, aláhúzást helyettesítő másik névhez nincs hozzáférés;
- meglévő, adattal teli adatbázis és konfiguráció érintetlen marad;
- első admin validáció, hash, belépés és a második nyilvános regisztráció tiltása;
- üres dashboard, metadata, kifejezett importfájl kérése;
- kijelentkezés bejelentkezve, anonimként, egyórás inaktivitás és cookie-vesztés után; CSRF-védelem és újrabelépés;
- sérült konfiguráció vagy SQL-kiesés nem nyitja újra a telepítőt;
- projektbe helyezett privát tároló elutasítása.

A valódi böngészős próbában az indítószkript konfiguráció nélkül indult, majd az adatbázis és az első admin létrehozásán keresztül az üres munkaterületig jutottunk. Az installer által létrehozott korlátozott SQL-fiókkal a backup is sikeresen lefutott. A régi helyi CMDB-konfigurációt és üzleti adatbázist a próbák nem írják.

További regresszió: szintetikus CRUD/jogosultság tesztek, 13 táblacsoport XLSX roundtrip, exportjob-feldolgozás, TypeScript/build és geometriai diagramtesztek. A telepítő nem helyettesíti a teljes alkalmazás biztonsági auditját; nyilvános internetes üzem nem támogatott.

## Lejárt munkamenet kezelése

A közös API-kliens a védett műveletek 401-es és a CSRF-ellenőrzés 419-es válaszánál a loginra irányít. A hibás jelszó 401-es válasza helyben marad, nem okoz újratöltési ciklust. A 403-as jogosultsághiány sem jelent kijelentkezést. A login maga friss CSRF-t kér belépés előtt, így egy sokáig nyitva hagyott loginűrlap is használható.

A visszatérés valódi dokumentum-újratöltés: ideiglenes `_login` query-paraméter biztosítja, hogy ne csak a hash változzon. Az indulás eltávolítja ezt a jelölőt. Az alkalmazás saját útvonala és az Apache almappája megmarad; a régi modálok, háttérlekérések és nem mentett űrlapállapot megszűnik. Módosító üzleti kérést nem játszunk újra. A login ezt a nem mentett módosításokra vonatkozó figyelmeztetéssel jelzi.

A `POST /logout` továbbra is CSRF-védett, de nem igényel aktív felhasználót. Azonosítót és CSRF-t cserél, az előző sessiont megszünteti. Elavult CSRF esetén a kliens egyszer friss tokent kér és csak a kijelentkezést ismétli. Hálózati hiba esetén nem állítja, hogy a szerveroldali kijelentkezés sikerült.

`pnpm test:session`: **10 kliensoldali próba**; egyszeri átirányítás párhuzamos hibáknál, teljes navigációt biztosító query, almappa megtartása, hibás jelszó, 403/422, bináris letöltés, lejárt export, CSRF-frissítés, korlátozott logout-újrapróbálás és hálózati hiba. A HTTP-próba külön, szintetikus session egyórás inaktivitását is előállítja.

Böngészőben két lappal is ellenőrizve: másik lapon történő kijelentkezés után védett lista és nyitott, nem mentett űrlap mentése loginra visz; nincs beragadt kilépési párbeszéd. A már lejárt munkamenetből külön a Kijelentkezés gomb is működik, a visszajelentkezés az áttekintésre jut. Aktív sessionnel a letöltött XLSX érvényes munkafüzet; lejárt sessionnel ugyanaz a Letöltés gomb loginra irányít.
