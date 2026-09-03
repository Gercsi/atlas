<script setup lang="ts">
import { computed, ref, nextTick } from "vue";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Check,
  RotateCcw,
  ExternalLink,
} from "lucide-vue-next";
const props = defineProps<{ role: string; caps: string[] }>();
const emit = defineEmits<{ navigate: [page: string] }>();
const steps = [
  {
    title: "Tájékozódás",
    area: "Áttekintés",
    page: "dashboard",
    tag: "ALAPOK",
    intro:
      "Az Atlas azt tartja nyilván, milyen rendszereid vannak, hol futnak, és mi mivel kapcsolódik össze.",
    instructions: [
      "A bal oldali menüből nyílnak a nyilvántartások, a diagram és az adatkezelő oldalak. Az ikon melletti menügombbal össze is csukhatod.",
      "Az Áttekintés számlálói és adatminőségi jelzései a nyilvántartás állapotát mutatják. Ezek nem élő infrastruktúra-mérések.",
      "A felső globális keresővel több nyilvántartásban is kereshetsz; a listák saját keresői az adott típust szűrik.",
    ],
    tip: "A minta: egy rendelési alkalmazás egy szerveren fut, adatbázist használ, és REST API-n kommunikál egy raktári rendszerrel.",
  },
  {
    title: "Szerver felvétele",
    area: "Szerverek",
    page: "servers",
    tag: "NYILVÁNTARTÁS",
    field: "server",
    intro: "Először a futtatókörnyezetet dokumentáljuk.",
    instructions: [
      "Nyisd meg a Szerverek listát, majd válaszd az Új rekord gombot. Ehhez szerkesztési jogosultság kell.",
      "Add meg a nevet, a környezetet és a rendelkezésre álló műszaki adatokat. Az IP-címeket a szerver címmezőinél kezeld.",
      "A Rekord mentése ellenőrzi az adatokat. Az azonosítót a rendszer adja; a mezők mellett megjelenő hibákat javítsd.",
    ],
    tip: "Próbáld ki lent a mintaszerver átnevezését. A valódi mentést ez a gyakorlat nem hívja meg.",
  },
  {
    title: "Alkalmazás és szervere",
    area: "Alkalmazások",
    page: "applications",
    tag: "NYILVÁNTARTÁS",
    field: "app",
    intro:
      "Az alkalmazás és a szerver külön rekord. A hozzárendelés mondja meg, hol fut az alkalmazás.",
    instructions: [
      "Alkalmazások → Új rekord. Töltsd ki a nevet, a környezetet és az ismert üzleti adatokat.",
      "A szerver keresőmezőjében keress név vagy azonosító alapján, és válassz létező szervert. A szabadon begépelt név önmagában nem hoz létre kapcsolatot.",
      "Mentés után nyisd meg az adatlap Kapcsolatok fülét, és ellenőrizd a hozzárendelést.",
    ],
    tip: "A mintaalkalmazás DEMO-SRV-01-en fut. Szerverkeretes nézetben maga a keret a kattintható szerverobjektum; nem jelenik meg benne egy második szerverdoboz.",
  },
  {
    title: "Adatbázis dokumentálása",
    area: "Adatbázisok",
    page: "databases",
    tag: "NYILVÁNTARTÁS",
    field: "database",
    intro:
      "Az adatbázis saját rekordot kap, hogy a kapcsolatai és a környezete külön is kereshető legyen.",
    instructions: [
      "Adatbázisok → Új rekord. Rögzítsd a nevet és az ismert adatbázis-jellemzőket.",
      "A kapcsolódó objektumok keresőmezőinél válassz a létező rekordok közül. Ismeretlen adat helyett ne adj meg kitalált értéket.",
      "A diagram Adatbázisréteg kapcsolójával jelenítheted meg vagy rejtheted el ezeket az objektumokat. A hengerforma adatbázist jelöl.",
    ],
    tip: "Az alábbi henger a Rendelések DB mintarekord. A diagram beállítása csak a láthatóságot változtatja, adatot nem töröl.",
  },
  {
    title: "Integráció és irány",
    area: "Integrációk",
    page: "integrations",
    tag: "KAPCSOLATOK",
    intro: "A forrás és a cél megadása teszi egyértelművé az adatáramlást.",
    instructions: [
      "Integrációk → Új rekord. Válaszd ki a valódi forrás- és célobjektumot a keresőmezőkben.",
      "Töltsd ki az interfész, a protokoll és az állapot ismert adatait, majd mentsd a rekordot.",
      "A diagramon a nyílhegy a célra mutat. Ugyanahhoz a szomszédhoz több integráció is tartozhat; a rangsor ettől még egy szomszédot számol.",
    ],
    tip: "A mintakapcsolat irányát az Irány megfordítása gombbal változtathatod. Figyeld meg a nyílhegyet és a forrás → cél feliratot.",
  },
  {
    title: "Felelősök és kapcsolatok",
    area: "Kapcsolattartók",
    page: "contacts",
    tag: "KAPCSOLATOK",
    intro:
      "A személy vagy szervezet külön rekord; szerepe a hozzárendelésnél adható meg.",
    instructions: [
      "Vedd fel a kapcsolattartót a Kapcsolattartók listában. Csak a szükséges elérhetőségeket rögzítsd.",
      "Nyisd meg a rendszer adatlapjának Kapcsolatok fülét, és használd a Kapcsolattartó hozzárendelése részt.",
      "Válassz kapcsolattartót és szerepet, majd kattints a Hozzárendelés gombra. Az érzékeny kapcsolattartói részletek külön jogosultsághoz kötöttek.",
    ],
    tip: "Minta: Demo Üzemeltetés, szerepe üzemeltető. Az oktatóban nincsenek valódi személyes adatok.",
  },
  {
    title: "A diagram használata",
    area: "Diagramok",
    page: "diagram",
    tag: "FELFEDEZÉS",
    intro:
      "A szűrés, a központ és az elrendezés együtt ad olvasható kapcsolati térképet.",
    instructions: [
      "Válassz nézetet és környezetet, szükség esetén kiinduló szervereket és szomszédsági lépéseket, majd kattints a Nézet frissítése gombra.",
      "A legtöbb egyedi szomszéddal rendelkező látható rendszer a központ. A Nézet frissítése és az Automatikus elrendezés felváltva kompakt pókháló, kapcsolati rétegek és tömör térkép szerint rendez; az egyszerű kijelölés nem.",
      "Húzással rögzíthetsz pozíciót. A kijelölt objektum paneljén külön rögzítés/feloldás és Középpontba helyezés művelet is van.",
      "A Teljes képernyő a szűrőket is megtartja. A Teljes ábra illesztése csak a kamerát igazítja; a +/− gombok nagyítanak. Kilépés: Esc vagy a teljesképernyő-gomb.",
      "Az élre kattintva nyílik a kapcsolat részlete. A darabszám összevont kapcsolatot jelöl; a vonal megszakítása kereszteződést, nem új kapcsolatot.",
      "Az Adatközpontok és külső hosztolás nézet a szerver Adatközpont és Elhelyezés típusa mezőit használja. A cloud/hosted érték és az external/partner hálózati zóna külön külső keretet kap.",
      "Két hely kiválasztása után a frissítés narancssárgával kiemeli a dokumentált, akár több köztes helyen átvezető hálózati útvonalat. Ez nyilvántartási út, nem élő hálózati teszt.",
    ],
    tip: "A közvetlen alkalmazás–adatbázis párok azonos szerverkereten belül közel maradnak, a kapcsolat nélküli elemek pedig csak a kapcsolt mag után kerülnek ki. Nagyítható mentéshez SVG vagy PDF kell. A mentett nézet szűrőket, pozíciókat és elrendezési módot őriz, nem külön adatbázis-másolatot.",
  },
  {
    title: "Import és export",
    area: "Import / Export",
    page: "transfer",
    tag: "ADATKEZELÉS",
    intro:
      "Import előtt mindig ellenőrizd az előnézetet. Az exporthoz válaszd ki a szükséges tartományt.",
    instructions: [
      "Az Import / Export oldalon töltsd fel az adatfájlt, és készíts importelőnézetet. A feltöltés és az ellenőrzés nem azonos a véglegesítéssel.",
      "Nézd át a talált sorokat, az ellenőrzési jelzéseket és a kezelési beállításokat. Csak ezután válaszd az Ellenőrzött import véglegesítése műveletet.",
      "Az adatexportnál válassz objektumtípusokat, formátumot és hatókört. A feldolgozás után a Letöltés gomb jelenik meg.",
      "A diagram SVG/PDF/PNG exportja a Diagramok oldalon található. Ez külön jogosultság az adatok importjától és exportjától.",
    ],
    tip: "Az import_data, export_data és export_diagram külön engedélyek. Hiányzó gomb esetén kérdezd az adminisztrátort.",
  },
  {
    title: "Adatminőség és javítás",
    area: "Adatminőség",
    page: "quality",
    tag: "ADATKEZELÉS",
    intro:
      "A hiányos vagy bizonytalan adat legyen látható, ne észrevétlenül hibás.",
    instructions: [
      "Az Adatminőség oldalon nézd meg az ellenőrzésre váró rekordokat, majd nyisd meg az érintett adatlapot.",
      "Szerkesztési jogosultsággal javítsd a mezőket, és mentsd a változást. Ellenőrizd a kapcsolódó objektumokat is.",
      "A már nem használt rekord archiválható. A lista Archiváltak kapcsolója és az adatlap Visszaállítás művelete segít a visszakeresésben.",
    ],
    tip: "A diagram nem bizonyítja, hogy egy integráció éppen működik; a CMDB dokumentált állapotot tárol.",
  },
  {
    title: "Hálózati zónák",
    area: "Hálózati zónák",
    page: "zones",
    tag: "ADMINISZTRÁCIÓ",
    admin: true,
    intro:
      "A zónák az infrastruktúra hálózati besorolását és hierarchiáját dokumentálják.",
    instructions: [
      "Adminisztráció → Hálózati zónák. Az Új elem résznél add meg a zóna nevét.",
      "Válassz besorolást: internal, dmz, partner, external vagy unknown. Szükség esetén válassz szülőzónát és írj megjegyzést.",
      "Mentés után a megfelelő rekordoknál használd az új zónát. Ne keverd össze a zóna besorolását a PROD/TEST környezettel.",
      "Internetet vagy külső hálózatot explicit external zónával jelölj. Egy IP-címből vagy az on-premise hosztolásból az Atlas biztonsági okból nem következtet automatikusan hálózati határra.",
    ],
    tip: "Példa: DEMO Belső hálózat, besorolás: internal. Az oktató nem hoz létre valódi zónát.",
  },
  {
    title: "Szótárak karbantartása",
    area: "Szótárak",
    page: "references",
    tag: "ADMINISZTRÁCIÓ",
    admin: true,
    intro: "A kódok és magyar címkék következetessé teszik a nyilvántartást.",
    instructions: [
      "Adminisztráció → Szótárak → Új elem. Add meg a kategóriát, a stabil kódot és a magyar címkét.",
      "A kategória például environment, criticality vagy role. A stabil kód technikai azonosító; a címke az olvasható megnevezés.",
      "Ellenőrizd az Aktív állapotot, majd ments. A meglévő kategóriák és kódok használatát egyeztesd, mert egyes kezelőfelületek rögzített értékkészletet mutatnak.",
    ],
    tip: "A stabil kód megválasztása előtt nézd át a már létező elemeket, hogy ne keletkezzen több azonos jelentésű bejegyzés.",
  },
  {
    title: "SSO bejelentkezés",
    area: "SSO bejelentkezés",
    page: "sso",
    tag: "ADMINISZTRÁCIÓ",
    admin: true,
    intro:
      "A Microsoft Entra ID vagy AD FS OIDC-beállításait az adatbázis tárolja, a kliens titkát külön alkalmazáskulcs védi.",
    instructions: [
      "Adminisztráció → SSO bejelentkezés. Másold át a kijelzett callback URL-t az Entra/AD FS alkalmazás webes redirect URI-jai közé.",
      "Add meg a tenant vagy issuer értéket, a kliensazonosítót és a kliens titkát. Szükség esetén korlátozz e-mail-tartományra és csoportazonosítóra.",
      "Az automatikus fióklétrehozásnál csak viewer vagy editor szerepet adj. Ments, teszteld a discovery-végpontot, majd kapcsold be az SSO-t.",
      "A helyi adminbelépést tartsd meg vészhelyzeti hozzáférésnek. A mentéshez az application.key fájl is szükséges.",
    ],
    tip: "Az Atlas nem kapcsol külső identitást meglévő helyi fiókhoz pusztán egyező név vagy e-mail alapján.",
  },
  {
    title: "Felhasználók és jogok",
    area: "Felhasználók",
    page: "users",
    tag: "ADMINISZTRÁCIÓ",
    admin: true,
    intro:
      "A szerepkör az alapjogokat, a külön engedélyek további műveleteket szabályoznak.",
    instructions: [
      "Adminisztráció → Felhasználók. Add meg az új felhasználó nevét és legalább 12 karakteres, egyedi jelszavát.",
      "Válassz szerepet: viewer a megtekintéshez, editor a nyilvántartások szerkesztéséhez, admin a rendszer adminisztrálásához.",
      "Szükség szerint jelöld az import_data, export_data, export_diagram és view_contact_details engedélyeket. Csak a feladathoz szükséges jogokat add.",
      "Mentsd a felhasználót. A mintán alul kipróbálhatod a szerepválasztást; ez nem hoz létre fiókot és nem módosít jogosultságot.",
    ],
    tip:
      "A mostani szereped: " +
      props.role +
      ". Az admin oldalak csak admin szereppel érhetők el.",
  },
];
const index = ref(0),
  completed = ref<number[]>([]),
  message = ref("");
