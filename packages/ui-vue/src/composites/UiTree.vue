<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch, type Component } from "vue";
import type { UiTreeNode, UiTreeProps } from "./tree.ts";

interface VisibleNode {
  node: UiTreeNode;
  depth: number;
  parentId?: string;
}

const props = withDefaults(defineProps<UiTreeProps>(), {
  expandedIds: () => [],
  selectedId: undefined,
  label: "Files",
});

const emit = defineEmits<{
  "update:expandedIds": [ids: string[]];
  select: [node: UiTreeNode];
}>();

const tree = ref<HTMLElement>();
const focusedId = ref<string>();

function iconComponent(icon: Component | undefined): Component | undefined {
  return icon ? toRaw(icon) : undefined;
}

function flatten(nodes: UiTreeNode[], depth = 1, parentId?: string): VisibleNode[] {
  const result: VisibleNode[] = [];
  for (const node of nodes) {
    result.push({ node, depth, parentId });
    if (node.kind === "folder" && props.expandedIds.includes(node.id) && node.children) {
      result.push(...flatten(node.children, depth + 1, node.id));
    }
  }
  return result;
}

const visibleNodes = computed(() => flatten(props.nodes));

watch(
  () => [props.selectedId, visibleNodes.value[0]?.node.id] as const,
  ([selected, first]) => {
    if (!focusedId.value || !visibleNodes.value.some(({ node }) => node.id === focusedId.value)) {
      focusedId.value = selected ?? first;
    }
  },
  { immediate: true },
);

function rowElements(): HTMLElement[] {
  return tree.value
    ? [...tree.value.querySelectorAll<HTMLElement>("[role='treeitem']:not([aria-disabled='true'])")]
    : [];
}

function focusNode(id: string | undefined): void {
  if (!id) return;
  focusedId.value = id;
  void nextTick(() => {
    const target = rowElements().find((row) => row.dataset.nodeId === id);
    target?.focus();
  });
}

function toggle(node: UiTreeNode, force?: boolean): void {
  if (node.kind !== "folder" || node.disabled) return;
  const ids = new Set(props.expandedIds);
  const expand = force ?? !ids.has(node.id);
  if (expand) ids.add(node.id);
  else ids.delete(node.id);
  emit("update:expandedIds", [...ids]);
}

function select(node: UiTreeNode): void {
  if (node.disabled) return;
  focusedId.value = node.id;
  emit("select", node);
}

function onKeydown(event: KeyboardEvent, entry: VisibleNode): void {
  const entries = visibleNodes.value.filter(({ node }) => !node.disabled);
  const index = entries.findIndex(({ node }) => node.id === entry.node.id);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusNode(entries[Math.min(index + 1, entries.length - 1)]?.node.id);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusNode(entries[Math.max(index - 1, 0)]?.node.id);
  } else if (event.key === "Home") {
    event.preventDefault();
    focusNode(entries[0]?.node.id);
  } else if (event.key === "End") {
    event.preventDefault();
    focusNode(entries.at(-1)?.node.id);
  } else if (event.key === "ArrowRight" && entry.node.kind === "folder") {
    event.preventDefault();
    if (!props.expandedIds.includes(entry.node.id)) toggle(entry.node, true);
    else focusNode(entry.node.children?.find((node) => !node.disabled)?.id);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (entry.node.kind === "folder" && props.expandedIds.includes(entry.node.id)) {
      toggle(entry.node, false);
    } else {
      focusNode(entry.parentId);
    }
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select(entry.node);
  }
}
</script>

<template>
  <div ref="tree" class="dionysen-tree" role="tree" :aria-label="label">
    <div
      v-for="entry in visibleNodes"
      :key="entry.node.id"
      class="dionysen-tree__item"
      :class="{
        'is-selected': entry.node.id === selectedId,
        'is-disabled': entry.node.disabled,
      }"
      role="treeitem"
      :data-node-id="entry.node.id"
      :aria-level="entry.depth"
      :aria-selected="entry.node.id === selectedId"
      :aria-disabled="entry.node.disabled || undefined"
      :aria-expanded="entry.node.kind === 'folder' ? expandedIds.includes(entry.node.id) : undefined"
      :tabindex="entry.node.id === focusedId && !entry.node.disabled ? 0 : -1"
      :style="{ '--tree-depth': entry.depth - 1 }"
      @click="select(entry.node)"
      @focus="focusedId = entry.node.id"
      @keydown="onKeydown($event, entry)"
    >
      <span
        class="dionysen-tree__chevron"
        :class="{ 'is-expanded': expandedIds.includes(entry.node.id) }"
        aria-hidden="true"
        @click.stop="toggle(entry.node)"
      >
        <svg v-if="entry.node.kind === 'folder'" viewBox="0 0 16 16"><path d="m6 4 4 4-4 4" /></svg>
      </span>
      <span class="dionysen-tree__kind-icon" aria-hidden="true">
        <component :is="iconComponent(entry.node.icon)" v-if="entry.node.icon" />
        <svg v-else-if="entry.node.kind === 'folder'" viewBox="0 0 16 16">
          <path v-if="expandedIds.includes(entry.node.id)" d="M2 5h5l1.3 1.5H14l-1.5 6H3z" />
          <path v-else d="M2 4h5l1.3 1.5H14V12H2z" />
        </svg>
        <svg v-else viewBox="0 0 16 16"><path d="M4 2.5h5l3 3V13.5H4zM9 2.5v3h3" /></svg>
      </span>
      <span class="dionysen-tree__label">{{ entry.node.label }}</span>
    </div>
  </div>
</template>
