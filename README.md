# Atlas CMDB

Magyar nyelvű, helyben futó CMDB alkalmazások, szerverek, adatbázisok, integrációk, kapcsolattartók és dokumentált hálózati kapcsolatok nyilvántartására. PHP/PDO backend, MariaDB/MySQL adatbázis, Vue 3 + TypeScript felület.

- Kapcsolati térkép szűréssel, kapcsolatszám szerinti rangsorral, három körbejárható automatikus elrendezéssel, akadálykerülő vonalakkal és kézzel rögzíthető pozíciókkal.
- Kattintható szerverkeretek, valamint adatközpont/felhő/internet topológia dokumentált, több lépéses hálózati útvonal kiemelésével.
- PNG, valamint nagyítható **vektoros SVG és PDF** diagramexport; teljes képernyő és összecsukható navigáció.
- CRUD, névvel megjelenített kapcsolatok, oszloponkénti rendezés és szűrés, archiválás, adatminőség-jelzések és auditnapló.
- XLSX import előnézettel, XLSX/CSV-ZIP export háttérfeldolgozással.
- Szerepkörök és külön import/export/kapcsolattartó-hozzáférési jogosultságok.
- 13 lépéses, szintetikus mintákat használó Oktató fül.
- **Első indítási telepítő:** új, üres adatbázis, saját SQL-fiók, majd az első adminisztrátor létrehozása.
- Microsoft Entra ID és AD FS / OIDC SSO Authorization Code + PKCE folyamattal, adatbázisban tárolt, titkosított kliensbeállításokkal.

A repó nem tartalmaz üzleti adatokat, előre létrehozott felhasználót vagy belépési jelszót. Ez **helyi fejlesztői kiadás**: csak localhost/loopback elérésre készült, nem internetre publikálható kész szolgáltatás. Nincs automatikus hálózati felderítés.

## Gyors telepítés Windows / XAMPP alatt

Szükséges: Git, PHP 8.2+, Composer 2, helyi MariaDB/MySQL, Node.js 20.19+ és pnpm 10. A PHP-bővítmények: `pdo_mysql`, `mbstring`, `dom`, `xml`, `xmlreader`, `xmlwriter`, `zip`, `gd`, `fileinfo`, `openssl`. A jelen kiadást PHP 8.2.12 és MariaDB 10.4.32 környezetben ellenőriztük; más SQL-verziókat külön ellenőrizni kell.

```powershell
git clone https://github.com/Gercsi/atlas.git C:\xampp\htdocs\atlas
Set-Location C:\xampp\htdocs\atlas
composer install --no-dev --prefer-dist
pnpm install --frozen-lockfile
pnpm build
.\Start-CMDB.ps1
```

Ha a Composer hiányzó ZIP/GD bővítményt jelez, engedélyezd azokat a parancssori PHP `php.ini` fájljában. Alternatíva helyi `composer.phar` esetén: `php -d extension=zip -d extension=gd composer.phar install --no-dev --prefer-dist`. A PowerShell indító a XAMPP `C:\xampp\php\php.exe` fájlját használja és ezeket a bővítményeket parancssori kapcsolókkal is betölti.

Nyisd meg: **http://127.0.0.1:8088/**

1. **Adatbázis telepítése.** Adj meg egy még nem létező adatbázisnevet és egy telepítésre jogosult SQL-admin fiókot. A MariaDB/MySQL szolgáltatásnak futnia kell. A telepítő nem telepíti magát az SQL-szervert.
2. **Első admin létrehozása.** Válassz felhasználónevet és legalább 12 karakteres jelszót, majd erősítsd meg. Nincs alapértelmezett alkalmazásjelszó.
3. Az Atlas beléptet az üres munkaterületre. Az Oktató fülön végigpróbálhatod a mintákat; saját adatot kézzel vagy kifejezett XLSX-importtal tölthetsz fel.

A telepítő csak az alap szótárakat és az ismeretlen hálózati zónát tölti fel; az üzleti nyilvántartások és a felhasználók táblája a második lépés előtt üres. **Meglévő adatbázist nem ír felül, akkor sem, ha az üres.** A SQL-admin jelszava csak a telepítési kéréshez kell; a mentett konfiguráció külön, véletlen jelszavú, az új adatbázisra korlátozott alkalmazásfiókot tartalmaz.

Az indítószkript a PHP webszervert és az exportworkert rejtett ablakban indítja. A worker telepítés előtt várakozik, utána automatikusan munkába áll. A szkript szükség esetén elindítja a helyi XAMPP MariaDB-t a 3306-os porton; más SQL-elrendezésnél a szolgáltatást külön kell elindítani. Nem módosít tűzfalat és nem állít le foglalt porton futó alkalmazást.

Másik port vagy privát konfiguráció:

