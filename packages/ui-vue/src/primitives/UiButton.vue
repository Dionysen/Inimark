<script setup lang="ts">
import { computed } from "vue";
import type { UiButtonProps } from "./button.ts";

const props = withDefaults(defineProps<UiButtonProps>(), {
  variant: "default",
  size: "medium",
  disabled: false,
  loading: false,
  type: "button",
});

const emit = defineEmits<{
  press: [event: MouseEvent];
}>();

const isDisabled = computed(() => props.disabled || props.loading);

function handleClick(event: MouseEvent): void {
  if (isDisabled.value) return;
  emit("press", event);
}
</script>

<template>
  <button
    :type="type"
    class="dionysen-button"
    :class="[
      `dionysen-button--${variant}`,
      `dionysen-button--${size}`,
      { 'is-loading': loading },
    ]"
    :disabled="isDisabled"
    :aria-busy="loading ? 'true' : undefined"
    @click="handleClick"
  >
    <span v-if="loading" class="dionysen-button__spinner" aria-hidden="true" />
    <span v-if="$slots.icon" class="dionysen-button__icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <span class="dionysen-button__label"><slot /></span>
  </button>
</template>
