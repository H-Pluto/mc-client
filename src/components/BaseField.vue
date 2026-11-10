<script setup lang="ts">
import { useSlots } from 'vue'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    id: string
    label: string
    type?: string
    error?: string
    hint?: string
  }>(),
  { type: 'text' },
)

const model = defineModel<string>({ required: true })

const slots = useSlots()
</script>

<template>
  <div class="field" :class="{ 'field--invalid': error }">
    <label class="field__label" :for="id">{{ label }}</label>
    <div class="field__control" :class="{ 'field__control--suffix': !!slots.suffix }">
      <input
        :id="id"
        v-model="model"
        class="field__input"
        :type="type"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
        v-bind="$attrs"
      />
      <div v-if="slots.suffix" class="field__suffix">
        <slot name="suffix" />
      </div>
    </div>
    <p v-if="error" :id="`${id}-error`" class="field__error">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.field__label {
  color: var(--text-muted);
  font-size: 13px;
}

.field__control {
  position: relative;
  min-width: 0;
}

.field__input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  background: var(--panel-input);
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 14px;
  caret-color: var(--gold);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.field__control--suffix .field__input {
  padding-right: 76px;
}

.field__input::placeholder {
  color: var(--text-dim);
  font-family: var(--font-sans);
}

.field__input:hover {
  border-color: var(--line-strong);
}

.field__input:focus {
  outline: none;
  border-color: var(--gold);
  background: #141a21;
  box-shadow: 0 0 0 3px rgba(226, 165, 75, 0.14);
}

.field--invalid .field__input {
  border-color: rgba(229, 119, 95, 0.65);
}

.field--invalid .field__input:focus {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px rgba(229, 119, 95, 0.14);
}

.field__suffix {
  position: absolute;
  right: 6px;
  top: 50%;
  display: flex;
  transform: translateY(-50%);
}

.field__error,
.field__hint {
  font-size: 12px;
}

.field__error {
  color: var(--danger);
}

.field__hint {
  color: var(--text-dim);
}

@media (prefers-reduced-motion: reduce) {
  .field__input {
    transition: none;
  }
}
</style>