```powershell
.\Start-CMDB.ps1 -Port 8090 -Config 'C:\private\atlas\config.json'
```

A `config.json` fájlt **ne hozd létre üresen**: a telepítő írja meg. A privát mappa maradjon a projekten és a teljes webrooton kívül. XAMPP alatt az `atlas` projekt alapértelmezett helye `C:\xampp\atlas-private\config.json`; a korábbi `CMDB` mappában futó példány továbbra is a meglévő `C:\xampp\cmdb-private\config.json` konfigurációját használja.

## Egyéb helyi környezet

Telepítsd ugyanazokat a függőségeket, építsd meg a frontendet, és állítsd be a `CMDB_CONFIG` környezeti változót a webszerver és a worker folyamatában is. A `.env.example` csak dokumentációs minta; nincs automatikus dotenv-betöltés.

```sh
export CMDB_CONFIG=/absolute/private/atlas/config.json
php -S 127.0.0.1:8088 -t public public/router.php
# Másik terminálban, ugyanazzal a CMDB_CONFIG értékkel:
php worker.php
```

A szükséges PHP-bővítmények legyenek engedélyezve. A webszerver dokumentumgyökere kizárólag `public` legyen. Apache alatt azonos-origin `api.php?r=...` útvonal működik; a PHP indítószerver az `/api/v1/...` alakot is kezeli. Apache alatt a bővítményeket külön ellenőrizni kell.

## Konfiguráció, frissítés és biztonság

- Konfigurációminta: `config.example.json`. A futó példány JSON-konfigurációja, sessionjei, importfájljai, mentései és exportjai a privát mappában vannak. A privát mappa NTFS/Linux jogosultságait a futtató felhasználóra kell korlátozni.
- Meglévő konfigurációnál nem jelenik meg telepítő. Hibás konfiguráció vagy nem elérhető SQL esetén az alkalmazás hibát jelez; nem hoz létre másik adatbázist.
- Frissítés előtt készíts mentést. Függőségtelepítés és frontend build után a `php install.php` a már beállított adatbázis nem törlő migrációját futtatja; az üres adatbázis telepítését a böngészős varázsló végzi.
- A telepítő egyszerre csak egy helyi telepítést enged. DDL-hiba esetén a részben elkészült **új** adatbázist biztonságból megőrzi, nem törli automatikusan. Ezt SQL-admin ellenőrizze, vagy új próbához válassz másik adatbázisnevet.
- HttpOnly / SameSite=Lax session (az OIDC-visszatéréshez), külön state/nonce/PKCE- és CSRF-védelem, belépési próbálkozáskorlát, szerveroldali jogosultság-ellenőrzés. Az első admin létrejötte után a nyilvános felhasználólétrehozás lezárul. A helyi géphez hozzáférő más felhasználó az első beállítás előtt megelőzhet: a telepítést megbízható gépen végezd el.
- Lejárt munkamenetnél a következő API-művelet automatikusan a bejelentkezésre visz, az exportletöltésnél is. A kijelentkezés lejárt sessionnel is működik. Újrabelépés után az áttekintés nyílik meg; a nem mentett űrlapok nem kerülnek automatikusan mentésre vagy újraküldésre. Régebben megnyitott lapnál a javítás betöltéséhez egyszer Ctrl+F5 szükséges.
- A runtime SQL-fiók a saját adatbázisán migrációhoz szükséges DDL-jogokat is kap. Élesítéshez külön migrációs fiók, szűkebb runtime jogosultságok, TLS, üzemeltetési és biztonsági felülvizsgálat szükséges.

### Microsoft Entra ID / AD FS SSO

Frissítés után előbb futtasd a `php install.php` migrációt, majd adminisztrátorként nyisd meg az **Adminisztráció → SSO bejelentkezés** oldalt. Itt állítható a szolgáltató, tenant/issuer, kliensazonosító és titok, engedélyezett e-mail-tartomány, kötelező csoport, valamint az automatikusan létrehozott fiók alapjogosultsága. A felület megmutatja a pontos callback URL-t; ezt **Web** redirect URI-ként kell regisztrálni az identitásszolgáltatónál. Mentés után a konfiguráció külön gombbal ellenőrizhető.

A kliens titka AES-256-GCM titkosítással kerül az adatbázisba, és az admin API sem adja vissza. A külön 32 bájtos `application.key` a privát konfigurációs mappában jön létre. A mentés ezt a kulcsot is tartalmazza; nélküle a visszaállított SSO-titok nem fejthető vissza. A külső identitások külön azonosítóhoz kötődnek, az alkalmazás egyező felhasználónév vagy e-mail alapján nem kapcsolja őket meglévő helyi fiókhoz.

