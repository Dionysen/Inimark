<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRaw,
  watch,
  type Component,
} from "vue";
import type { UiIconTabItem, UiIconTabsProps } from "./icon-tabs.ts";

const props = withDefaults(defineProps<UiIconTabsProps>(), {
  modelValue: undefined,
  label: "Panels",
});

const emit = defineEmits<{
  "update:modelValue": [id: string];
  select: [item: UiIconTabItem];
}>();

const root = ref<HTMLElement>();
const hiddenIds = ref<Set<string>>(new Set());
let resizeObserver: ResizeObserver | undefined;
let measureVersion = 0;

function iconComponent(icon: Component): Component {
  return toRaw(icon);
}

function select(item: UiIconTabItem): void {
  if (item.disabled) return;
  emit("update:modelValue", item.id);
  emit("select", item);
}

async function reflow(): Promise<void> {
  const version = ++measureVersion;
  hiddenIds.value = new Set();
  await nextTick();
  if (version !== measureVersion || !root.value) return;

  const buttons = [...root.value.querySelectorAll<HTMLElement>("[role='tab']")];
  const styles = getComputedStyle(root.value);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
  const available = root.value.clientWidth;
  let used = 0;
  const hidden = new Set<string>();

  for (const button of buttons) {
    const id = button.dataset.tabId;
    if (!id) continue;
    const need = (used > 0 ? gap : 0) + button.offsetWidth;
    if (used + need <= available + 0.5) used += need;
    else hidden.add(id);
  }
  hiddenIds.value = hidden;
}

watch(() => props.items, () => void reflow(), { deep: true });

onMounted(() => {
  resizeObserver = new ResizeObserver(() => void reflow());
  if (root.value) resizeObserver.observe(root.value);
  void reflow();
});

onBeforeUnmount(() => resizeObserver?.disconnect());

defineExpose({ reflow });
</script>

<template>
  <div ref="root" class="dionysen-icon-tabs" role="tablist" :aria-label="label">
    <button
      v-for="item in items"
      v-show="!hiddenIds.has(item.id)"
      :key="item.id"
      type="button"
      class="dionysen-icon-tabs__tab"
      :class="{ 'is-active': item.id === modelValue }"
      :data-tab-id="item.id"
      role="tab"
      :title="item.label"
      :aria-label="item.label"
      :aria-selected="item.id === modelValue"
      :disabled="item.disabled"
      @click="select(item)"
    >
      <component :is="iconComponent(item.icon)" aria-hidden="true" />
    </button>
  </div>
</template>
