<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "./api";
const props = defineProps<{ type: string; modelValue: any; zones?: any[] }>();
const emit = defineEmits(["update:modelValue"]);
const q = ref(""),
  items = ref<any[]>([]),
  page = ref(1),
  next = ref(false),
  error = ref("");
let generation = 0;
async function load() {
  const gen = ++generation;
  try {
    if (props.type === "network_zones") {
      items.value = (props.zones || []).map((z) => ({
        id: z.id,
        label: z.name,
      }));
      return;
    }
    const r = await api(
      `lookups/${props.type}&q=${encodeURIComponent(q.value)}&page=${page.value}`,
    );
    if (gen !== generation) return;
    items.value = r.data;
    next.value = !!r.links.next;
    if (
      props.modelValue &&
      !items.value.some((i) => i.id === props.modelValue)
    ) {
      const v = await api(`${props.type}/${props.modelValue}`);
      items.value.unshift({
        id: v.id,
        label: `${v.public_id} · ${v.name || "Név nélkül"}`,
      });
    }
  } catch (e: any) {
    error.value = e.message;
  }
}
watch(() => [props.type, props.modelValue], load, { immediate: true });
watch(q, () => {
  page.value = 1;
  load();
});
</script>
<template>
  <div class="lookup">
    <input
      v-if="type !== 'network_zones'"
      v-model="q"
      placeholder="Keresés név vagy ID alapján…"
      aria-label="Kapcsolat keresése"
    /><select
      :value="modelValue || ''"
      @change="
        emit(
          'update:modelValue',
          ($event.target as HTMLSelectElement).value || null,
        )
      "
    >
      <option value="">Nincs hozzárendelve</option>
      <option v-for="i in items" :key="i.id" :value="i.id">
        {{ i.label }}
      </option>
    </select>
    <div v-if="next || page > 1" class="inline">
      <button
        type="button"
        :disabled="page === 1"
        @click="
          page--;
          load();
        "
      >
        Előző</button
      ><small>{{ page }}. oldal</small
      ><button
        type="button"
        :disabled="!next"
        @click="
          page++;
          load();
        "
      >
        Következő
      </button>
    </div>
    <small class="error">{{ error }}</small>
  </div>
</template>
