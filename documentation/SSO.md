# Microsoft Entra ID és AD FS SSO

Az Atlas a szabványos OpenID Connect Authorization Code folyamatot használja PKCE-védelemmel. Microsoft Entra ID esetén egy konkrét tenant engedélyezhető; helyi Active Directoryhoz AD FS vagy más OIDC-kompatibilis közvetítő szükséges. Közvetlen LDAP-jelszóellenőrzés és Windows Integrated Authentication nincs beépítve.

## Frissítés és alkalmazásregisztráció

1. Készíts mentést, telepítsd a Composer-függőségeket, építsd a frontendet, majd futtasd a nem törlő migrációt:

   ```powershell
   composer install
   pnpm install --frozen-lockfile
   pnpm build
   C:\xampp\php\php.exe install.php
   ```

2. Jelentkezz be helyi adminisztrátorként, és nyisd meg az **Adminisztráció → SSO bejelentkezés** oldalt.
3. Másold ki a felületen látható callback URL-t. Entra esetén az App registration **Authentication** lapján add hozzá **Web** redirect URI-ként. A címnek pontosan kell egyeznie; a port és a projekt alkönyvtára is része lehet.
4. Hozz létre kliens titkot, majd add meg az Atlasban a tenant ID-t, az Application (client) ID-t és a titkot. A titok mentés után nem olvasható vissza.
5. Mentsd a beállításokat, majd használd a **Mentett konfiguráció tesztelése** gombot. Ez az OIDC discovery dokumentumot és a szükséges HTTPS-végpontokat ellenőrzi, valódi felhasználói belépést nem indít.
6. Kapcsold be az SSO-t. A loginoldalon megjelenik a megadott feliratú külön gomb; a helyi adminbelépés megmarad vészhelyzeti hozzáférésnek.

Ez a helyi kiadás kliens titkot támogat. A Microsoft éles, hosszú élettartamú szolgáltatásnál tanúsítványt vagy federált hitelesítő adatot javasol; ezek kezelése ebben a változatban nincs implementálva.

Entra issuer: `https://login.microsoftonline.com/<tenant-id>/v2.0`. A `common`, `organizations` és `consumers` több-bérlős értékeket az Atlas szándékosan nem fogadja el.

AD FS esetén a szolgáltató típusát állítsd **AD FS / szabványos OIDC** értékre, és add meg a HTTPS issuer alapcímet. A szolgáltatónak discovery dokumentumot, RS256 aláírást, authorization-, token- és JWKS-végpontot, valamint `client_secret_post` klienshitelesítést kell támogatnia.

## Fiókok és jogosultságok

- Meglévő külső identitás a korábban hozzárendelt CMDB-fiókot nyitja meg.
- Az Atlas nem kapcsol össze fiókot azonos felhasználónév vagy e-mail alapján. Ez megakadályozza, hogy egy új külső identitás átvegye egy helyi fiók szerepét.
- Automatikus létrehozás kikapcsolásakor az ismeretlen külső identitás belépése elutasításra kerül. Első hozzárendeléshez ebben a változatban az automatikus létrehozást kell szabályokkal korlátozva használni.
- Automatikus létrehozáskor csak `viewer` vagy `editor` szerep választható; SSO-n keresztül admin nem hozható létre.
- Az e-mail-tartománylista kiegészítő szűrő. Entra esetén a token tenant ID-jának ettől függetlenül egyeznie kell.
- Kötelező csoportnál a beállított csoport objektumazonosítónak szerepelnie kell a token `groups` claimjében. Csoporttúlfutásnál a rendszer biztonságosan elutasít; nincs Microsoft Graph fallback.
- Entra csoportkorlátozáshoz az alkalmazás Token configuration beállításában a szükséges csoportclaimet is engedélyezni kell.

## Titkok, mentés és hibakeresés

A teljes SSO-beállítás az adatbázis `sso_settings` táblájában van. A kliens titok AES-256-GCM titkosítást kap; a kulcs a webrooton kívüli privát mappa `application.key` fájlja. A `backup.php` ezt a fájlt is a mentésbe másolja és a manifestbe veszi. Visszaállításkor az SQL és a hozzá tartozó kulcs együtt szükséges. Kulcsvesztéskor a titkot nem lehet helyreállítani; új kliens titkot kell létrehozni és elmenteni.

Az SSO-folyamat tíz percig érvényes state-, nonce- és PKCE-adatot tart a szerveroldali sessionben. Aláírás-, issuer-, audience-, tenant-, nonce- vagy időhiba esetén a callback a loginoldalra tér vissza általános hibaüzenettel. Az identitásszolgáltató nyers hibaleírása és a kliens titka nem kerül a böngésző válaszába vagy az auditdiffbe.

Az implementáció alapjai: [Microsoft authorization code + PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [hozzáférési és azonosító tokenek ellenőrzése](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens), [redirect URI szabályok](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url), [alkalmazáshitelesítő adatok](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials), [csoporttúlfutás](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/get-signed-in-users-groups-in-access-token).
