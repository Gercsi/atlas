<script setup lang="ts">
import { labels, types } from "./api";
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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  KeyRound,
} from "lucide-vue-next";
defineProps<{
  page: string;
  user: { username: string; role: string };
  counts: Record<string, number>;
  qualityCount: number;
  collapsed: boolean;
}>();
const emit = defineEmits<{
  navigate: [page: string];
  logout: [];
  toggle: [];
}>();
const icons: any = {
  applications: AppWindow,
  servers: Server,
  databases: Database,
  integrations: Workflow,
  contacts: Users,
  network_connections: Network,
};
const sections = [
  {
    label: "",
    items: [{ id: "dashboard", label: "Áttekintés", icon: LayoutDashboard }],
  },
  {
    label: "NYILVÁNTARTÁSOK",
    items: types.map((id) => ({ id, label: labels[id], icon: icons[id] })),
  },
  {
    label: "KAPCSOLATOK ÉS ADATOK",
    items: [
      { id: "diagram", label: "Diagramok", icon: GitBranch },
      { id: "transfer", label: "Import / Export", icon: ArrowDownUp },
      { id: "quality", label: "Adatminőség", icon: ShieldCheck },
      { id: "tutorial", label: "Oktató", icon: BookOpen },
    ],
  },
  {
    label: "ADMINISZTRÁCIÓ",
    items: [
      { id: "references", label: "Szótárak", icon: Settings },
      { id: "zones", label: "Hálózati zónák", icon: Network },
      { id: "users", label: "Felhasználók", icon: Users },
      { id: "sso", label: "SSO bejelentkezés", icon: KeyRound },
    ],
    admin: true,
  },
];
</script>
<template>
  <aside class="sidebar">
    <a
      class="brand"
      href="#/dashboard"
      aria-label="Atlas CMDB áttekintés"
      @click.prevent="emit('navigate', 'dashboard')"
      ><Boxes :size="28" /><span>atlas<span class="brand-dot">.</span></span
      ><small>CMDB</small></a
    >
    <button
      class="sidebar-toggle"
      :title="collapsed ? 'Navigáció kinyitása' : 'Navigáció összecsukása'"
      :aria-label="collapsed ? 'Navigáció kinyitása' : 'Navigáció összecsukása'"
      :aria-expanded="!collapsed"
      aria-controls="main-navigation"
      @click="emit('toggle')"
    >
      <PanelLeftOpen v-if="collapsed" :size="18" /><PanelLeftClose
        v-else
        :size="18"
      /><span>Menü összecsukása</span>
    </button>
    <div class="workspace-switch">
      <span class="workspace-avatar">H</span>
      <div>
        <strong>Házi infrastruktúra</strong><small>Privát munkaterület</small>
      </div>
      <span class="live-dot"></span>
    </div>
    <nav id="main-navigation" aria-label="Fő navigáció">
      <template v-for="section in sections" :key="section.label">
        <template v-if="!section.admin || user.role === 'admin'">
          <div v-if="section.label" class="nav-section">
            {{ section.label }}
          </div>
          <a
            v-for="item in section.items"
            :key="item.id"
            :href="'#/' + item.id"
            :class="{ active: page === item.id }"
            :title="item.label"
            :aria-label="item.label"
            :aria-current="page === item.id ? 'page' : undefined"
            @click.prevent="emit('navigate', item.id)"
          >
            <component :is="item.icon" :size="18" /><span>{{ item.label }}</span
            ><small v-if="types.includes(item.id)">{{
              counts[item.id] || 0
            }}</small
            ><small v-else-if="item.id === 'quality'" class="warning-count">{{
              qualityCount
            }}</small>
          </a>
        </template>
      </template>
    </nav>
    <div class="sidebar-bottom">
      <div class="local-status">
        <span class="live-dot"></span>Helyi munkaterület
      </div>
      <div class="user-card">
        <span class="avatar">{{
          user.username.slice(0, 2).toUpperCase()
        }}</span>
        <div>
          <strong>{{ user.username }}</strong
          ><small>{{
            user.role === "admin" ? "Adminisztrátor" : user.role
          }}</small>
        </div>
        <button
          title="Kijelentkezés"
          aria-label="Kijelentkezés"
          @click="emit('logout')"
        >
          <LogOut :size="17" />
        </button>
      </div>
    </div>
  </aside>
</template>
