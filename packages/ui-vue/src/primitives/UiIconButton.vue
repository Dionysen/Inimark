<script setup lang="ts">
import type { UiIconButtonProps } from "./icon-button.ts";

withDefaults(defineProps<UiIconButtonProps>(), {
  variant: "ghost",
  size: "medium",
  disabled: false,
  active: false,
  pressed: undefined,
  type: "button",
});

defineEmits<{
  press: [event: MouseEvent];
}>();
</script>

<template>
  <button
    :type="type"
    class="dionysen-icon-button"
    :class="[
      `dionysen-icon-button--${variant}`,
      `dionysen-icon-button--${size}`,
      { 'is-active': active || pressed },
    ]"
    :aria-label="label"
    :aria-pressed="pressed"
    :title="label"
    :disabled="disabled"
    @click="$emit('press', $event)"
  >
    <span class="dionysen-icon-button__icon" aria-hidden="true">
      <slot />
    </span>
  </button>
</template>
