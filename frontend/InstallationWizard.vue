<script setup lang="ts">
import { reactive, ref } from "vue";
import { Database, ArrowRight, ShieldCheck } from "lucide-vue-next";
import { api } from "./api";

const props = defineProps<{
  info: {
    config_path: string;
    defaults: { host: string; port: number; database: string };
    requirements: {
      ready: boolean;
      php_version: string;
      missing_extensions: string[];
    };
  };
}>();
const emit = defineEmits<{ installed: [] }>();
const form = reactive({
  ...props.info.defaults,
  admin_user: "",
  admin_password: "",
});
const busy = ref(false);
const error = ref("");
const fields = ref<Record<string, string>>({});
async function install() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  fields.value = {};
  try {
    await api("install", "POST", form);
    form.admin_password = "";
    emit("installed");
  } catch (e: any) {
    error.value = e.message;
    fields.value = e.fields || {};
  } finally {
    form.admin_password = "";
    busy.value = false;
  }
}
</script>

<template>
  <form
    class="login-form installation-form"
    @submit.prevent="install"
    :aria-busy="busy"
  >
    <div class="eyebrow">ÜDV AZ ATLASBAN</div>
    <ol class="installation-steps" aria-label="Telepítés lépései">
      <li aria-current="step"><b>1</b> Adatbázis</li>
      <li><b>2</b> Első admin</li>
    </ol>
    <h2>Telepítsük a saját CMDB-det</h2>
    <p>
      Először létrehozunk egy új, üres adatbázist. Utána te választod meg az
      első adminisztrátor belépési adatait.
    </p>
    <div
      class="installation-check"
      :class="{ 'notice danger': !info.requirements.ready }"
      role="status"
    >
      <ShieldCheck :size="18" />
      <span v-if="info.requirements.ready"
        >PHP {{ info.requirements.php_version }} · A szükséges bővítmények
        elérhetők</span
      >
      <span v-else
        >PHP 8.2+ szükséges. Jelenlegi verzió:
        {{ info.requirements.php_version }}. Hiányzó bővítmények:
        {{ info.requirements.missing_extensions.join(", ") || "nincs" }}.
        Engedélyezés után indítsd újra a PHP-t és frissítsd ezt az oldalt.</span
      >
    </div>
    <fieldset :disabled="busy || !info.requirements.ready">
      <div class="installation-row">
        <label
          >SQL-szerver
          <select v-model="form.host">
            <option>127.0.0.1</option>
            <option>localhost</option>
            <option>::1</option>
          </select>
        </label>
        <label
          >Port<input
            v-model.number="form.port"
            type="number"
            required
            min="1"
            max="65535"
        /></label>
      </div>
      <label
        >Új adatbázis neve
        <input
          v-model="form.database"
          required
          pattern="[A-Za-z][A-Za-z0-9_]{0,47}"
          maxlength="48"
          autocomplete="off"
        />
        <small
          >Meglévő adatbázis nem használható: a telepítő semmit nem töröl és nem
          ír felül.</small
        >
      </label>
      <div class="installation-row">
        <label
          >SQL-admin felhasználó<input
            v-model="form.admin_user"
            required
            maxlength="80"
            placeholder="Például: root"
            autocomplete="off"
        /></label>
        <label
          >SQL-admin jelszó<input
            v-model="form.admin_password"
            type="password"
            maxlength="1024"
            autocomplete="off"
        /></label>
      </div>
      <small
        >Az SQL-adminnak adatbázis és felhasználó létrehozási, illetve
        jogosultságadási jog kell. Jelszavát nem mentjük el. Az alkalmazás
        saját, csak az új adatbázishoz hozzáférő SQL-fiókot kap.</small
      >
    </fieldset>
    <div v-if="error" class="notice danger" role="alert">
      {{ error }}
      <ul v-if="Object.keys(fields).length">
        <li v-for="(message, key) in fields" :key="key">{{ message }}</li>
      </ul>
    </div>
    <button class="primary full" :disabled="busy || !info.requirements.ready">
      <Database :size="17" />{{
        busy ? "Adatbázis létrehozása…" : "Üres adatbázis létrehozása"
      }}<ArrowRight :size="17" />
    </button>
    <p class="installation-storage">
      Privát konfiguráció: <code>{{ info.config_path }}</code
      ><br />Nem kerül bele mintaadat vagy Excel-import.
    </p>
  </form>
</template>

<style>
.installation-form {
  max-width: 510px;
  margin: 35px auto;
}
.installation-steps {
  display: flex;
  gap: 24px;
  list-style: none;
  padding: 0;
  margin: 24px 0;
  color: #687d78;
  font-size: 12px;
}
.installation-steps li {
  display: flex;
  gap: 7px;
  align-items: center;
}
.installation-steps b {
  display: grid;
  place-items: center;
  border-radius: 50%;
  width: 25px;
  height: 25px;
  background: #eef3f1;
}
.installation-steps [aria-current] {
  color: var(--green);
  font-weight: 600;
}
.installation-steps [aria-current] b {
  background: var(--green);
  color: white;
}
.installation-form > p {
  margin-bottom: 20px;
}
.installation-check {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: #176958;
  padding: 12px;
  background: #eef7f3;
  border-radius: 7px;
}
.installation-check svg {
  flex-shrink: 0;
}
.installation-form fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.installation-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 14px;
}
.installation-row label {
  min-width: 0;
}
.installation-form label {
  margin: 16px 0;
}
.installation-form label small,
.installation-form fieldset > small {
  color: #647871;
  font-size: 11px;
  line-height: 1.6;
}
.installation-form .installation-storage {
  color: #687d78;
  font-size: 11px;
  margin: 18px 0 0;
  line-height: 1.7;
}
.installation-storage code {
  overflow-wrap: anywhere;
}
@media (max-width: 650px) {
  .installation-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .installation-form {
    width: calc(100% - 40px);
  }
}
</style>
