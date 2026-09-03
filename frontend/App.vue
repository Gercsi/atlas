<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import {
  api,
  apiDownload,
  logoutSession,
  setCsrf,
  labels,
  types,
  display,
} from "./api";
import Lookup from "./Lookup.vue";
import Diagram from "./Diagram.vue";
import AppSidebar from "./AppSidebar.vue";
import Tutorial from "./Tutorial.vue";
import InstallationWizard from "./InstallationWizard.vue";
import {
  Boxes,
  LayoutDashboard,
  AppWindow,
  Server,
  Database,
  Workflow,
  Users,
  Network,
  GitBranch,
  ArrowDownUp,
  ShieldCheck,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Download,
  Upload,
  Check,
  AlertTriangle,
  X,
  SlidersHorizontal,
  ListFilter,
  Clock,
  ExternalLink,
  KeyRound,
} from "lucide-vue-next";
function initialSidebarState() {
  try {
    const saved = localStorage.getItem("cmdb.sidebarCollapsed");
    return saved === null ? innerWidth <= 900 : saved === "true";
  } catch {
    return innerWidth <= 900;
  }
}
const sidebarCollapsed = ref(initialSidebarState());
watch(sidebarCollapsed, (value) => {
  try {
    localStorage.setItem("cmdb.sidebarCollapsed", String(value));
  } catch {
    /* Preferences are optional. */
  }
});
const globalQuery = ref(""),
  globalResults = ref<any[]>([]),
  networkAssignment = ref<any>({ connection_id: null, mapping_notes: "" });
const user = ref<any>(null),
  ready = ref(false),
  setup = ref(false),
  installationRequired = ref(false),
  installationInfo = ref<any>(null),
  ssoPublic = ref<any>({ enabled: false, display_name: "Microsoft Entra ID" }),
  passwordConfirmation = ref(""),
  loginNotice = ref(""),
  loggingOut = ref(false),
  downloading = ref(false),
  username = ref(""),
  password = ref(""),
  error = ref(""),
  toast = ref(""),
  busy = ref(false),
  page = ref("dashboard"),
  meta = ref<any>({ fields: {}, references: [], zones: [], capabilities: [] }),
  dash = ref<any>({ counts: {}, quality: {}, recent: [], environments: [] });
const icons: any = {
  applications: AppWindow,
  servers: Server,
  databases: Database,
  integrations: Workflow,
  contacts: Users,
  network_connections: Network,
};
const list = ref<any[]>([]),
  total = ref(0),
  p = ref(1),
  per = ref(25),
  q = ref(""),
  env = ref(""),
  archived = ref(false),
  sort = ref("public_id"),
  direction = ref("asc"),
  selected = ref<string[]>([]),
  allFiltered = ref(false),
  columnMenu = ref(false),
  activeColumnMenu = ref(""),
  columnMenuPosition = ref({ top: 0, left: 0 }),
  columnFilters = ref<Record<string, { text: string; values: string[] }>>({}),
  columnFilterDraft = ref<{ text: string; values: string[] }>({
    text: "",
    values: [],
  }),
  columnFacets = ref<Record<string, any[]>>({}),
  columnFacetTruncated = ref<Record<string, boolean>>({}),
  visibleColumns = ref<string[]>([
    "public_id",
    "name",
    "environment",
    "data_quality_status",
  ]);
const detail = ref<any>(null),
  rel = ref<any>({}),
  detailType = ref(""),
  tab = ref("summary"),
  editing = ref(false),
  form = ref<any>({}),
  fieldErrors = ref<any>({}),
  dirty = ref(false);
const relation = ref<any>({
  contact_id: null,
  role_code: "unspecified",
  role_description: "",
});
const importPreview = ref<any>(null),
  ram = ref("preserve"),
  upload = ref<File | null>(null),
  importHistory = ref<any>({ data: [], staging: [] }),
  exportTypes = ref<string[]>([...types]),
  exportFormat = ref("xlsx"),
  exportScope = ref("all"),
  job = ref<any>(null);
const adminRows = ref<any[]>([]),
  adminForm = ref<any>({
    role: "viewer",
    scope: "internal",
    active: true,
    capabilities: [],
  });
const ssoForm = ref<any>({
    enabled: false,
    provider_type: "entra",
    display_name: "Microsoft Entra ID",
    tenant_id: "",
    issuer_url: "",
    client_id: "",
    client_secret: "",
    client_secret_configured: false,
    allowed_email_domains_text: "",
    required_group_id: "",
    auto_provision: false,
    default_role: "viewer",
    default_capabilities: [],
  }),
  ssoTest = ref<any>(null),
  ssoFields = ref<any>({});
