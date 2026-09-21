<script setup lang="ts">
import type { UiToggleProps } from "./toggle.ts";

const props = withDefaults(defineProps<UiToggleProps>(), {
  modelValue: false,
  description: undefined,
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [value: boolean];
}>();

function toggle(): void {
  if (props.disabled) return;
  const next = !props.modelValue;
  emit("update:modelValue", next);
  emit("change", next);
}
</script>

<template>
  <button
    type="button"
    class="dionysen-toggle-row"
    :class="{ 'is-on': modelValue }"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="dionysen-toggle-row__copy">
      <span class="dionysen-toggle-row__label">{{ label }}</span>
      <span v-if="description" class="dionysen-toggle-row__description">{{ description }}</span>
    </span>
    <span class="dionysen-toggle-row__track" aria-hidden="true">
      <span class="dionysen-toggle-row__thumb" />
    </span>
  </button>
</template>
