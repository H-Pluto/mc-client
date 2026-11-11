<script setup lang="ts">
import { computed } from 'vue'
import { useVueFlow, type HandleConnectable } from '@vue-flow/core'

import NodeFrame from '@/components/flow/NodeFrame.vue'
import { BLOCK_CHOICES, ITEM_CHOICES } from '@/lib/flow/catalog'
import { CONDITION_OPTIONS, OPERATOR_OPTIONS, conditionPhrase } from '@/lib/flow/options'
import {
  createConditionData,
  type ConditionKind,
  type ConditionNodeData,
} from '@/lib/flow/types'

const props = defineProps<{
  id: string
  data: ConditionNodeData
  connectable?: HandleConnectable
}>()

const { updateNodeData } = useVueFlow()
const updateData = updateNodeData as unknown as (id: string, data: unknown) => void

const score = computed(() => (props.data.kind === 'score' ? props.data : null))
const block = computed(() => (props.data.kind === 'block' ? props.data : null))
const holding = computed(() => (props.data.kind === 'holding' ? props.data : null))
const phrase = computed(() => conditionPhrase(props.data))

function readValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}

function setKind(event: Event) {
  updateData(props.id, createConditionData(readValue(event) as ConditionKind))
}

function setField(key: string, event: Event) {
  updateData(props.id, { [key]: readValue(event) })
}
</script>

<template>
  <NodeFrame :id="id" chip="条件" tone="condition" :phrase="phrase" :connectable="connectable">
    <label class="field">
      <span class="field__label">满足什么条件</span>
      <select class="field__control" :value="data.kind" @change="setKind">
        <option v-for="option in CONDITION_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <template v-if="score">
      <label class="field">
        <span class="field__label">计分板名称</span>
        <input
          class="field__control"
          :value="score.objective"
          placeholder="例如 points"
          autocomplete="off"
          spellcheck="false"
          @input="setField('objective', $event)"
        />
      </label>

      <div class="field__row">
        <label class="field">
          <span class="field__label">分数关系</span>
          <select class="field__control" :value="score.operator" @change="setField('operator', $event)">
            <option v-for="option in OPERATOR_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="field field__num">
          <span class="field__label">分数</span>
          <input
            class="field__control"
            type="number"
            :value="score.value"
            @input="setField('value', $event)"
          />
        </label>
      </div>
    </template>

    <label v-else-if="block" class="field">
      <span class="field__label">脚下一格的方块</span>
      <select class="field__control" :value="block.block" @change="setField('block', $event)">
        <option v-for="choice in BLOCK_CHOICES" :key="choice.value" :value="choice.value">
          {{ choice.label }}
        </option>
      </select>
    </label>

    <label v-else-if="holding" class="field">
      <span class="field__label">主手里拿着的物品</span>
      <select class="field__control" :value="holding.item" @change="setField('item', $event)">
        <option v-for="choice in ITEM_CHOICES" :key="choice.value" :value="choice.value">
          {{ choice.label }}
        </option>
      </select>
    </label>

    <p v-else class="field__hint">只要服务器里有玩家在线，就会继续往下执行。</p>
  </NodeFrame>
</template>