let debounce: ReturnType<typeof setTimeout>;
let poll: ReturnType<typeof setTimeout>;
let gen = 0;
const caps = computed(() => meta.value.capabilities || []);
const count = computed(() =>
  Object.values(dash.value.counts).reduce((a: any, b: any) => a + b, 0),
);
const qualityCount = computed(() =>
  Object.values(dash.value.quality).reduce((a: any, b: any) => a + b, 0),
);
const isList = computed(() => types.includes(page.value));
const title = computed(
  () =>
    labels[page.value] ||
    (
      {
        dashboard: "Infrastruktúra áttekintés",
        diagram: "Kapcsolati térkép",
        tutorial: "Oktató",
        transfer: "Import és export",
        quality: "Adatminőség",
        users: "Felhasználók",
        references: "Szótárak",
        zones: "Hálózati zónák",
        sso: "SSO bejelentkezés",
      } as any
    )[page.value],
);
const fields = computed<Record<string, string>>(
  () => meta.value.fields[detailType.value] || {},
);
const columns = computed(() =>
  visibleColumns.value.filter(
    (c) =>
      c === "public_id" ||
      c === "data_quality_status" ||
      meta.value.fields[page.value]?.[c],
  ),
);
const progress = computed(() =>
  Number(count.value)
    ? Math.round(
        ((Number(count.value) - Number(qualityCount.value)) /
          Number(count.value)) *
          100,
      )
    : 0,
);
function notify(text: string) {
  toast.value = text;
  setTimeout(() => (toast.value = ""), 5000);
}
async function init() {
  const currentUrl = new URL(location.href);
  if (currentUrl.searchParams.has("_login")) {
    currentUrl.searchParams.delete("_login");
    history.replaceState(null, "", currentUrl.href);
  }
  error.value = "";
  try {
    const s = await api("session");
    setCsrf(s.csrf);
    user.value = s.user;
    setup.value = s.setup_required;
    installationRequired.value = !!s.installation_required;
    installationInfo.value = s.installation || null;
    ssoPublic.value = s.sso || {
      enabled: false,
      display_name: "Microsoft Entra ID",
    };
    if (s.sso_error) error.value = s.sso_error;
    if (!user.value && location.hash === "#/login?reason=expired") {
      loginNotice.value =
        "A munkameneted lejárt. Jelentkezz be újra. A nem mentett módosítások nem kerültek mentésre.";
    }
    if (user.value) await loadBase();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    ready.value = true;
  }
}
async function login() {
  busy.value = true;
  error.value = "";
  try {
    // The login form itself may have been left open beyond the session lifetime.
    const session = await api("session");
    setCsrf(session.csrf);
    if (setup.value) {
      if (password.value !== passwordConfirmation.value)
        throw new Error("A két jelszó nem egyezik.");
      await api("setup", "POST", {
        username: username.value,
        password: password.value,
      });
      setup.value = false;
    }
    const s = await api("login", "POST", {
      username: username.value,
      password: password.value,
    });
    setCsrf(s.csrf);
    user.value = s.user;
    password.value = "";
    passwordConfirmation.value = "";
    loginNotice.value = "";
    await loadBase();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function loadBase() {
  [meta.value, dash.value] = await Promise.all([
    api("metadata"),
    api("dashboard"),
  ]);
  await fromHash();
}
function url() {
  const params = new URLSearchParams({
    q: q.value,
    environment: env.value,
    page: String(p.value),
    per_page: String(per.value),
    sort: sort.value,
    direction: direction.value,
    archived: archived.value ? "1" : "",
    column_filters: JSON.stringify(columnFilters.value),
    facet_fields: columns.value.join(","),
  });
  return params.toString();
}
async function loadList() {
  const token = ++gen;
  try {
    const r = await api(
      `${page.value}&${url()}${page.value === "quality" ? "&data_quality_status=review" : ""}`,
    );
    if (token !== gen) return;
    list.value = r.data;
    total.value = r.meta.total;
    columnFacets.value = r.meta.facets || {};
    columnFacetTruncated.value = r.meta.facet_truncated || {};
  } catch (e: any) {
    error.value = e.message;
  }
}
function setDefaultColumns(target: string) {
  if (target === "integrations")
    visibleColumns.value = [
      "public_id",
      "source_application_id",
      "target_application_id",
      "interface_type",
      "protocol",
      "status",
      "data_quality_status",
    ];
  else if (target === "contacts")
    visibleColumns.value = [
      "public_id",
      "name",
      "organization",
      "data_quality_status",
    ];
  else
    visibleColumns.value = [
      "public_id",
      "name",
      "environment",
      "data_quality_status",
    ];
}
async function navigate(target: string) {
  if (dirty.value && !confirm("Elhagyod a nem mentett módosításokat?")) return;
  dirty.value = false;
  detail.value = null;
  editing.value = false;
  page.value = target;
  q.value = "";
  env.value = "";
  p.value = 1;
  selected.value = [];
  allFiltered.value = false;
  activeColumnMenu.value = "";
  columnFilters.value = {};
  error.value = "";
  setDefaultColumns(target);
  history.pushState(null, "", "#/" + target);
  await loadPage();
}
async function loadPage() {
  if (isList.value) await loadList();
  else if (page.value === "dashboard" || page.value === "quality")
    dash.value = await api("dashboard");
  else if (page.value === "transfer") await historyLoad();
  else if (["users", "references", "zones"].includes(page.value))
    adminRows.value = (await api("admin/" + page.value)).data;
  else if (page.value === "sso") {
    const value = await api("admin/sso");
    ssoForm.value = {
      ...value,
      client_secret: "",
      clear_client_secret: false,
      allowed_email_domains_text: (value.allowed_email_domains || []).join(
        "\n",
      ),
    };
    ssoTest.value = null;
    ssoFields.value = {};
  }
}
async function fromHash() {
  if (!user.value) return;
  const [route, params = ""] = location.hash.slice(2).split("?");
  const [target, id] = route.split("/");
  if (target === "login") {
    page.value = "dashboard";
    history.replaceState(null, "", "#/dashboard");
  } else if (target) {
    const pageChanged = page.value !== target;
    page.value = target;
    if (pageChanged && types.includes(target)) setDefaultColumns(target);
    const search = new URLSearchParams(params);
    q.value = search.get("q") || "";
    env.value = search.get("environment") || "";
    p.value = Number(search.get("page")) || 1;
    try {
      const restoredFilters = JSON.parse(search.get("column_filters") || "{}");
      columnFilters.value =
        restoredFilters && typeof restoredFilters === "object"
          ? restoredFilters
          : {};
    } catch {
      columnFilters.value = {};
    }
    if (id && types.includes(target)) {
      await open(target, id, false);
      return;
    }
  }
  await loadPage();
}
async function open(type: string, id: string, push = true) {
  if (dirty.value && !confirm("Elhagyod a nem mentett módosításokat?")) return;
  dirty.value = false;
  editing.value = false;
  detailType.value = type;
  tab.value = "summary";
  try {
    [detail.value, rel.value] = await Promise.all([
      api(`${type}/${id}`),
      api(`${type}/${id}/relationships`),
    ]);
    if (push) history.pushState(null, "", `#/${type}/${id}`);
  } catch (e: any) {
    error.value = e.message;
  }
}
function close() {
  if (dirty.value && !confirm("Elveted a nem mentett módosításokat?")) return;
  dirty.value = false;
  detail.value = null;
  editing.value = false;
  history.pushState(null, "", `#/${page.value}?${url()}`);
}
function edit(create = false) {
  detailType.value = create ? page.value : detailType.value;
  form.value = create ? {} : { ...detail.value };
  if (!create) {
    if (detailType.value === "servers")
      form.value.addresses = JSON.parse(
        JSON.stringify(rel.value.addresses || []),
      );
    if (detailType.value === "network_connections") {
      form.value.endpoints = JSON.parse(
        JSON.stringify(rel.value.endpoints || []),
      );
      form.value.services = JSON.parse(
        JSON.stringify(rel.value.services || []),
      );
    }
  } else {
    form.value.addresses = [];
    form.value.endpoints = [];
    form.value.services = [];
  }
  fieldErrors.value = {};
  editing.value = true;
  dirty.value = false;
  if (create) detail.value = {};
}
async function save() {
  busy.value = true;
  fieldErrors.value = {};
  error.value = "";
  try {
    const d = await api(
      detail.value.id
        ? `${detailType.value}/${detail.value.id}`
        : detailType.value,
      detail.value.id ? "PATCH" : "POST",
      form.value,
    );
    dirty.value = false;
    await open(detailType.value, d.id);
    notify("A rekord mentése sikerült.");
    await loadPage();
    dash.value = await api("dashboard");
  } catch (e: any) {
    fieldErrors.value = e.fields || {};
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function archive() {
  if (
    !confirm(
      "A kapcsolatok megmaradnak. Folytatod az archiválást / visszaállítást?",
    )
  )
    return;
  try {
    await api(
      `${detailType.value}/${detail.value.id}/${detail.value.archived_at ? "restore" : "archive"}`,
      "POST",
      { lock_version: detail.value.lock_version },
    );
    await open(detailType.value, detail.value.id);
    await loadPage();
    notify("Állapot frissítve.");
  } catch (e: any) {
    error.value = e.message;
  }
}
async function addContact() {
  try {
    await api(
      `${detailType.value}/${detail.value.id}/contacts`,
      "POST",
      relation.value,
    );
    rel.value = await api(
      `${detailType.value}/${detail.value.id}/relationships`,
    );
    relation.value = { contact_id: null, role_code: "unspecified" };
    notify("Kapcsolattartó hozzárendelve.");
  } catch (e: any) {
    error.value = e.message;
  }
}
async function removeContact(id: string) {
  try {
    await api(
      `${detailType.value}/${detail.value.id}/contacts/${id}`,
      "DELETE",
    );
    rel.value = await api(
      `${detailType.value}/${detail.value.id}/relationships`,
    );
  } catch (e: any) {
    error.value = e.message;
  }
}
function options(kind: string) {
  if (kind.startsWith("select:"))
    return kind
      .slice(7)
      .split(",")
      .map((v) => ({ code: v, label: v }));
  return meta.value.references.filter(
    (r: any) => r.category === kind.slice(5) && r.active,
  );
}
function columnFilterActive(field: string) {
  const filter = columnFilters.value[field];
  return !!(filter?.text || filter?.values?.length);
}
function columnValue(row: any, field: string) {
  return display(row[field + "_display"] ?? row[field]);
}
async function openColumnMenu(field: string, event: MouseEvent) {
  event.stopPropagation();
  if (activeColumnMenu.value === field) {
    activeColumnMenu.value = "";
    return;
  }
  const current = columnFilters.value[field];
  columnFilterDraft.value = {
    text: current?.text || "",
    values: [...(current?.values || [])],
  };
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  columnMenuPosition.value = {
    top: Math.max(10, Math.min(window.innerHeight - 520, rect.bottom + 6)),
    left: Math.max(10, Math.min(window.innerWidth - 330, rect.left)),
  };
  activeColumnMenu.value = field;
  if (!(field in columnFacets.value)) await loadList();
}
function setColumnSort(field: string, nextDirection: "asc" | "desc") {
  sort.value = field;
  direction.value = nextDirection;
  p.value = 1;
  activeColumnMenu.value = "";
  loadList();
}
function applyColumnFilter(field: string) {
  const text = columnFilterDraft.value.text.trim();
  const values = [...new Set(columnFilterDraft.value.values)];
  if (text || values.length)
    columnFilters.value = {
      ...columnFilters.value,
      [field]: { text, values },
    };
  else {
    const next = { ...columnFilters.value };
    delete next[field];
    columnFilters.value = next;
  }
  p.value = 1;
  selected.value = [];
  allFiltered.value = false;
  activeColumnMenu.value = "";
  history.replaceState(null, "", `#/${page.value}?${url()}`);
  loadList();
}
function clearColumnFilter(field: string) {
  columnFilterDraft.value = { text: "", values: [] };
  const next = { ...columnFilters.value };
  delete next[field];
  columnFilters.value = next;
  p.value = 1;
  activeColumnMenu.value = "";
  history.replaceState(null, "", `#/${page.value}?${url()}`);
  loadList();
}
function facetLabel(field: string, facet: any) {
  if (field === "data_quality_status")
    return facet.value === "review" ? "Ellenőrizendő" : "Rendben";
  const kind = meta.value.fields[page.value]?.[field];
  if (kind === "bool")
    return facet.value === "1"
      ? "Igen"
      : facet.value === "0"
        ? "Nem"
        : facet.label;
  return facet.label;
}
function toggleAll(checked: boolean) {
  selected.value = checked ? list.value.map((r) => r.id) : [];
  allFiltered.value = false;
}
async function historyLoad() {
  if (caps.value.includes("import_data"))
    importHistory.value = await api("imports");
}
async function preview() {
  busy.value = true;
  error.value = "";
  try {
    if (upload.value) {
      const fd = new FormData();
      fd.append("file", upload.value);
      fd.append("ram_profile", ram.value);
      importPreview.value = await api("imports/preview", "POST", fd);
    } else
      importPreview.value = await api("imports/preview", "POST", {
        ram_profile: ram.value,
      });
    await historyLoad();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function commit() {
  busy.value = true;
  try {
    await api(`imports/${importPreview.value.id}/commit`, "POST");
    notify("Az import sikerült. Minden módosítás egy tranzakcióban került be.");
    importPreview.value = null;
    await historyLoad();
    dash.value = await api("dashboard");
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function exportData() {
  busy.value = true;
  try {
    job.value = await api("exports", "POST", {
      types: exportTypes.value,
      format: exportFormat.value,
      scope: exportScope.value,
      filters: {
        q: q.value,
        environment: env.value,
        column_filters: columnFilters.value,
      },
      ids: selected.value,
      archived: archived.value,
    });
    await pollJob();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function pollJob() {
  if (!job.value) return;
  job.value = await api("jobs/" + job.value.id);
  if (["queued", "running"].includes(job.value.status))
    poll = setTimeout(
      () => pollJob().catch((e) => (error.value = e.message)),
      1200,
    );
}
async function adminSave() {
  try {
    await api("admin/" + page.value, "POST", adminForm.value);
    adminForm.value = { role: "viewer", scope: "internal", active: true };
    await loadPage();
    meta.value = await api("metadata");
    notify("Mentve.");
  } catch (e: any) {
    error.value = e.message;
  }
}
async function saveSso() {
  busy.value = true;
  error.value = "";
  ssoFields.value = {};
  try {
    const saved = await api("admin/sso", "PUT", {
      ...ssoForm.value,
      allowed_email_domains: ssoForm.value.allowed_email_domains_text,
    });
    ssoForm.value = {
      ...saved,
      client_secret: "",
      clear_client_secret: false,
      allowed_email_domains_text: (saved.allowed_email_domains || []).join(
        "\n",
      ),
    };
    ssoPublic.value = {
      enabled: saved.enabled,
      display_name: saved.display_name,
    };
    notify("Az SSO-beállításokat mentettem.");
  } catch (e: any) {
    error.value = e.message;
    ssoFields.value = e.fields || {};
  } finally {
    busy.value = false;
  }
}
async function testSso() {
  busy.value = true;
  error.value = "";
  ssoTest.value = null;
  try {
    ssoTest.value = await api("admin/sso/test", "POST");
    notify("Az OIDC-konfiguráció elérhető és érvényes.");
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function startSso() {
  window.location.assign("api.php?r=sso/login");
}
async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await logoutSession();
  } catch (e: any) {
    error.value =
      "A kijelentkezés nem sikerült. Ellenőrizd a kapcsolatot, majd próbáld újra. " +
      e.message;
  } finally {
    loggingOut.value = false;
  }
}
async function downloadExport() {
  if (!job.value || downloading.value) return;
  downloading.value = true;
  try {
    const current = job.value;
    const blob = await apiDownload(`exports/${current.id}/download`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CMDB-${current.id}.${current.format === "zip" ? "zip" : "xlsx"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    downloading.value = false;
  }
}
function beforeLoginRedirect() {
  // An expiry redirect must not get stuck behind the unsaved-form unload guard.
  dirty.value = false;
  user.value = null;
  detail.value = null;
  editing.value = false;
  ++gen;
  clearTimeout(debounce);
  clearTimeout(poll);
}
watch(globalQuery, async (v) => {
  if (!user.value) return;
  if (v.length < 2) {
    globalResults.value = [];
    return;
  }
  try {
    globalResults.value = (await api("search&q=" + encodeURIComponent(v))).data;
  } catch {
    globalResults.value = [];
  }
});
async function addNetwork() {
  try {
    await api(
      "integrations/" + detail.value.id + "/network-connections",
      "POST",
      networkAssignment.value,
    );
    rel.value = await api("integrations/" + detail.value.id + "/relationships");
    notify("Hálózati megfeleltetés mentve.");
  } catch (e: any) {
    error.value = e.message;
  }
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}
function closeColumnMenu(event: Event) {
  if ((event as KeyboardEvent).type === "keydown") {
    if ((event as KeyboardEvent).key !== "Escape") return;
  }
  activeColumnMenu.value = "";
}
watch([q, env, per, archived], () => {
  if (!user.value || !isList.value) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    p.value = 1;
    selected.value = [];
    allFiltered.value = false;
    history.replaceState(null, "", `#/${page.value}?${url()}`);
    loadList();
  }, 250);
});
onMounted(() => {
  init();
  window.addEventListener("popstate", fromHash);
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("cmdb:login-redirect", beforeLoginRedirect);
  window.addEventListener("click", closeColumnMenu);
  window.addEventListener("keydown", closeColumnMenu);
});
onBeforeUnmount(() => {
  clearTimeout(debounce);
  clearTimeout(poll);
  window.removeEventListener("popstate", fromHash);
  window.removeEventListener("beforeunload", beforeUnload);
  window.removeEventListener("cmdb:login-redirect", beforeLoginRedirect);
  window.removeEventListener("click", closeColumnMenu);
  window.removeEventListener("keydown", closeColumnMenu);
});
</script>
<template>
  <div v-if="!ready" class="loading">Atlas CMDB betöltése…</div>
  <div v-else-if="!user" class="login-screen">
    <div class="login-story">
      <div class="brand">
        <Boxes :size="32" /><span>atlas<span class="brand-dot">.</span></span
        ><small>CMDB</small>
      </div>
      <div>
        <div class="eyebrow">MINDEN RENDSZER. EGY HELYEN.</div>
        <h1>Ismerd a rendszereid.<br />Értsd a kapcsolataikat.</h1>
        <p>
          Átlátható infrastruktúra, összekapcsolt nyilvántartások és dokumentált
          tudás a saját környezetedben.
        </p>
        <div class="login-nodes">
          <Server :size="42" /><span>——</span><AppWindow :size="42" /><span
            >——</span
          ><Database :size="42" />
        </div>
      </div>
      <small>Helyi, privát munkakörnyezet · Nincs hálózati felderítés</small>
    </div>
    <InstallationWizard
      v-if="installationRequired && installationInfo"
      :info="installationInfo"
      @installed="init"
    />
    <form v-else class="login-form" @submit.prevent="login">
      <div class="eyebrow">BIZTONSÁGOS HOZZÁFÉRÉS</div>
      <p v-if="loginNotice" class="notice" role="status">{{ loginNotice }}</p>
      <ol
        v-if="setup"
        class="installation-steps"
        aria-label="Telepítés lépései"
      >
        <li><b>✓</b> Adatbázis kész</li>
        <li aria-current="step"><b>2</b> Első admin</li>
      </ol>
      <h2>
        {{ setup ? "Hozd létre az első admint" : "Üdv újra az Atlasban" }}
      </h2>
      <p>
        {{
          setup
            ? "A jelszót te választod; nincs előre beállított belépési adat."
            : "Jelentkezz be a CMDB megnyitásához."
        }}
      </p>
      <label
        >Felhasználónév<input
          v-model="username"
          required
          autocomplete="username"
          minlength="3" /></label
      ><label
        >Jelszó<input
          v-model="password"
          required
          type="password"
          :minlength="setup ? 12 : 1"
          :maxlength="setup ? 72 : undefined"
          :autocomplete="setup ? 'new-password' : 'current-password'"
      /></label>
      <label v-if="setup"
        >Jelszó megerősítése<input
          v-model="passwordConfirmation"
          type="password"
          required
          minlength="12"
          maxlength="72"
          autocomplete="new-password"
      /></label>
      <div v-if="error" role="alert" class="notice danger">{{ error }}</div>
      <button class="primary full" :disabled="busy">
        {{
          busy
            ? "Egy pillanat…"
            : setup
              ? "Admin létrehozása és belépés"
              : "Bejelentkezés"
        }}<ArrowUpRight :size="18" /></button
      ><template v-if="!setup && ssoPublic.enabled">
        <div class="login-divider"><span>vagy</span></div>
        <button type="button" class="sso-button full" @click="startSso">
          <KeyRound :size="18" />{{ ssoPublic.display_name }}
        </button>
      </template>
      <small>Csak a helyi gépről elérhető fejlesztői példány.</small>
    </form>
  </div>
  <div v-else class="shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar
      :page="page"
      :user="user"
      :counts="dash.counts"
      :quality-count="Number(qualityCount)"
      :collapsed="sidebarCollapsed"
      @navigate="navigate"
      @logout="logout"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          Munkaterület <span>/</span><strong>{{ title }}</strong>
        </div>
        <div class="global-search">
          <Search :size="15" /><input
            v-model="globalQuery"
            placeholder="Keresés minden nyilvántartásban…"
            aria-label="Globális kereső"
          />
          <div v-if="globalResults.length" class="global-results">
            <button
              v-for="r in globalResults"
              @click="
                open(r.entity_type, r.id);
                globalQuery = '';
                globalResults = [];
              "
            >
              <span>{{ r.name }}</span
              ><small>{{ labels[r.entity_type] }} · {{ r.public_id }}</small>
            </button>
          </div>
        </div>
        <div class="topbar-right">
          <span class="local-badge"><span class="live-dot"></span>LOCAL</span
          ><span>{{
            new Date().toLocaleDateString("hu-HU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          }}</span
          ><span class="avatar small">{{
            user.username.slice(0, 2).toUpperCase()
          }}</span>
        </div>
      </header>
      <main :class="{ 'diagram-page': page === 'diagram' }">
        <div class="page-heading">
          <div>
            <div class="eyebrow">
              {{
                page === "dashboard"
                  ? "A TELJES KÉP, EGY PILLANTÁSRA"
                  : "ATLAS / CMDB"
              }}
            </div>
            <h1>
              {{ title
              }}<span v-if="isList" class="title-count">{{ total }}</span>
            </h1>
            <p>
              {{
                page === "dashboard"
                  ? "Rendszerek, erőforrások és kapcsolatok — átláthatóan, egy helyen."
                  : page === "diagram"
                    ? "Fedezd fel az infrastruktúrád és az alkalmazásaid összefüggéseit."
                    : isList
                      ? "Kereshető nyilvántartás, naprakész kapcsolatok és követhető változások."
                      : "Dokumentált adatok. Ellenőrizhető változások."
              }}
            </p>
          </div>
          <div class="inline">
            <button v-if="page === 'dashboard'" @click="navigate('transfer')">
              <Upload :size="16" />Adatok importálása</button
            ><button
              class="primary"
              v-if="page === 'dashboard'"
              @click="navigate('diagram')"
            >
              <GitBranch :size="17" />Diagram megnyitása<ArrowUpRight
                :size="16"
              /></button
            ><button
              class="primary"
              v-if="isList && caps.includes('edit')"
              @click="edit(true)"
            >
              <Plus :size="17" />Új rekord
            </button>
          </div>
        </div>
        <div v-if="error" class="notice danger" role="alert">
          {{ error
          }}<button @click="error = ''" aria-label="Hiba bezárása">×</button>
        </div>
        <template v-if="page === 'dashboard'"
          ><div class="stats-grid">
            <button
              v-for="t in [
                'applications',
                'servers',
                'databases',
                'integrations',
              ]"
              class="stat-card"
              @click="navigate(t)"
            >
              <div class="stat-top">
                <span class="stat-icon" :class="t"
                  ><component :is="icons[t]" :size="20" /></span
                ><ArrowUpRight :size="17" />
              </div>
              <div class="stat-number">{{ dash.counts[t] || 0 }}</div>
              <div class="stat-title">{{ labels[t] }}</div>
              <div class="stat-foot">
                <span class="live-dot"></span
                >{{
                  t === "integrations"
                    ? "Dokumentált adatkapcsolat"
                    : "Nyilvántartott objektum"
                }}
              </div>
            </button>
          </div>
          <div class="dashboard-grid">
            <section class="card topology-preview">
              <div class="section-head">
                <div>
                  <h2>Az infrastruktúra összeköt.</h2>
                  <p>Lásd, mi mire épül.</p>
                </div>
                <span class="tag">INTERAKTÍV DIAGRAM</span>
              </div>
              <div class="topology-art" aria-hidden="true">
                <div class="art-zone">
                  <div class="art-zone-title"><Server :size="15" />Szerver</div>
                  <div class="art-app">
                    <AppWindow :size="21" /><span>Alkalmazás</span>
                  </div>
                  <div class="art-db">
                    <Database :size="24" /><span>Adatbázis</span>
                  </div>
                </div>
                <div class="art-connector">
                  <span>Integráció</span><i></i
                  ><small>Irányított kapcsolat</small>
                </div>
                <div class="art-zone second">
                  <div class="art-zone-title"><Server :size="15" />Szerver</div>
                  <div class="art-app">
                    <AppWindow :size="21" /><span>Alkalmazás</span>
                  </div>
                </div>
                <div class="art-caption">
                  Szemléltető modell · nem a tényleges topológia
                </div>
              </div>
              <div class="preview-footer">
                <span
                  ><span class="live-dot"></span>Négy nézet. Egy összefüggő
                  rendszer.</span
                ><button class="text-button" @click="navigate('diagram')">
                  Kapcsolati térkép megnyitása <ArrowUpRight :size="16" />
                </button>
              </div>
            </section>
            <section class="card quality-card">
              <div class="section-head">
                <h2>Adatminőség</h2>
                <ShieldCheck :size="21" />
              </div>
              <div
                class="quality-ring"
                :style="{ '--progress': progress + '%' }"
              >
                <div>
                  <strong>{{ progress }}<small>%</small></strong
                  ><span>jelzés nélkül</span>
                </div>
              </div>
              <p>
                <strong>{{ qualityCount }} rekord</strong> felülvizsgálatra vár
              </p>
              <div class="quality-row">
                <span
                  ><i class="dot amber"></i>Hiányos vagy bizonytalan adat</span
                ><strong>{{ qualityCount }}</strong>
              </div>
              <div class="quality-row">
                <span><i class="dot gray"></i>Stagingben megőrzött sor</span
                ><strong>{{ dash.staging || 0 }}</strong>
              </div>
              <button @click="navigate('quality')">
                Ellenőrzési lista megnyitása <ArrowUpRight :size="15" />
              </button>
            </section>
          </div>
          <div class="dashboard-bottom">
            <section class="card">
              <div class="section-head">
                <h2>Nyilvántartások</h2>
                <span class="muted">{{ count }} objektum összesen</span>
              </div>
              <div
                class="registry-row"
                v-for="t in types"
                @click="navigate(t)"
                tabindex="0"
                @keydown.enter="navigate(t)"
              >
                <span class="registry-icon"
                  ><component :is="icons[t]" :size="18" /></span
                ><strong>{{ labels[t] }}</strong
                ><span>{{ dash.counts[t] || 0 }} rekord</span
                ><ChevronRight :size="15" />
              </div>
            </section>
            <section class="card activity-card">
              <div class="section-head">
                <h2>Legutóbbi változások</h2>
                <Clock :size="18" />
              </div>
              <div v-if="!dash.recent.length" class="empty">
                <Clock :size="32" />
                <h3>Még nincs változás</h3>
                <p>
                  Az első import vagy mentés után itt jelenik meg az auditnapló.
                </p>
              </div>
              <div
                class="activity"
                v-for="(r, i) in dash.recent.slice(0, 5)"
                :key="i"
              >
                <span class="activity-dot"><Check :size="13" /></span>
                <div>
                  <strong>{{
                    (
                      {
                        create: "Rekord létrehozva",
                        update: "Rekord módosítva",
                        import: "Import befejezve",
                        export: "Export elkészült",
                        relations: "Kapcsolat frissítve",
                      } as any
                    )[r.action] || r.action
                  }}</strong>
                  <p>{{ labels[r.entity] || r.entity }}</p>
                </div>
                <time>{{
                  new Date(
                    r.created_at.replace(" ", "T") + "Z",
                  ).toLocaleTimeString("hu-HU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }}</time>
              </div>
              <div class="info-note">
                <ShieldCheck :size="17" />A változások visszakereshetők a
                rekordok adatlapján.
              </div>
            </section>
          </div></template
        >
        <template v-if="isList"
          ><section class="card list-card">
            <div class="list-toolbar">
              <div class="search-input">
                <Search :size="17" /><input
                  v-model="q"
                  placeholder="Keresés név, azonosító vagy cím alapján…"
                  aria-label="Nyilvántartás keresése"
                />
              </div>
              <select
                v-if="['applications', 'servers'].includes(page)"
                v-model="env"
                aria-label="Környezet szűrő"
              >
                <option value="">Minden környezet</option>
                <option
                  v-for="e in [
                    'PROD',
                    'PREPROD',
                    'UAT',
                    'TEST',
                    'DEV',
                    'UNKNOWN',
                  ]"
                >
                  {{ e }}
                </option></select
              ><label class="check"
                ><input v-model="archived" type="checkbox" />Archiváltak
                is</label
              ><button @click="columnMenu = !columnMenu">
                <SlidersHorizontal :size="16" />Oszlopok
              </button>
            </div>
            <div v-if="columnMenu" class="column-menu">
              <label
                class="check"
                v-for="c in [
                  'public_id',
                  ...Object.keys(meta.fields[page]),
                  'data_quality_status',
                ]"
                ><input type="checkbox" :value="c" v-model="visibleColumns" />{{
                  labels[c] || c
                }}</label
              >
            </div>
            <div class="selection-bar" v-if="selected.length || allFiltered">
              <strong
                >{{ allFiltered ? total : selected.length }} rekord
                kijelölve</strong
              ><button class="text-button" @click="allFiltered = true">
                Mind a {{ total }} szűrt találat kijelölése</button
              ><button
                @click="
                  exportTypes = [page];
                  exportScope = allFiltered ? 'filtered' : 'selected';
                  exportData();
                "
                v-if="caps.includes('export_data')"
              >
                <Download :size="15" />Kijelölés exportja
              </button>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th class="checkbox-cell">
                      <input
                        type="checkbox"
                        :checked="
                          list.length > 0 && selected.length === list.length
                        "
                        @change="
                          toggleAll(($event.target as HTMLInputElement).checked)
                        "
                        aria-label="Oldal kijelölése"
                      />
                    </th>
                    <th
                      v-for="c in columns"
                      :key="c"
                      :class="{ 'column-filtered': columnFilterActive(c) }"
                    >
                      <button
                        class="column-heading"
                        @click.stop="openColumnMenu(c, $event)"
                        :aria-expanded="activeColumnMenu === c"
                        :aria-label="`${labels[c] || c} oszlop rendezése és szűrése`"
                      >
                        <span>{{ labels[c] || c }}</span>
                        <span v-if="sort === c">{{
                          direction === "asc" ? "↑" : "↓"
                        }}</span>
                        <ListFilter
                          :size="12"
                          :class="{ active: columnFilterActive(c) }"
                        />
                      </button>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in list"
                    :key="r.id"
                    @click="open(page, r.id)"
                    tabindex="0"
                    @keydown.enter="open(page, r.id)"
                  >
                    <td @click.stop>
                      <input
                        type="checkbox"
                        v-model="selected"
                        :value="r.id"
                        :aria-label="r.public_id + ' kijelölése'"
                      />
                    </td>
                    <td v-for="c in columns">
                      <code v-if="c === 'public_id'">{{ r[c] }}</code
                      ><span
                        v-else-if="c === 'environment'"
                        class="badge"
                        :class="r[c]?.toLowerCase()"
                        >{{ r[c] || "Nincs megadva" }}</span
                      ><span
                        v-else-if="c === 'data_quality_status'"
                        class="quality-label"
                        :class="r[c]"
                        ><AlertTriangle
                          v-if="r[c] === 'review'"
                          :size="13"
                        /><Check v-else :size="13" />{{
                          r[c] === "review" ? "Ellenőrizendő" : "Rendben"
                        }}</span
                      ><strong v-else-if="c === 'name'">{{
                        r[c] || r.public_id
                      }}</strong
                      ><span v-else>{{ columnValue(r, c) }}</span>
                    </td>
                    <td><ChevronRight :size="15" /></td>
                  </tr>
                </tbody>
              </table>
              <div class="empty" v-if="!list.length">
                <component :is="icons[page]" :size="38" />
                <h3>Nincs megjeleníthető rekord</h3>
                <p>
                  Hozz létre egyet, importálj adatokat, vagy módosítsd a
                  szűrőket.
                </p>
              </div>
            </div>
            <div
              v-if="activeColumnMenu"
              class="column-filter-menu"
              :style="{
                top: columnMenuPosition.top + 'px',
                left: columnMenuPosition.left + 'px',
              }"
              role="dialog"
              :aria-label="`${labels[activeColumnMenu] || activeColumnMenu} oszlopszűrő`"
              @click.stop
            >
              <div class="column-filter-title">
                <strong>{{
                  labels[activeColumnMenu] || activeColumnMenu
                }}</strong
                ><button
                  class="icon-button"
                  @click="activeColumnMenu = ''"
                  aria-label="Oszlopszűrő bezárása"
                >
                  <X :size="15" />
                </button>
              </div>
              <div class="column-sort-actions">
                <button @click="setColumnSort(activeColumnMenu, 'asc')">
                  A → Z
                </button>
                <button @click="setColumnSort(activeColumnMenu, 'desc')">
                  Z → A
                </button>
              </div>
              <label class="column-text-filter"
                >Szöveges szűrés
                <input
                  v-model="columnFilterDraft.text"
                  placeholder="Tartalmazza ezt a szöveget…"
                  @keyup.enter="applyColumnFilter(activeColumnMenu)"
                />
              </label>
              <fieldset class="column-value-filter">
                <legend>Kiválasztott értékek</legend>
                <label
                  class="check"
                  v-for="facet in columnFacets[activeColumnMenu] || []"
                  :key="facet.value"
                >
                  <input
                    type="checkbox"
                    :value="facet.value"
                    v-model="columnFilterDraft.values"
                  /><span>{{ facetLabel(activeColumnMenu, facet) }}</span
                  ><small>{{ facet.count }}</small>
                </label>
                <p v-if="!(columnFacets[activeColumnMenu] || []).length">
                  {{
                    meta.fields[page]?.[activeColumnMenu] === "long"
                      ? "Ehhez a hosszú szöveges oszlophoz használd a fenti keresőt."
                      : "Nincs választható érték."
                  }}
                </p>
                <p v-if="columnFacetTruncated[activeColumnMenu]">
                  Az első 100 leggyakoribb érték látható; további értékhez
                  használd a szöveges szűrést.
                </p>
              </fieldset>
              <div class="column-filter-actions">
                <button
                  class="text-button"
                  @click="clearColumnFilter(activeColumnMenu)"
                >
                  Szűrés törlése
                </button>
                <button
                  class="primary"
                  @click="applyColumnFilter(activeColumnMenu)"
                >
                  Alkalmazás
                </button>
              </div>
            </div>
            <div class="pagination">
              <span
                >{{ total ? (p - 1) * per + 1 : 0 }}–{{
                  Math.min(p * per, total)
                }}
                / {{ total }} rekord</span
              >
              <div class="inline">
                <select v-model="per" aria-label="Oldalméret">
                  <option :value="25">25 / oldal</option>
                  <option :value="50">50 / oldal</option>
                  <option :value="100">100 / oldal</option></select
                ><button
                  :disabled="p <= 1"
                  @click="
                    p--;
                    loadList();
                  "
                  aria-label="Előző oldal"
                >
                  <ChevronLeft :size="16" /></button
                ><span>{{ p }}. oldal</span
                ><button
                  :disabled="p * per >= total"
                  @click="
                    p++;
                    loadList();
                  "
                  aria-label="Következő oldal"
                >
                  <ChevronRight :size="16" />
                </button>
              </div>
            </div></section
        ></template>
        <Tutorial
          v-if="page === 'tutorial'"
          :role="user.role"
          :caps="caps"
          @navigate="navigate"
        />
        <Diagram
          v-if="page === 'diagram'"
          :caps="caps"
          :zones="meta.zones"
          @open="open"
        />
        <template v-if="page === 'quality'"
          ><div class="notice">
            <AlertTriangle :size="18" />A figyelmeztetés nem feltétlenül hibás
            adat. A hiányzó értékeket és a bizonytalan megfeleltetéseket nem
            javítjuk találgatással.
          </div>
          <div class="stats-grid">
            <button class="stat-card" v-for="t in types" @click="navigate(t)">
              <component :is="icons[t]" :size="22" />
              <div class="stat-number">{{ dash.quality[t] || 0 }}</div>
              <strong>{{ labels[t] }}</strong>
              <p>Felülvizsgálandó rekord</p>
            </button>
          </div>
          <section class="card padded">
            <h2>Biztonságos importszabályok</h2>
            <p>
              Legacy ID-k változatlanok · A nem feloldott adatgazda szöveg marad
              · Ismeretlen környezet: UNKNOWN · Hiányzó DB-kapcsolatokat nem
              hozunk létre.
            </p>
            <p>
              A RAM eredeti MB értéke megőrzött. Bináris GiB-konverzió csak az
              importelőnézetben kiválasztott profillal történik.
            </p>
            <button @click="navigate('transfer')">
              Importnapló és staging megnyitása →
            </button>
          </section></template
        >
        <template v-if="page === 'transfer'"
          ><div class="transfer-grid">
            <section class="card padded" v-if="caps.includes('import_data')">
              <div class="section-head">
                <h2><Upload :size="20" />Excel import</h2>
                <span class="tag">ELŐNÉZET → COMMIT</span>
              </div>
              <p>
                Az eredeti CMDB.xlsx betöltése ellenőrzött mezőleképezéssel.
              </p>
              <label class="upload-zone"
                ><Upload :size="28" /><strong>{{
                  upload?.name || "Válassz XLSX fájlt"
                }}</strong
                ><small
                  >Vagy használd a konfigurált eredeti forrást · max. 20
                  MB</small
                ><input
                  type="file"
                  accept=".xlsx"
                  @change="
                    upload =
                      ($event.target as HTMLInputElement).files?.[0] || null
                  " /></label
              ><label
                >Memóriaegység-profil<select v-model="ram">
                  <option value="preserve">
                    Nyers MB megőrzése · GiB üres marad
                  </option>
                  <option value="binary">
                    Jóváhagyom: bináris MB / 1024 → GiB
                  </option>
                </select></label
              >
              <p class="muted">
                A nyers memóriaértéket egyik profil sem kerekíti át. A nem
                feloldott adatgazda nem kerül automatikusan összekapcsolásra.
              </p>
              <button class="primary" @click="preview" :disabled="busy">
                {{ busy ? "Ellenőrzés…" : "Importelőnézet készítése" }}
              </button>
            </section>
            <section class="card padded" v-if="caps.includes('export_data')">
              <div class="section-head">
                <h2><Download :size="20" />Adatexport</h2>
                <span class="tag">HELYI FELDOLGOZÁS</span>
              </div>
              <p>Válaszd ki az exportálandó nyilvántartásokat.</p>
              <div class="export-checks">
                <label class="check" v-for="t in types"
                  ><input type="checkbox" v-model="exportTypes" :value="t" />{{
                    labels[t]
                  }}</label
                >
              </div>
              <label
                >Formátum<select v-model="exportFormat">
                  <option value="xlsx">Excel munkafüzet (.xlsx)</option>
                  <option value="zip">CSV fájlok ZIP-ben (.zip)</option>
                </select></label
              ><label
                >Terjedelem<select v-model="exportScope">
                  <option value="all">
                    Teljes kiválasztott nyilvántartások
                  </option>
                  <option value="filtered">Aktuális keresési szűrő</option>
                  <option value="selected">Kijelölt rekordok</option>
                </select></label
              ><button
                class="primary"
                @click="exportData"
                :disabled="busy || !exportTypes.length"
              >
                Export indítása
              </button>
              <p class="muted">
                Kapcsolati lapok, típusos értékek, exportmanifest és
                képletvédett szövegek.
              </p>
            </section>
          </div>
          <section v-if="importPreview" class="card padded">
            <div class="section-head">
              <h2>Importelőnézet</h2>
              <span class="tag">{{
                importPreview.noop ? "MÁR IMPORTÁLT FÁJL" : "ELLENŐRZÉSRE KÉSZ"
              }}</span>
            </div>
            <div class="import-summary">
              <strong
                >{{ importPreview.source_total
                }}<small>forrássor</small></strong
              ><strong
                >{{ importPreview.business_total
                }}<small>üzleti rekord</small></strong
              ><strong
                >{{ importPreview.staging_total
                }}<small>staging sor</small></strong
              ><strong
                >{{ importPreview.links.application_server
                }}<small>app–szerver kapcsolat</small></strong
              ><strong
                >{{ importPreview.links.application_contact
                }}<small>kontaktkapcsolat</small></strong
              >
            </div>
            <p>
              RAM-profil: {{ importPreview.ram_profile }} · A commit egyetlen
              tranzakcióban történik.
            </p>
            <div class="table-scroll preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Azonosító</th>
                    <th>Művelet</th>
                    <th>Ellenőrzési jelzések</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in importPreview.rows">
                    <td>
                      <code>{{ r.public_id }}</code>
                    </td>
                    <td>
                      {{
                        r.disposition === "staging"
                          ? "Staging"
                          : r.operation === "create"
                            ? "Létrehozás"
                            : r.operation === "unchanged"
                              ? "Változatlan"
                              : "Frissítés"
                      }}
                    </td>
                    <td>
                      {{ r.warnings.join(" · ") || "Nincs figyelmeztetés" }}
                      <details v-if="r.diff && Object.keys(r.diff).length">
                        <summary>Mezőváltozások</summary>
                        <pre>{{ JSON.stringify(r.diff, null, 2) }}</pre>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button class="primary" @click="commit" :disabled="busy">
              {{
                importPreview.noop
                  ? "Ismétlés ellenőrzése (no-op)"
                  : "Ellenőrzött import véglegesítése"
              }}
            </button>
          </section>
          <section class="card padded" v-if="caps.includes('import_data')">
            <h2>Importnapló és staging</h2>
            <p v-if="!importHistory.data.length">Még nincs import.</p>
            <div class="registry-row" v-for="r in importHistory.data">
              <code>{{ r.id.slice(-10) }}</code
              ><span>{{ r.profile }}</span
              ><span>{{ r.status }}</span
              ><time>{{ r.created_at }}</time>
            </div>
            <div v-for="r in importHistory.staging" class="notice">
              <code>{{ r.public_id }}</code
              >Csak azonosítót tartalmazó sor · {{ r.sheet }} /
              {{ r.row_number }} · nyers érték megőrizve
            </div>
          </section>
          <p
            v-if="
              !caps.includes('import_data') && !caps.includes('export_data')
            "
          >
            Ehhez a felülethez külön import- vagy exportjogosultság szükséges.
          </p></template
        >
        <template v-if="['users', 'references', 'zones'].includes(page)"
          ><div class="transfer-grid">
            <section class="card padded">
              <h2>Rögzített elemek</h2>
              <div class="registry-row" v-for="r in adminRows">
                <strong>{{ r.username || r.name || r.label }}</strong
                ><span>{{ r.role || r.scope || r.category }}</span
                ><code>{{ r.sso_identity ? "SSO" : r.code || "" }}</code>
              </div>
            </section>
            <form class="card padded" @submit.prevent="adminSave">
              <h2>Új elem</h2>
              <template v-if="page === 'users'"
                ><label
                  >Felhasználónév<input
                    v-model="adminForm.username"
                    required /></label
                ><label
                  >Jelszó<input
                    v-model="adminForm.password"
                    type="password"
                    minlength="12"
                    required
                    autocomplete="new-password" /></label
                ><label
                  >Szerep<select v-model="adminForm.role">
                    <option>viewer</option>
                    <option>editor</option>
                    <option>admin</option>
                  </select></label
                ><label
                  class="check"
                  v-for="c in [
                    'import_data',
                    'export_data',
                    'export_diagram',
                    'view_contact_details',
                  ]"
                  ><input
                    type="checkbox"
                    v-model="adminForm.capabilities"
                    :value="c"
                  />{{ c }}</label
                ></template
              ><template v-if="page === 'zones'"
                ><label
                  >Zóna neve<input v-model="adminForm.name" required /></label
                ><label
                  >Besorolás<select v-model="adminForm.scope">
                    <option
                      v-for="s in [
                        'internal',
                        'dmz',
                        'partner',
                        'external',
                        'unknown',
                      ]"
                    >
                      {{ s }}
                    </option>
                  </select></label
                ><label
                  >Szülőzóna<Lookup
                    type="network_zones"
                    v-model="adminForm.parent_zone_id"
                    :zones="meta.zones" /></label
                ><label
                  >Megjegyzés<textarea
                    v-model="adminForm.notes"
                  ></textarea></label></template
              ><template v-if="page === 'references'"
                ><label
                  >Kategória<input
                    v-model="adminForm.category"
                    required
                    placeholder="environment / criticality / role…" /></label
                ><label
                  >Stabil kód<input v-model="adminForm.code" required /></label
                ><label
                  >Magyar címke<input
                    v-model="adminForm.label"
                    required /></label
                ><label class="check"
                  ><input
                    v-model="adminForm.active"
                    type="checkbox"
                  />Aktív</label
                ></template
              ><button class="primary">Mentés</button>
            </form>
          </div></template
        >
        <template v-if="page === 'sso'">
          <form class="card padded sso-card" @submit.prevent="saveSso">
            <div class="section-heading">
              <div>
                <h2>Microsoft Entra ID / AD FS (OIDC)</h2>
                <p>
                  Authorization Code + PKCE alapú bejelentkezés. A kliens titka
                  titkosítva kerül az adatbázisba; az alkalmazáskulcs a privát
                  konfigurációs mappában marad.
                </p>
              </div>
              <label class="check switch-check"
                ><input v-model="ssoForm.enabled" type="checkbox" />SSO
                bekapcsolása</label
              >
            </div>
            <div class="notice">
              Az identitásszolgáltatónál pontosan ezt a webes átirányítási URI-t
              regisztráld: <code>{{ ssoForm.callback_url }}</code>
            </div>
            <div class="form-grid sso-grid">
              <label
                >Szolgáltató<select v-model="ssoForm.provider_type">
                  <option value="entra">Microsoft Entra ID</option>
                  <option value="adfs">AD FS / szabványos OIDC</option></select
                ><small>{{ ssoFields.provider_type }}</small></label
              >
              <label
                >Bejelentkezési gomb felirata<input
                  v-model="ssoForm.display_name"
                  maxlength="100"
                  required
                /><small>{{ ssoFields.display_name }}</small></label
              >
              <label v-if="ssoForm.provider_type === 'entra'"
                >Entra tenant ID<input
                  v-model="ssoForm.tenant_id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                /><small>{{ ssoFields.tenant_id }}</small></label
              >
              <label v-else class="span-2"
                >OIDC issuer URL<input
                  v-model="ssoForm.issuer_url"
                  type="url"
                  placeholder="https://adfs.pelda.hu/adfs"
                /><small>{{ ssoFields.issuer_url }}</small></label
              >
              <label
                >Application (client) ID<input
                  v-model="ssoForm.client_id"
                /><small>{{ ssoFields.client_id }}</small></label
              >
              <label
                >Client secret
                <input
                  v-model="ssoForm.client_secret"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Üresen hagyva a meglévő marad"
                />
                <small v-if="ssoFields.client_secret">{{
                  ssoFields.client_secret
                }}</small>
                <small v-else>{{
                  ssoForm.client_secret_configured
                    ? "Titok beállítva; az értéke nem olvasható vissza."
                    : "Még nincs kliens titok beállítva."
                }}</small>
              </label>
              <label
                v-if="ssoForm.client_secret_configured"
                class="check span-2"
                ><input
                  v-model="ssoForm.clear_client_secret"
                  type="checkbox"
                />A tárolt kliens titok törlése mentéskor</label
              >
              <label class="span-2"
                >Engedélyezett e-mail-tartományok
                <textarea
                  v-model="ssoForm.allowed_email_domains_text"
                  rows="3"
                  placeholder="pelda.hu&#10;leanyvallalat.hu"
                ></textarea>
                <small>{{
                  ssoFields.allowed_email_domains ||
                  "Opcionális; vesszővel vagy soronként. A tenant ellenőrzése ettől függetlenül kötelező."
                }}</small>
              </label>
              <label
                >Kötelező csoport objektumazonosító<input
                  v-model="ssoForm.required_group_id"
                  placeholder="Opcionális group object ID"
                /><small>{{ ssoFields.required_group_id }}</small></label
              >
              <label class="check"
                ><input v-model="ssoForm.auto_provision" type="checkbox" />Új
                SSO-felhasználók automatikus létrehozása</label
              >
              <label v-if="ssoForm.auto_provision"
                >Alapértelmezett szerep<select v-model="ssoForm.default_role">
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option></select
                ><small>{{ ssoFields.default_role }}</small></label
              >
              <fieldset
                v-if="ssoForm.auto_provision"
                class="span-2 checkbox-group"
              >
                <legend>Alapértelmezett extra jogosultságok</legend>
                <label
                  class="check"
                  v-for="c in [
                    'import_data',
                    'export_data',
                    'export_diagram',
                    'view_contact_details',
                  ]"
                  :key="c"
                  ><input
                    v-model="ssoForm.default_capabilities"
                    type="checkbox"
                    :value="c"
                  />{{ c }}</label
                >
              </fieldset>
            </div>
            <div v-if="error" class="notice danger" role="alert">
              {{ error }}
            </div>
            <div v-if="ssoTest" class="notice success" role="status">
              OIDC elérhető · kibocsátó: <code>{{ ssoTest.issuer }}</code>
            </div>
            <div class="form-actions">
              <button class="primary" :disabled="busy">
                Beállítások mentése
              </button>
              <button type="button" :disabled="busy" @click="testSso">
                Mentett konfiguráció tesztelése
              </button>
            </div>
            <p class="muted">
              Ha csoportkorlátozást használsz és a token csoporttúlfutást jelez,
              a belépés biztonsági okból elutasításra kerül. Graph
              API-lekérdezést ez a változat nem végez.
            </p>
          </form>
        </template>
        <div class="job-status" v-if="job">
          <strong>Export: {{ job.status }}</strong
          ><button
            v-if="job.status === 'completed'"
            class="button primary"
            :disabled="downloading"
            @click="downloadExport"
          >
            <Download :size="15" />{{
              downloading ? "Letöltés…" : "Letöltés"
            }}</button
          ><span v-if="job.error">{{ job.error }}</span
          ><button
            v-if="job.status === 'queued'"
            @click="api(`jobs/${job.id}/cancel`, 'POST').then(pollJob)"
          >
            Megszakítás</button
          ><button @click="job = null" aria-label="Export állapot bezárása">
            ×
          </button>
        </div>
        <footer class="page-footer">
          <span
            >ATLAS CMDB <span class="muted">/</span> HELYI MUNKAKÖRNYEZET</span
          ><span>Az ismeretlen adat is információ.</span>
        </footer>
      </main>
    </div>
    <div v-if="detail" class="drawer-overlay" @click.self="close">
      <section
        class="drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="editing ? 'Rekord szerkesztése' : 'Rekord adatlapja'"
      >
        <div class="drawer-head">
          <div>
            <div class="eyebrow">{{ labels[detailType] }}</div>
            <h2>
              {{
                editing
                  ? detail.id
                    ? "Rekord szerkesztése"
                    : "Új rekord"
                  : detail.name || detail.public_id
              }}
            </h2>
            <code>{{
              detail.public_id || "Az azonosító mentéskor készül"
            }}</code>
          </div>
          <button @click="close" aria-label="Adatlap bezárása">
            <X :size="20" />
          </button>
        </div>
        <div v-if="error" class="notice danger" role="alert">{{ error }}</div>
        <template v-if="editing"
          ><form
            @submit.prevent="save"
            @input="dirty = true"
            @change="dirty = true"
          >
            <div class="form-grid">
              <label
                v-for="(kind, f) in fields"
                :key="f"
                :class="{
                  'span-2': kind === 'long' || kind.startsWith('ref:'),
                }"
                >{{ labels[f] || f
                }}<Lookup
                  v-if="kind.startsWith('ref:')"
                  :type="kind.slice(4)"
                  v-model="form[f]"
                  :zones="meta.zones"
                /><select
                  v-else-if="
                    kind.startsWith('enum:') || kind.startsWith('select:')
                  "
                  v-model="form[f]"
                >
                  <option :value="null">Nincs megadva</option>
                  <option v-for="o in options(kind)" :value="o.code">
                    {{ o.label }}
                  </option></select
                ><select v-else-if="kind === 'bool'" v-model="form[f]">
                  <option :value="null">Ismeretlen</option>
                  <option :value="1">Igen</option>
                  <option :value="0">Nem</option></select
                ><textarea
                  v-else-if="kind === 'long'"
                  v-model="form[f]"
                  rows="3"
                  maxlength="20000"
                ></textarea
                ><input
                  v-else
                  v-model="form[f]"
                  :type="
                    kind === 'date'
                      ? 'date'
                      : ['int', 'decimal'].includes(kind)
                        ? 'number'
                        : 'text'
                  "
                  :step="kind === 'decimal' ? 'any' : 1"
                  :maxlength="255"
                /><small class="error" v-if="fieldErrors[f]">{{
                  fieldErrors[f]
                }}</small></label
              >
            </div>
            <section class="relation-editor" v-if="detailType === 'servers'">
              <h3>IP-címek</h3>
              <div v-for="(a, i) in form.addresses" class="child-row">
                <input v-model="a.address" placeholder="IPv4 / IPv6" /><select
                  v-model="a.zone_id"
                >
                  <option v-for="z in meta.zones" :value="z.id">
                    {{ z.name }}
                  </option></select
                ><label class="check"
                  ><input
                    type="checkbox"
                    v-model="a.is_primary"
                  />Elsődleges</label
                ><button type="button" @click="form.addresses.splice(i, 1)">
                  ×
                </button>
              </div>
              <button
                type="button"
                @click="
                  form.addresses.push({
                    address: '',
                    zone_id: meta.zones[0]?.id,
                    is_primary: false,
                  });
                  dirty = true;
                "
              >
                + IP-cím
              </button>
            </section>
            <section
              class="relation-editor"
              v-if="detailType === 'network_connections'"
            >
              <h3>Végpontok</h3>
              <div v-for="(e, i) in form.endpoints" class="child-block">
                <div class="inline">
                  <select v-model="e.side">
                    <option value="source">Forrás</option>
                    <option value="target">Cél</option></select
                  ><select v-model="e.endpoint_kind">
                    <option
                      v-for="k in [
                        'server',
                        'ip',
                        'cidr',
                        'fqdn',
                        'zone',
                        'any',
                      ]"
                    >
                      {{ k }}
                    </option></select
                  ><button type="button" @click="form.endpoints.splice(i, 1)">
                    Eltávolítás
                  </button>
                </div>
                <Lookup
                  v-if="e.endpoint_kind === 'server'"
                  type="servers"
                  v-model="e.server_id"
                /><Lookup
                  v-else-if="e.endpoint_kind === 'zone'"
                  type="network_zones"
                  v-model="e.zone_id"
                  :zones="meta.zones"
                /><input
                  v-else-if="e.endpoint_kind !== 'any'"
                  v-model="e.value"
                  placeholder="IP / CIDR / FQDN"
                />
                <p v-else class="notice">
                  Explicit bármely végpont. A szabály hatóköre nagyon tág lehet.
                </p>
              </div>
              <button
                type="button"
                @click="
                  form.endpoints.push({
                    side: 'source',
                    endpoint_kind: 'server',
                  });
                  dirty = true;
                "
              >
                + Végpont
              </button>
              <h3>Portok / szolgáltatások</h3>
              <div v-for="(s, i) in form.services" class="child-row">
                <select v-model="s.side">
                  <option value="source">Forrásport</option>
                  <option value="destination">Célport</option></select
                ><input
                  type="number"
                  v-model="s.port_from"
                  placeholder="1"
                  min="1"
                  max="65535"
                /><input
                  type="number"
                  v-model="s.port_to"
                  placeholder="65535"
                  min="1"
                  max="65535"
                /><button type="button" @click="form.services.splice(i, 1)">
                  ×
                </button>
              </div>
              <button
                type="button"
                @click="
                  form.services.push({
                    side: 'destination',
                    port_from: 443,
                    port_to: 443,
                  });
                  dirty = true;
                "
              >
                + Porttartomány
              </button>
            </section>
            <div class="drawer-footer">
              <span>{{
                dirty ? "Nem mentett módosítások" : "Minden módosítás auditált"
              }}</span
              ><button type="button" @click="close">Mégse</button
              ><button class="primary" :disabled="busy">
                {{ busy ? "Mentés…" : "Rekord mentése" }}
              </button>
            </div>
          </form></template
        ><template v-else
          ><div class="tabs">
            <button
              :class="{ active: tab === 'summary' }"
              @click="tab = 'summary'"
            >
              Összefoglaló</button
            ><button
              :class="{ active: tab === 'relations' }"
              @click="tab = 'relations'"
            >
              Kapcsolatok</button
            ><button
              :class="{ active: tab === 'audit' }"
              @click="tab = 'audit'"
            >
              Változások
            </button>
          </div>
          <div class="drawer-body">
            <template v-if="tab === 'summary'"
              ><div class="notice" v-if="detail.quality_warnings?.length">
                <AlertTriangle :size="18" />
                <div>
                  <strong>Felülvizsgálandó adat</strong>
                  <p v-for="w in detail.quality_warnings">{{ w }}</p>
                </div>
              </div>
              <dl class="detail-grid">
                <template v-for="(kind, f) in fields"
                  ><dt>{{ labels[f] || f }}</dt>
                  <dd v-if="kind.startsWith('ref:') && rel[f]">
                    <button
                      class="text-button"
                      @click="
                        kind.slice(4) !== 'network_zones' &&
                        open(kind.slice(4), rel[f].id)
                      "
                    >
                      {{ rel[f].name || rel[f].public_id }} →
                    </button>
                  </dd>
                  <dd v-else>{{ display(detail[f]) }}</dd></template
                >
              </dl>
              <div v-if="rel.addresses?.length">
                <h3>IP-címek</h3>
                <div class="chip" v-for="a in rel.addresses">
                  {{ a.address }} {{ a.is_primary ? "· elsődleges" : "" }}
                </div>
              </div></template
            ><template v-if="tab === 'relations'"
              ><template v-for="(rows, key) in rel"
                ><section
                  v-if="
                    Array.isArray(rows) &&
                    String(key) !== 'audit' &&
                    String(key) !== 'addresses'
                  "
                  class="relation-section"
                >
                  <h3>
                    {{ labels[key] || key }} <small>{{ rows.length }}</small>
                  </h3>
                  <div v-for="r in rows" class="related-record">
                    <button
                      class="text-button"
                      v-if="types.includes(String(key))"
                      @click="open(String(key), r.id)"
                    >
                      {{ r.public_id }} ·
                      {{ r.name || r.interface_type || "Név nélkül" }}</button
                    ><span v-else
                      >{{ r.side }} ·
                      {{ r.value || r.endpoint_kind || r.port_from }}
                      {{ r.port_to }}</span
                    ><small v-if="r.role_code"
                      >{{ r.role_code }} · {{ r.role_description }}</small
                    ><button
                      v-if="String(key) === 'contacts' && caps.includes('edit')"
                      @click="removeContact(r.assignment_id)"
                    >
                      Eltávolítás
                    </button>
                  </div>
                  <p v-if="!rows.length" class="muted">
                    Nincs rögzített kapcsolat.
                  </p>
                </section></template
              >
              <section
                v-if="detailType === 'integrations' && caps.includes('edit')"
                class="relation-editor"
              >
                <h3>Hálózati szabály megfeleltetése</h3>
                <Lookup
                  type="network_connections"
                  v-model="networkAssignment.connection_id"
                /><label
                  >Megfeleltetés indoklása<input
                    v-model="networkAssignment.mapping_notes" /></label
                ><button
                  :disabled="!networkAssignment.connection_id"
                  @click="addNetwork"
                >
                  Megfeleltetés mentése
                </button>
              </section>
              <section
                v-if="
                  ['applications', 'servers', 'databases'].includes(
                    detailType,
                  ) && caps.includes('edit')
                "
                class="relation-editor"
              >
                <h3>Kapcsolattartó hozzárendelése</h3>
                <Lookup type="contacts" v-model="relation.contact_id" /><label
                  >Szerep<select v-model="relation.role_code">
                    <option
                      v-for="r in meta.references.filter(
                        (x: any) => x.category === 'role',
                      )"
                      :value="r.code"
                    >
                      {{ r.label }}
                    </option>
                  </select></label
                ><label
                  >Szerep leírása<input
                    v-model="relation.role_description" /></label
                ><button @click="addContact" :disabled="!relation.contact_id">
                  Hozzárendelés
                </button>
              </section></template
            ><template v-if="tab === 'audit'"
              ><p v-if="!caps.includes('view_contact_details')">
                A részletes audit megtekintéséhez kontaktadat-jogosultság
                szükséges.
              </p>
              <details v-for="a in rel.audit" class="audit-entry">
                <summary>{{ a.created_at }} · {{ a.action }}</summary>
                <pre>{{ JSON.stringify(JSON.parse(a.diff), null, 2) }}</pre>
              </details></template
            >
          </div>
          <div class="drawer-footer">
            <a
              :href="`#/${detailType}/${detail.id}`"
              @click="notify('A címsorban található stabil link másolható.')"
              ><ExternalLink :size="14" />Állandó link</a
            ><button v-if="caps.includes('edit')" @click="archive">
              {{ detail.archived_at ? "Visszaállítás" : "Archiválás" }}</button
            ><button
              v-if="caps.includes('edit')"
              class="primary"
              @click="edit(false)"
            >
              Szerkesztés
            </button>
          </div></template
        >
      </section>
    </div>
    <div v-if="toast" class="toast" role="status">
      <Check :size="18" />{{ toast }}
    </div>
  </div>
</template>
