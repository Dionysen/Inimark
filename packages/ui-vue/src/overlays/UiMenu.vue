<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, toRaw, type Component } from "vue";
import type { UiMenuItem, UiMenuProps } from "./menu.ts";

const props = withDefaults(defineProps<UiMenuProps>(), {
  modelValue: false,
  disabled: false,
  align: "start",
});

const emit = defineEmits<{
  "update:modelValue": [open: boolean];
  select: [item: UiMenuItem];
}>();

const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const surface = ref<HTMLElement>();

function iconComponent(icon: Component | undefined): Component | undefined {
  return icon ? toRaw(icon) : undefined;
}

function menuButtons(): HTMLButtonElement[] {
  if (!surface.value) return [];
  return [...surface.value.querySelectorAll<HTMLButtonElement>("[role^='menuitem']:not(:disabled)")];
}

function focusItem(index: number): void {
  const buttons = menuButtons();
  if (buttons.length === 0) return;
  const normalized = (index + buttons.length) % buttons.length;
  buttons[normalized]?.focus();
}

function setOpen(open: boolean, options: { focusFirst?: boolean; restoreFocus?: boolean } = {}): void {
  if (props.disabled && open) return;
  emit("update:modelValue", open);
  if (open && options.focusFirst) {
    void nextTick(() => focusItem(0));
  } else if (!open && options.restoreFocus) {
    void nextTick(() => trigger.value?.focus());
  }
}

function toggleFromPointer(): void {
  setOpen(!props.modelValue);
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setOpen(true, { focusFirst: true });
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setOpen(true);
    void nextTick(() => focusItem(-1));
  }
}

function onMenuKeydown(event: KeyboardEvent): void {
  const buttons = menuButtons();
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusItem(current + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusItem(current - 1);
  } else if (event.key === "Home") {
    event.preventDefault();
    focusItem(0);
  } else if (event.key === "End") {
    event.preventDefault();
    focusItem(-1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    setOpen(false, { restoreFocus: true });
  } else if (event.key === "Tab") {
    setOpen(false);
  }
}

function selectItem(item: UiMenuItem): void {
  if (item.disabled) return;
  emit("select", item);
  setOpen(false, { restoreFocus: true });
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!props.modelValue) return;
  if (event.target instanceof Node && root.value?.contains(event.target)) return;
  setOpen(false);
}

onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown, true));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointerDown, true));
</script>

<template>
  <div ref="root" class="dionysen-menu" :class="`dionysen-menu--${align}`">
    <button
      ref="trigger"
      type="button"
      class="dionysen-menu__trigger"
      :disabled="disabled"
      aria-haspopup="menu"
      :aria-expanded="modelValue"
      @click="toggleFromPointer"
      @keydown="onTriggerKeydown"
    >
      <span v-if="$slots['trigger-icon']" class="dionysen-menu__trigger-icon" aria-hidden="true">
        <slot name="trigger-icon" />
      </span>
      <span>{{ triggerLabel }}</span>
      <svg class="dionysen-menu__chevron" viewBox="0 0 12 12" aria-hidden="true">
        <path d="m3 4.5 3 3 3-3" />
      </svg>
    </button>

    <div
      v-if="modelValue"
      ref="surface"
      class="dionysen-menu__surface"
      role="menu"
      :aria-label="triggerLabel"
      @keydown="onMenuKeydown"
    >
      <template v-for="item in items" :key="item.id">
        <div v-if="item.separatorBefore" class="dionysen-menu__separator" role="separator" />
        <button
          type="button"
          class="dionysen-menu__item"
          :class="{ 'is-danger': item.danger }"
          :role="item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
          :aria-checked="item.checked"
          :disabled="item.disabled"
          @click="selectItem(item)"
        >
          <span class="dionysen-menu__item-icon" aria-hidden="true">
            <component :is="iconComponent(item.icon)" v-if="item.icon" />
          </span>
          <span class="dionysen-menu__item-label">{{ item.label }}</span>
          <span class="dionysen-menu__item-trailing">
            <kbd v-if="item.shortcut" class="dionysen-menu__shortcut">{{ item.shortcut }}</kbd>
            <svg v-if="item.checked" class="dionysen-menu__check" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m3 8 3 3 7-7" />
            </svg>
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
