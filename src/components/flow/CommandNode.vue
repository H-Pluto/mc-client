<script setup lang="ts">
import { computed } from 'vue'
import { useVueFlow, type HandleConnectable } from '@vue-flow/core'

import NodeFrame from '@/components/flow/NodeFrame.vue'
import { BLOCK_CHOICES, EFFECT_CHOICES, ENTITY_CHOICES, ITEM_CHOICES } from '@/lib/flow/catalog'
import { COMMAND_OPTIONS, commandPhrase } from '@/lib/flow/options'
import { createCommandData, type CommandNodeData, type CommandType } from '@/lib/flow/types'

const props = defineProps<{
  id: string
  data: CommandNodeData
  connectable?: HandleConnectable
}>()

const { updateNodeData } = useVueFlow()
const updateData = updateNodeData as unknown as (id: string, data: unknown) => void

const give = computed(() => (props.data.command === 'give' ? props.data : null))
const effect = computed(() => (props.data.command === 'effect' ? props.data : null))
const summon = computed(() => (props.data.command === 'summon' ? props.data : null))
const fill = computed(() => (props.data.command === 'fill' ? props.data : null))
const say = computed(() => (props.data.command === 'say' ? props.data : null))
const tp = computed(() => (props.data.command === 'tp' ? props.data : null))
const phrase = computed(() => commandPhrase(props.data))

function readValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}

function setCommand(event: Event) {
  updateData(props.id, createCommandData(readValue(event) as CommandType))
}

function setField(key: string, event: Event) {
  updateData(props.id, { [key]: readValue(event) })
}
</script>

<template>
  <NodeFrame
    :id="id"
    chip="指令"
    tone="command"
    :phrase="phrase"
    :source="false"
    :connectable="connectable"
  >
    <label class="field">
      <span class="field__label">做什么</span>
      <select class="field__control" :value="data.command" @change="setCommand">
        <option v-for="option in COMMAND_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <template v-if="give">
      <label class="field">
        <span class="field__label">物品</span>
        <select class="field__control" :value="give.item" @change="setField('item', $event)">
          <option v-for="choice in ITEM_CHOICES" :key="choice.value" :value="choice.value">
            {{ choice.label }}
          </option>
        </select>
      </label>
      <label class="field field__num">
        <span class="field__label">数量</span>
        <input
          class="field__control"
          type="number"
          min="1"
          :value="give.count"
          @input="setField('count', $event)"
        />
      </label>
    </template>

    <template v-else-if="effect">
      <label class="field">
        <span class="field__label">状态效果</span>
        <select class="field__control" :value="effect.effect" @change="setField('effect', $event)">
          <option v-for="choice in EFFECT_CHOICES" :key="choice.value" :value="choice.value">
            {{ choice.label }}
          </option>
        </select>
      </label>
      <div class="field__row">
        <label class="field">
          <span class="field__label">持续（秒）</span>
          <input
            class="field__control"
            type="number"
            min="1"
            :value="effect.seconds"
            @input="setField('seconds', $event)"
          />
        </label>
        <label class="field field__num">
          <span class="field__label">等级</span>
          <input
            class="field__control"
            type="number"
            min="1"
            max="256"
            :value="effect.level"
            @input="setField('level', $event)"
          />
        </label>
      </div>
    </template>

    <template v-else-if="summon">
      <label class="field">
        <span class="field__label">生物</span>
        <select class="field__control" :value="summon.entity" @change="setField('entity', $event)">
          <option v-for="choice in ENTITY_CHOICES" :key="choice.value" :value="choice.value">
            {{ choice.label }}
          </option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">生成位置</span>
        <select
          class="field__control"
          :value="summon.positionMode"
          @change="setField('positionMode', $event)"
        >
          <option value="context">跟随上游位置</option>
          <option value="coords">指定坐标</option>
        </select>
      </label>
      <div v-if="summon.positionMode === 'coords'" class="coords">
        <input class="field__control" placeholder="X" :value="summon.x" @input="setField('x', $event)" />
        <input class="field__control" placeholder="Y" :value="summon.y" @input="setField('y', $event)" />
        <input class="field__control" placeholder="Z" :value="summon.z" @input="setField('z', $event)" />
      </div>
    </template>

    <template v-else-if="fill">
      <label class="field">
        <span class="field__label">方块的种类</span>
        <select class="field__control" :value="fill.block" @change="setField('block', $event)">
          <option v-for="choice in BLOCK_CHOICES" :key="choice.value" :value="choice.value">
            {{ choice.label }}
          </option>
        </select>
      </label>
      <div class="field">
        <span class="field__label">起点坐标</span>
        <div class="coords">
          <input class="field__control" placeholder="X" :value="fill.x1" @input="setField('x1', $event)" />
          <input class="field__control" placeholder="Y" :value="fill.y1" @input="setField('y1', $event)" />
          <input class="field__control" placeholder="Z" :value="fill.z1" @input="setField('z1', $event)" />
        </div>
      </div>
      <div class="field">
        <span class="field__label">终点坐标</span>
        <div class="coords">
          <input class="field__control" placeholder="X" :value="fill.x2" @input="setField('x2', $event)" />
          <input class="field__control" placeholder="Y" :value="fill.y2" @input="setField('y2', $event)" />
          <input class="field__control" placeholder="Z" :value="fill.z2" @input="setField('z2', $event)" />
        </div>
      </div>
    </template>

    <label v-else-if="say" class="field">
      <span class="field__label">广播内容</span>
      <input
        class="field__control"
        :value="say.message"
        placeholder="要对全服说的话"
        autocomplete="off"
        @input="setField('message', $event)"
      />
    </label>

    <template v-else-if="tp">
      <label class="field">
        <span class="field__label">传送到</span>
        <select class="field__control" :value="tp.mode" @change="setField('mode', $event)">
          <option value="coords">指定坐标</option>
          <option value="entity">另一位玩家</option>
        </select>
      </label>
      <div v-if="tp.mode === 'coords'" class="coords">
        <input class="field__control" placeholder="X" :value="tp.x" @input="setField('x', $event)" />
        <input class="field__control" placeholder="Y" :value="tp.y" @input="setField('y', $event)" />
        <input class="field__control" placeholder="Z" :value="tp.z" @input="setField('z', $event)" />
      </div>
      <label v-else class="field">
        <span class="field__label">玩家名</span>
        <input
          class="field__control"
          :value="tp.target"
          placeholder="输入玩家名"
          autocomplete="off"
          spellcheck="false"
          @input="setField('target', $event)"
        />
      </label>
    </template>

    <p class="field__hint">执行对象跟随上游的身份上下文；没有身份上下文时默认对最近的玩家执行。</p>
  </NodeFrame>
</template>
