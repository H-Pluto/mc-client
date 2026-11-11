<script setup lang="ts">
import { Handle, Position, useVueFlow, type HandleConnectable } from '@vue-flow/core'

withDefaults(
  defineProps<{
    id: string
    chip: string
    tone: 'context' | 'condition' | 'command'
    phrase: string
    target?: boolean
    source?: boolean
    connectable?: HandleConnectable
  }>(),
  { target: true, source: true },
)

const { removeNodes } = useVueFlow()
</script>

<template>
  <div class="flow-node" :data-tone="tone">
    <Handle v-if="target" type="target" :position="Position.Top" :connectable="connectable" />

    <header class="flow-node__head">
      <span class="flow-node__chip">{{ chip }}</span>
      <button
        class="flow-node__remove nodrag"
        type="button"
        :aria-label="`删除${chip}节点`"
        @click="removeNodes([id])"
      >
        ×
      </button>
    </header>

    <p class="flow-node__phrase">{{ phrase }}</p>

    <div class="flow-node__body nodrag">
      <slot />
    </div>

    <Handle v-if="source" type="source" :position="Position.Bottom" :connectable="connectable" />
  </div>
</template>
