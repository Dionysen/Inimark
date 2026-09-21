<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { UiPopoverProps } from "./popover.ts";

const props = withDefaults(defineProps<UiPopoverProps>(), {
  modelValue: false,
  disabled: false,
  align: "start",
  width: "320px",
});

const emit = defineEmits<{
  "update:modelValue": [open: boolean];
}>();

const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();

function setOpen(open: boolean, restoreFocus = false): void {
  if (open && props.disabled) return;
  emit("update:modelValue", open);
  if (!open && restoreFocus) void nextTick(() => trigger.value?.focus());
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !props.modelValue) return;
  event.preventDefault();
  setOpen(false, true);
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!props.modelValue) return;
  if (event.target instanceof Node && root.value?.contains(event.target)) return;
  setOpen(false);
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="root" class="dionysen-popover" :class="`dionysen-popover--${align}`">
    <button
      ref="trigger"
      type="button"
      class="dionysen-popover__trigger"
      :disabled="disabled"
      aria-haspopup="dialog"
      :aria-expanded="modelValue"
      @click="setOpen(!modelValue)"
    >
      <slot name="trigger">{{ triggerLabel }}</slot>
    </button>
    <div
      v-if="modelValue"
      class="dionysen-popover__surface"
      role="dialog"
      aria-modal="false"
      :aria-label="triggerLabel"
      :style="{ width }"
    >
      <slot :close="() => setOpen(false, true)" />
    </div>
  </div>
</template>
