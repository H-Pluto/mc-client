import { EFFECTS, ITEMS } from '@/lib/commands'

export interface Choice {
  value: string
  label: string
}

export const ITEM_CHOICES: Choice[] = ITEMS.map(([value, label]) => ({ value, label }))

export const EFFECT_CHOICES: Choice[] = EFFECTS.map(([value, label]) => ({ value, label }))

export const BLOCK_CHOICES: Choice[] = [
  { value: 'stone', label: '石头' },
  { value: 'cobblestone', label: '圆石' },
  { value: 'dirt', label: '泥土' },
  { value: 'grass_block', label: '草方块' },
  { value: 'sand', label: '沙子' },
  { value: 'gravel', label: '沙砾' },
  { value: 'oak_planks', label: '橡木木板' },
  { value: 'oak_log', label: '橡木原木' },
  { value: 'glass', label: '玻璃' },
  { value: 'obsidian', label: '黑曜石' },
  { value: 'bedrock', label: '基岩' },
  { value: 'diamond_block', label: '钻石块' },
  { value: 'gold_block', label: '金块' },
  { value: 'iron_block', label: '铁块' },
  { value: 'glowstone', label: '荧石' },
  { value: 'sea_lantern', label: '海晶灯' },
  { value: 'water', label: '水' },
  { value: 'lava', label: '岩浆' },
  { value: 'air', label: '空气' },
  { value: 'torch', label: '火把' },
]

export const ENTITY_CHOICES: Choice[] = [
  { value: 'zombie', label: '僵尸' },
  { value: 'skeleton', label: '骷髅' },
  { value: 'creeper', label: '苦力怕' },
  { value: 'spider', label: '蜘蛛' },
  { value: 'slime', label: '史莱姆' },
  { value: 'witch', label: '女巫' },
  { value: 'blaze', label: '烈焰人' },
  { value: 'enderman', label: '末影人' },
  { value: 'iron_golem', label: '铁傀儡' },
  { value: 'cow', label: '牛' },
  { value: 'pig', label: '猪' },
  { value: 'sheep', label: '羊' },
  { value: 'chicken', label: '鸡' },
  { value: 'horse', label: '马' },
  { value: 'wolf', label: '狼' },
  { value: 'cat', label: '猫' },
  { value: 'villager', label: '村民' },
  { value: 'armor_stand', label: '盔甲架' },
]

function labelOf(choices: Choice[], value: string, fallback: string): string {
  return choices.find((choice) => choice.value === value)?.label ?? (value || fallback)
}

export function itemLabel(value: string): string {
  return labelOf(ITEM_CHOICES, value, '未选择物品')
}

export function effectLabel(value: string): string {
  return labelOf(EFFECT_CHOICES, value, '未选择效果')
}

export function blockLabel(value: string): string {
  return labelOf(BLOCK_CHOICES, value, '未选择方块')
}

export function entityLabel(value: string): string {
  return labelOf(ENTITY_CHOICES, value, '未选择实体')
}
