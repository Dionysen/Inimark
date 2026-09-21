<script setup lang="ts">
import { computed, useId, useTemplateRef } from "vue";
import type { UiTextFieldProps } from "./text-field.ts";

const props = withDefaults(defineProps<UiTextFieldProps>(), {
  modelValue: "",
  label: undefined,
  ariaLabel: undefined,
  description: undefined,
  error: undefined,
  placeholder: undefined,
  type: "text",
  disabled: false,
  readonly: false,
  autocomplete: undefined,
  name: undefined,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();

const input = useTemplateRef<HTMLInputElement>("input");
const id = useId();
const descriptionId = `${id}-description`;
const errorId = `${id}-error`;
const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.description) ids.push(descriptionId);
  if (props.error) ids.push(errorId);
  return ids.length > 0 ? ids.join(" ") : undefined;
});

function onInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}

function onChange(event: Event): void {
  emit("change", (event.target as HTMLInputElement).value);
}

defineExpose({
  focus: () => input.value?.focus(),
  select: () => input.value?.select(),
});
</script>

<template>
  <label class="dionysen-text-field" :class="{ 'is-disabled': disabled, 'is-invalid': error }">
    <span v-if="label" class="dionysen-text-field__label">{{ label }}</span>
    <span class="dionysen-text-field__surface">
      <span v-if="$slots.leading" class="dionysen-text-field__adornment" aria-hidden="true">
        <slot name="leading" />
      </span>
      <input
        :id="id"
        ref="input"
        class="dionysen-text-field__input"
        :value="modelValue"
        :type="type"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :aria-label="label ? undefined : ariaLabel"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="onInput"
        @change="onChange"
      />
      <span v-if="$slots.trailing" class="dionysen-text-field__adornment" aria-hidden="true">
        <slot name="trailing" />
      </span>
    </span>
    <span v-if="description" :id="descriptionId" class="dionysen-text-field__description">
      {{ description }}
    </span>
    <span v-if="error" :id="errorId" class="dionysen-text-field__error">
      {{ error }}
    </span>
  </label>
</template>
