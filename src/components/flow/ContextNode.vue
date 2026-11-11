<script setup lang="ts">
import { computed } from 'vue'
import { useVueFlow, type HandleConnectable } from '@vue-flow/core'

import NodeFrame from '@/components/flow/NodeFrame.vue'
import { ENTITY_CHOICES } from '@/lib/flow/catalog'
import { POSITION_OPTIONS, ROLE_OPTIONS, positionPhrase, rolePhrase } from '@/lib/flow/options'
import { createContextData, type ContextNodeData } from '@/lib/flow/types'

const props = defineProps<{
  id: string
  data: ContextNodeData
  connectable?: HandleConnectable
}>()

const { updateNodeData } = useVueFlow()
const updateData = updateNodeData as unknown as (id: string, data: unknown) => void

const role = computed(() => (props.data.kind === 'role' ? props.data : null))
const position = computed(() => (props.data.kind === 'position' ? props.data : null))
const phrase = computed(() =>
  props.data.kind === 'role' ? rolePhrase(props.data) : positionPhrase(props.data),
)

function readValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}

function setKind(kind: 'role' | 'position') {
  if (props.data.kind === kind) return
  updateData(props.id, createContextData(kind))
}

function setField(key: string, event: Event) {
  updateData(props.id, { [key]: readValue(event) })
}
</script>

<template>
  <NodeFrame :id="id" chip="上下文" tone="context" :phrase="phrase" :connectable="connectable">
    <div class="segmented" role="group" aria-label="上下文类型">
      <button type="button" :class="{ 'is-active': role }" @click="setKind('role')">身份</button>
      <button type="button" :class="{ 'is-active': position }" @click="setKind('position')">
        位置
      </button>
    </div>

    <template v-if="role">
      <label class="field">
        <span class="field__label">以谁的身份</span>
        <select class="field__control" :value="role.value" @change="setField('value', $event)">
          <option v-for="option in ROLE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="role.value === 'specific_player'" class="field">
        <span class="field__label">玩家名</span>
        <input
          class="field__control"
          :value="role.player"
          placeholder="输入玩家名"
          autocomplete="off"
          spellcheck="false"
          @input="setField('player', $event)"
        />
      </label>

      <label v-if="role.value === 'entity_type'" class="field">
        <span class="field__label">实体类型</span>
        <select class="field__control" :value="role.entityType" @change="setField('entityType', $event)">
          <option v-for="choice in ENTITY_CHOICES" :key="choice.value" :value="choice.value">
            {{ choice.label }}
          </option>
        </select>
      </label>
    </template>

    <template v-else-if="position">
      <label class="field">
        <span class="field__label">在哪里</span>
        <select class="field__control" :value="position.value" @change="setField('value', $event)">
          <option v-for="option in POSITION_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <div v-if="position.value === 'coords'" class="coords">
        <label class="field">
          <span class="field__label">X</span>
          <input class="field__control" :value="position.x" @input="setField('x', $event)" />
        </label>
        <label class="field">
          <span class="field__label">Y</span>
          <input class="field__control" :value="position.y" @input="setField('y', $event)" />
        </label>
        <label class="field">
          <span class="field__label">Z</span>
          <input class="field__control" :value="position.z" @input="setField('z', $event)" />
        </label>
      </div>

      <p v-if="position.value === 'first_player'" class="field__hint">
        以第一位在线玩家的位置为准；服务器没有玩家时会失效。
      </p>
    </template>
  </NodeFrame>
</template>