const step = computed(() => steps[index.value]);
const lessonTitle = ref<HTMLHeadingElement>();
const demo = ref({
  server: "DEMO-SRV-01",
  app: "Rendelési portál",
  database: "Rendelések DB",
  environment: "TEST",
});
const draft = ref(""),
  reverse = ref(false),
  sampleRole = ref("viewer");
const savedLabel = computed(() =>
  step.value.field
    ? demo.value[step.value.field as "server" | "app" | "database"]
    : "",
);
function go(i: number) {
  index.value = i;
  message.value = "";
  draft.value = savedLabel.value;
  nextTick(() => {
    lessonTitle.value?.focus({ preventScroll: true });
    lessonTitle.value?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}
function next() {
  completed.value = [...new Set([...completed.value, index.value])];
  if (index.value < steps.length - 1) go(index.value + 1);
  else
    message.value =
      "Végigértél az oktatón. A bal oldali lépésekkel bármikor visszatérhetsz.";
}
function saveExample() {
  if (!draft.value.trim() || !step.value.field) return;
  demo.value[step.value.field as "server" | "app" | "database"] =
    draft.value.trim();
  message.value = "Mintarekord frissítve. Az adatbázis nem változott.";
}
function reset() {
  demo.value = {
    server: "DEMO-SRV-01",
    app: "Rendelési portál",
    database: "Rendelések DB",
    environment: "TEST",
  };
  reverse.value = false;
  sampleRole.value = "viewer";
  completed.value = [];
  go(0);
}
</script>
<template>
  <section class="tutorial" aria-label="CMDB oktató">
    <header class="tutorial-banner">
      <div>
        <div class="eyebrow">TANULJ EGY MINTARENDSZEREN</div>
        <h2><BookOpen :size="24" />Ismerd meg az Atlast</h2>
        <p>
          13 rövid lépés a kereséstől az adminisztrációig. A gyakorlóadatok
          kitaláltak és csak ebben a fülben élnek.
        </p>
      </div>
      <button @click="reset">
        <RotateCcw :size="15" />Gyakorlat újrakezdése
      </button>
    </header>
    <div class="tutorial-progress">
      <progress
        :value="completed.length"
        :max="steps.length"
        aria-label="Oktató előrehaladása"
      ></progress
      ><span>{{ completed.length }}/{{ steps.length }} lépés kész</span>
    </div>
    <div class="tutorial-grid">
      <nav class="tutorial-steps" aria-label="Oktató lépései">
        <button
          v-for="(item, i) in steps"
          :key="item.title"
          :class="{ active: i === index }"
          :aria-current="i === index ? 'step' : undefined"
          @click="go(i)"
        >
          <span class="step-number"
            ><Check v-if="completed.includes(i)" :size="15" /><template
              v-else
              >{{ i + 1 }}</template
            ></span
          ><span
            ><small>{{ item.tag }}</small
            >{{ item.title }}</span
          >
        </button>
      </nav>
      <article class="tutorial-lesson">
        <div class="eyebrow">{{ step.tag }} · {{ index + 1 }}. LÉPÉS</div>
        <h2 ref="lessonTitle" tabindex="-1" style="scroll-margin-top: 24px">
          {{ step.title }}
        </h2>
        <p class="tutorial-intro">{{ step.intro }}</p>
        <div class="tutorial-location">
          Itt találod: <strong>{{ step.area }}</strong
          ><button
            v-if="!step.admin || role === 'admin'"
            class="text-button"
            @click="emit('navigate', step.page)"
          >
            Oldal megnyitása <ExternalLink :size="13" /></button
          ><small v-else>Adminisztrátori szerep szükséges</small>
        </div>
        <ol class="tutorial-instructions">
          <li v-for="instruction in step.instructions" :key="instruction">
            {{ instruction }}
          </li>
        </ol>
        <aside class="tutorial-tip">{{ step.tip }}</aside>
        <section
          class="tutorial-demo"
          aria-label="Elkülönített gyakorlókörnyezet"
        >
          <div class="eyebrow">MINTA · NEM AZ ÉLES ADATBÁZIS</div>
          <svg
            viewBox="0 0 650 215"
            role="img"
            aria-label="A rendelési portál mintakapcsolatai"
          >
            <defs>
              <marker
                id="tutorial-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill="#397867" />
              </marker>
            </defs>
            <rect
              x="15"
              y="15"
              width="255"
              height="175"
              rx="10"
              fill="#f1f4f5"
              stroke="#bccdc6"
              stroke-dasharray="6 3"
            />
            <text
              x="142"
              y="42"
              text-anchor="middle"
              fill="#526c62"
              font-size="13"
            >
              {{ demo.server }}
            </text>
            <rect
              x="40"
              y="72"
              width="205"
              height="70"
              rx="8"
              fill="#e4f1ed"
              stroke="#65a48f"
            />
            <text
              x="142"
              y="104"
              text-anchor="middle"
              fill="#24443f"
              font-size="14"
            >
              {{ demo.app }}
            </text>
            <text
              x="142"
              y="125"
              text-anchor="middle"
              fill="#658579"
              font-size="11"
            >
              {{ demo.environment }} · mintaalkalmazás
            </text>
            <path
              :d="reverse ? 'M443 107 H247' : 'M247 107 H443'"
              fill="none"
              stroke="#397867"
              stroke-width="2"
              marker-end="url(#tutorial-arrow)"
            />
            <rect x="305" y="94" width="82" height="22" rx="4" fill="white" />
            <text
              x="346"
              y="109"
              text-anchor="middle"
              fill="#397867"
              font-size="12"
            >
              REST API
            </text>
            <rect
              x="450"
              y="78"
              width="184"
              height="58"
              rx="8"
              fill="#e4f1ed"
              stroke="#65a48f"
            />
            <text
              x="542"
              y="111"
              text-anchor="middle"
              fill="#24443f"
              font-size="14"
            >
              Raktári rendszer
            </text>
            <path
              d="M142 143 V170 H323"
              stroke="#9679b6"
              fill="none"
              marker-end="url(#tutorial-arrow)"
            />
            <path
              d="M324 151 Q324 137 424 151 V188 Q374 204 324 188 Z"
              fill="#f2eaff"
              stroke="#a78bce"
            />
            <ellipse
              cx="374"
              cy="151"
              rx="50"
              ry="8"
              fill="#eee1ff"
              stroke="#a78bce"
            />
            <text
              x="374"
              y="180"
              text-anchor="middle"
              fill="#705389"
              font-size="11"
            >
              {{ demo.database }}
            </text>
          </svg>
          <form
            v-if="step.field"
            class="tutorial-practice"
            @submit.prevent="saveExample"
          >
            <label
              >Mintarekord neve<input
                v-model="draft"
                required
                maxlength="25"
                aria-label="Mintarekord neve" /></label
            ><label
              >Környezet<select v-model="demo.environment">
                <option>TEST</option>
                <option>DEV</option>
                <option>PROD</option>
              </select></label
            ><button class="primary">Minta mentése</button>
          </form>
          <div
            v-else-if="step.page === 'integrations'"
            class="tutorial-practice"
          >
            <p>
              {{
                reverse
                  ? "Raktári rendszer → " + demo.app
                  : demo.app + " → Raktári rendszer"
              }}
            </p>
            <button @click="reverse = !reverse">Irány megfordítása</button>
          </div>
          <div v-else-if="step.page === 'users'" class="tutorial-practice">
            <label
              >Mintafelhasználó szerepe<select v-model="sampleRole">
                <option>viewer</option>
                <option>editor</option>
                <option>admin</option>
              </select></label
            >
            <p>
              {{
                sampleRole === "admin"
                  ? "Megtekintés, szerkesztés és adminisztráció."
                  : sampleRole === "editor"
                    ? "Megtekintés és nyilvántartás-szerkesztés."
                    : "Nyilvántartások megtekintése."
              }}
              Az import/export engedélyek külön kezelhetők.
            </p>
          </div>
          <p class="tutorial-safe">
            A minta frissítése, átnevezése és irányváltása nem ment valódi
            rekordot. Lapfrissítéskor a gyakorlóadatok visszaállnak.
          </p>
        </section>
        <p v-if="message" role="status" class="tutorial-feedback">
          {{ message }}
        </p>
        <footer class="tutorial-actions">
          <button :disabled="index === 0" @click="go(index - 1)">
            <ArrowLeft :size="16" />Előző lépés</button
          ><span>{{ index + 1 }} / {{ steps.length }}</span
          ><button class="primary" @click="next">
            {{
              index === steps.length - 1
                ? "Oktató befejezése"
                : "Értem, következő"
            }}<ArrowRight :size="16" />
          </button>
        </footer>
      </article>
    </div>
  </section>
</template>