Az Entra-integráció egy tenantot fogad el, és ellenőrzi az aláírást, issuer-, audience-, tenant-, lejárati és nonce-értékeket. A kötelező csoportot a token `groups` claimjéből ellenőrzi. Csoporttúlfutásnál a belépést elutasítja; Microsoft Graph-visszakérdezést ez a helyi kiadás nem végez. Az „AD FS” lehetőség szabványos OIDC-végpontot jelent, nem közvetlen LDAP/Active Directory jelszóhitelesítést vagy Windows Integrated Authenticationt. Részletes beállítás: [documentation/SSO.md](documentation/SSO.md).

Részletes telepítési állapotok és tesztek: [documentation/INSTALLATION.md](documentation/INSTALLATION.md).

## Import, export és mentés

Az import támogatja a kötött `01_Applications`–`05_Contacts` munkalapos legacy formátumot és az Atlas saját teljes XLSX-exportját. Nem általános, bármilyen táblázatot felismerő importáló. Az első lépés mindig előnézet; véglegesítéshez külön művelet kell. A hiányzó kapcsolatokat nem találja ki, a képleteket nem futtatja. A memóriaérték eredeti formája megmarad; a bináris GiB-konverzió választható profil.

A saját teljes XLSX visszaimportja csak üres üzleti adatbázisba engedélyezett. Részleges/szűrt export vagy CSV visszaimportja nem támogatott. Az adatexporthoz futó `worker.php` kell; a `worker.php --once` egy kört dolgoz fel. A diagramexport böngészőben készül, nem kell hozzá worker vagy külső konvertáló szolgáltatás.

```sh
php backup.php
php maintenance.php
```

A backup SQL-t, privát konfigurációt, az SSO-titokhoz tartozó `application.key` fájlt, import-XLSX-eket és hash-manifestet ment. A jelszó ideiglenes privát kliensfájlban kerül a `mysqldump` programhoz, nem parancssori argumentumban. A `CMDB_MYSQLDUMP` változóval megadható a kliens útvonala. Egyedileg hozzáadott tárolt rutinokat/triggereket a script nem ment; az Atlas sémája nem használ ilyeneket. A mentés titkokat tartalmaz, ne tedd GitHubra.

A `maintenance.php` csak előnézetet ad; `--apply` kapcsolóval törli a lejárt exportokat. Automatikus időzítés nincs. Az import/audit 90/365 napos megőrzési konfiguráció nem jelent automatikus törlést. SQL-restore: külön üres ellenőrző adatbázisba, privát hitelesítéssel, ellenőrzés után konfigurációváltással; meglévő cél felülírása nincs automatizálva.

## Fejlesztés és ellenőrzés

```sh
pnpm check
pnpm build
pnpm test:diagram
pnpm test:session
php -d extension=zip -d extension=gd tests/installer.php
php -d extension=zip -d extension=gd tests/sso.php
php -d extension=zip -d extension=gd tests/run.php
php -d extension=zip -d extension=gd tests/roundtrip.php
php -d extension=zip -d extension=gd tests/jobs.php
```

A PHP-próbák új, véletlen nevű szintetikus adatbázisokat és privát ideiglenes mappákat hoznak létre; **ne éles SQL-szerveren futtasd**. A teszt SQL-admin beállítható: `CMDB_TEST_SQL_USER`, `CMDB_TEST_SQL_PASSWORD`, `CMDB_TEST_SQL_PORT`. Alapértelmezés a helyi XAMPP root / üres jelszó, kizárólag tesztprovisioningre. A tesztadatbázisokat bizonyítékként megtartják. A roundtrip/jobs próbák előtt a `tests/run.php` szükséges. A PowerShell concurrency/performance tesztek XAMPP-specifikusak.

A `/proof.html` szintetikus, adatbázist nem olvasó diagrampróba, közös alkalmazáskomponensekkel. Nem kerül meg bejelentkezést és nem használ üzleti adatot. A `vendor`, `node_modules` és buildelt `public/assets` fájlok nincsenek a repóban, a fenti telepítés hozza létre őket.

- [Diagram: elrendezés, adatközpontok, export és korlátok](documentation/DIAGRAM_V4.md)
- [Útvonalvezetési motor](documentation/DIAGRAM_V2.md)
- [Microsoft Entra ID / AD FS SSO](documentation/SSO.md)
- [OpenAPI](documentation/openapi.json)
- [Adatbázisséma](documentation/schema.sql)

A sűrű hálózatok útvonalvezetése közelítő, háttérszálon fut. Nem garantálható minden sűrű gráfhoz keresztezés nélküli rajz vagy 60 FPS; el nem helyezhető címkék tooltipben/részletlistában maradnak. SVG/PDF nagyításkor éles marad; a PNG képpontos. Függőségek verziózárai: `composer.lock`, `pnpm-lock.yaml`; audit: `composer audit`, `pnpm audit --prod`.
