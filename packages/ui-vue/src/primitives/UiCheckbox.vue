<script setup lang="ts">
import { useTemplateRef, watchEffect } from "vue";
import type { UiCheckboxProps } from "./checkbox.ts";

const props = withDefaults(defineProps<UiCheckboxProps>(), {
  modelValue: false,
  description: undefined,
  disabled: false,
  indeterminate: false,
  name: undefined,
  value: undefined,
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [value: boolean];
}>();

const input = useTemplateRef<HTMLInputElement>("input");

watchEffect(() => {
  if (input.value) input.value.indeterminate = props.indeterminate;
}, { flush: "post" });

function onChange(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  emit("update:modelValue", checked);
  emit("change", checked);
}
</script>

<template>
  <label class="dionysen-checkbox" :class="{ 'is-disabled': disabled }">
    <input
      ref="input"
      class="dionysen-checkbox__native"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :name="name"
      :value="value"
      :aria-checked="indeterminate ? 'mixed' : modelValue"
      @change="onChange"
    />
    <span class="dionysen-checkbox__box" aria-hidden="true">
      <svg v-if="indeterminate" viewBox="0 0 12 12"><path d="M2.5 6h7" /></svg>
      <svg v-else viewBox="0 0 12 12"><path d="m2.25 6.1 2.2 2.2 5.3-5.1" /></svg>
    </span>
    <span class="dionysen-checkbox__copy">
      <span class="dionysen-checkbox__label">{{ label }}</span>
      <span v-if="description" class="dionysen-checkbox__description">{{ description }}</span>
    </span>
  </label>
</template>
