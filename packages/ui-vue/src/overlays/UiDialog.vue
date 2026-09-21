<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import UiIconButton from "../primitives/UiIconButton.vue";
import type { UiDialogProps } from "./dialog.ts";

const props = withDefaults(defineProps<UiDialogProps>(), {
  modelValue: false,
  description: undefined,
  closeLabel: "Close",
  closeOnBackdrop: true,
  closeOnEscape: true,
  size: "medium",
});

const emit = defineEmits<{
  "update:modelValue": [open: boolean];
  close: [reason: "escape" | "backdrop" | "button"];
}>();

const panel = ref<HTMLElement>();
const titleId = `${useId()}-title`;
const descriptionId = `${titleId}-description`;
let restoreTarget: HTMLElement | null = null;
let previousBodyOverflow = "";

const focusableSelector = [
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(): HTMLElement[] {
  return panel.value
    ? [...panel.value.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
      )
    : [];
}

function requestClose(reason: "escape" | "backdrop" | "button"): void {
  emit("update:modelValue", false);
  emit("close", reason);
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (!props.modelValue) return;
  if (event.key === "Escape" && props.closeOnEscape) {
    event.preventDefault();
    requestClose("escape");
    return;
  }
  if (event.key !== "Tab") return;

  const elements = focusableElements();
  if (elements.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function onBackdropMouseDown(event: MouseEvent): void {
  if (event.target === event.currentTarget && props.closeOnBackdrop) {
    requestClose("backdrop");
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onDocumentKeydown, true);
      void nextTick(() => {
        const preferred = panel.value?.querySelector<HTMLElement>("[autofocus]");
        (preferred ?? focusableElements()[0] ?? panel.value)?.focus();
      });
    } else {
      document.removeEventListener("keydown", onDocumentKeydown, true);
      document.body.style.overflow = previousBodyOverflow;
      void nextTick(() => restoreTarget?.focus());
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDocumentKeydown, true);
  document.body.style.overflow = previousBodyOverflow;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="dionysen-dialog__backdrop"
      @mousedown="onBackdropMouseDown"
    >
      <section
        ref="panel"
        class="dionysen-dialog"
        :class="`dionysen-dialog--${size}`"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descriptionId : undefined"
        tabindex="-1"
      >
        <header class="dionysen-dialog__header">
          <div class="dionysen-dialog__heading">
            <h2 :id="titleId" class="dionysen-dialog__title">{{ title }}</h2>
            <p v-if="description" :id="descriptionId" class="dionysen-dialog__description">
              {{ description }}
            </p>
          </div>
          <UiIconButton :label="closeLabel" size="small" @press="requestClose('button')">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </UiIconButton>
        </header>
        <div class="dionysen-dialog__body">
          <slot />
        </div>
        <footer v-if="$slots.actions" class="dionysen-dialog__actions">
          <slot name="actions" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>
