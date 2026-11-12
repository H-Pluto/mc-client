import type { McCall } from '@/services/rcon'

export type ArgKind = 'text' | 'number' | 'select' | 'toggle'

export interface ArgOption {
  value: string
  label: string
}

export interface ArgDef {
  key: string
  label: string
  kind: ArgKind
  default: string
  placeholder?: string
  required?: boolean
  options?: ArgOption[]
  width?: 'sm' | 'md' | 'lg'
  min?: number
  max?: number
  suggestPlayers?: boolean
}

export interface CommandDef {
  id: string
  name: string
  template: string
  method: string
  args: ArgDef[]
  keywords?: string[]
}

export interface CommandGroup {
  id: string
  name: string
  description: string
  keywords: string[]
  defaultExpanded?: boolean
  commands: CommandDef[]
}

export type CommandValues = Record<string, string | number>

function pascalCase(id: string): string {
  return id
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function playerArg(placeholder = '@a 或玩家名'): ArgDef {
  return {
    key: 'player',
    label: '目标玩家',
    kind: 'text',
    default: '',
    placeholder,
    required: true,
    width: 'md',
    suggestPlayers: true,
  }
}

function countArg(): ArgDef {
  return {
    key: 'count',
    label: '数量',
    kind: 'number',
    default: '1',
    required: true,
    min: 1,
    width: 'sm',
  }
}

function secondsArg(): ArgDef {
  return {
    key: 'seconds',
    label: '持续时间（秒）',
    kind: 'number',
    default: '30',
    required: true,
    min: 1,
    width: 'sm',
  }
}

function amplifierArg(): ArgDef {
  return {
    key: 'amplifier',
    label: '效果等级',
    kind: 'number',
    default: '0',
    required: true,
    min: 0,
    max: 255,
    width: 'sm',
  }
}

function hideParticlesArg(): ArgDef {
  return {
    key: 'hideParticles',
    label: '隐藏粒子',
    kind: 'toggle',
    default: 'true',
    width: 'sm',
  }
}

function reasonArg(): ArgDef {
  return {
    key: 'reason',
    label: '原因',
    kind: 'text',
    default: '',
    placeholder: '可选',
    width: 'lg',
  }
}

export const ITEMS: Array<[string, string]> = [
  ['apple', '苹果'],
  ['golden_apple', '金苹果'],
  ['enchanted_golden_apple', '附魔金苹果'],
  ['bread', '面包'],
  ['cooked_beef', '熟牛肉'],
  ['cooked_porkchop', '熟猪排'],
  ['golden_carrot', '金萝卜'],
  ['diamond', '钻石'],
  ['diamond_block', '钻石块'],
  ['emerald', '绿宝石'],
  ['emerald_block', '绿宝石块'],
  ['netherite_ingot', '下界合金锭'],
  ['netherite_block', '下界合金块'],
  ['iron_sword', '铁剑'],
  ['diamond_sword', '钻石剑'],
  ['netherite_sword', '下界合金剑'],
  ['diamond_pickaxe', '钻石镐'],
  ['netherite_pickaxe', '下界合金镐'],
  ['bow', '弓'],
  ['arrow', '箭'],
  ['elytra', '鞘翅'],
  ['totem_of_undying', '不死图腾'],
  ['ender_pearl', '末影珍珠'],
  ['experience_bottle', '附魔之瓶'],
  ['obsidian', '黑曜石'],
  ['torch', '火把'],
  ['oak_log', '橡木原木'],
  ['stone', '石头'],
  ['glass', '玻璃'],
]

export const EFFECTS: Array<[string, string, string[]?]> = [
  ['speed', '速度', ['加速']],
  ['slowness', '缓慢', ['减速']],
  ['haste', '急迫', ['挖掘加速']],
  ['mining_fatigue', '挖掘疲劳', ['疲劳']],
  ['strength', '力量', ['攻击力']],
  ['instant_health', '瞬间治疗', ['治疗', '回血']],
  ['instant_damage', '瞬间伤害', ['伤害']],
  ['jump_boost', '跳跃提升', ['跳跃']],
  ['nausea', '反胃', ['恶心']],
  ['regeneration', '生命恢复', ['回血']],
  ['resistance', '抗性提升', ['减伤']],
  ['fire_resistance', '抗火', ['防火']],
  ['water_breathing', '水下呼吸', ['呼吸']],
  ['invisibility', '隐身'],
  ['blindness', '失明'],
  ['night_vision', '夜视'],
  ['hunger', '饥饿'],
  ['weakness', '虚弱'],
  ['poison', '中毒'],
  ['wither', '凋零'],
  ['health_boost', '生命提升', ['生命上限']],
  ['absorption', '伤害吸收', ['护盾']],
  ['saturation', '饱和', ['饱食']],
  ['glowing', '发光', ['高亮']],
  ['levitation', '漂浮', ['悬浮']],
  ['slow_falling', '缓降', ['摔落保护']],
  ['conduit_power', '潮涌能量', ['潮涌']],
  ['dolphins_grace', '海豚的恩惠', ['海豚']],
  ['darkness', '黑暗'],
]

const giveGroup: CommandGroup = {
  id: 'give',
  name: '给予物品',
  description: '向玩家发放物品，目标可填 @a、@p 或玩家名',
  keywords: ['give', 'item', '物品', '发放'],
  defaultExpanded: true,
  commands: ITEMS.map(([item, name]) => ({
    id: `give-${item}`,
    name: `给予${name}`,
    template: `give {player} minecraft:${item} {count}`,
    method: `give${pascalCase(item)}`,
    args: [playerArg(), countArg()],
    keywords: ['give', item, name],
  })),
}

const effectGroup: CommandGroup = {
  id: 'effect',
  name: '状态效果',
  description: '为玩家施加药水效果，或清除全部效果',
  keywords: ['effect', '效果', '药水', 'buff'],
  defaultExpanded: true,
  commands: [
    ...EFFECTS.map(([effect, name, aliases]) => ({
      id: `effect-${effect}`,
      name: `施予${name}`,
      template: `effect give {player} minecraft:${effect} {seconds} {amplifier} {hideParticles}`,
      method: `effect${pascalCase(effect)}`,
      args: [playerArg(), secondsArg(), amplifierArg(), hideParticlesArg()],
      keywords: ['effect', effect, name, ...(aliases ?? [])],
    })),
    {
      id: 'effect-clear',
      name: '清除全部效果',
      template: 'effect clear {player}',
      method: 'effectClear',
      args: [playerArg()],
      keywords: ['effect', 'clear', '清除'],
    },
  ],
}

const playerGroup: CommandGroup = {
  id: 'player',
  name: '玩家管理',
  description: '权限、游戏模式、传送与白名单',
  keywords: ['player', '玩家', '管理', '权限'],
  commands: [
    {
      id: 'player-op',
      name: '给予 OP 权限',
      template: 'op {player}',
      method: 'op',
      args: [playerArg()],
      keywords: ['op', '管理员'],
    },
    {
      id: 'player-deop',
      name: '取消 OP 权限',
      template: 'deop {player}',
      method: 'deop',
      args: [playerArg()],
      keywords: ['deop', '管理员'],
    },
    {
      id: 'player-kick',
      name: '踢出玩家',
      template: 'kick {player} {reason}',
      method: 'kick',
      args: [playerArg(), reasonArg()],
      keywords: ['kick', '踢出'],
    },
    {
      id: 'player-gamemode',
      name: '切换游戏模式',
      template: 'gamemode {mode} {player}',
      method: 'run',
      args: [
        playerArg(),
        {
          key: 'mode',
          label: '模式',
          kind: 'select',
          default: 'creative',
          options: [
            { value: 'survival', label: '生存' },
            { value: 'creative', label: '创造' },
            { value: 'adventure', label: '冒险' },
            { value: 'spectator', label: '旁观' },
          ],
          width: 'md',
        },
      ],
      keywords: ['gamemode', '游戏模式', '创造', '生存'],
    },
    {
      id: 'player-clear',
      name: '清空背包',
      template: 'clear {player}',
      method: 'run',
      args: [playerArg()],
      keywords: ['clear', '背包'],
    },
    {
      id: 'player-kill',
      name: '杀死玩家',
      template: 'kill {player}',
      method: 'run',
      args: [playerArg()],
      keywords: ['kill', '杀死'],
    },
    {
      id: 'player-tp',
      name: '传送玩家',
      template: 'tp {player} {target}',
      method: 'run',
      args: [
        playerArg(),
        {
          key: 'target',
          label: '传送目标',
          kind: 'text',
          default: '',
          placeholder: '@p、玩家名或坐标',
          required: true,
          width: 'md',
          suggestPlayers: true,
        },
      ],
      keywords: ['tp', 'teleport', '传送'],
    },
    {
      id: 'player-xp',
      name: '增加经验',
      template: 'xp add {player} {amount}',
      method: 'run',
      args: [
        playerArg(),
        {
          key: 'amount',
          label: '经验点数',
          kind: 'number',
          default: '30',
          required: true,
          width: 'sm',
        },
      ],
      keywords: ['xp', '经验', '等级'],
    },
    {
      id: 'player-spawnpoint',
      name: '设置重生点',
      template: 'spawnpoint {player}',
      method: 'run',
      args: [playerArg()],
      keywords: ['spawnpoint', '重生点'],
    },
    {
      id: 'player-whitelist-add',
      name: '加入白名单',
      template: 'whitelist add {player}',
      method: 'run',
      args: [playerArg()],
      keywords: ['whitelist', '白名单'],
    },
    {
      id: 'player-whitelist-remove',
      name: '移出白名单',
      template: 'whitelist remove {player}',
      method: 'run',
      args: [playerArg()],
      keywords: ['whitelist', '白名单'],
    },
    {
      id: 'player-ban',
      name: '封禁玩家',
      template: 'ban {player} {reason}',
      method: 'run',
      args: [playerArg(), reasonArg()],
      keywords: ['ban', '封禁'],
    },
    {
      id: 'player-pardon',
      name: '解除封禁',
      template: 'pardon {player}',
      method: 'run',
      args: [playerArg()],
      keywords: ['pardon', 'unban', '解封'],
    },
  ],
}

const worldGroup: CommandGroup = {
  id: 'world',
  name: '世界与时间',
  description: '时间、天气、难度与游戏规则',
  keywords: ['world', '世界', '时间', '天气', 'gamerule'],
  commands: [
    {
      id: 'world-time-day',
      name: '设为白天',
      template: 'time set day',
      method: 'run',
      args: [],
      keywords: ['time', 'day', '白天'],
    },
    {
      id: 'world-time-night',
      name: '设为夜晚',
      template: 'time set night',
      method: 'run',
      args: [],
      keywords: ['time', 'night', '夜晚'],
    },
    {
      id: 'world-time-noon',
      name: '设为正午',
      template: 'time set noon',
      method: 'run',
      args: [],
      keywords: ['time', 'noon', '正午'],
    },
    {
      id: 'world-time-midnight',
      name: '设为午夜',
      template: 'time set midnight',
      method: 'run',
      args: [],
      keywords: ['time', 'midnight', '午夜'],
    },
    {
      id: 'world-weather-clear',
      name: '天气晴朗',
      template: 'weather clear',
      method: 'run',
      args: [],
      keywords: ['weather', 'clear', '晴'],
    },
    {
      id: 'world-weather-rain',
      name: '开始下雨',
      template: 'weather rain',
      method: 'run',
      args: [],
      keywords: ['weather', 'rain', '雨'],
    },
    {
      id: 'world-weather-thunder',
      name: '雷暴天气',
      template: 'weather thunder',
      method: 'run',
      args: [],
      keywords: ['weather', 'thunder', '雷'],
    },
    {
      id: 'world-difficulty',
      name: '设置难度',
      template: 'difficulty {level}',
      method: 'run',
      args: [
        {
          key: 'level',
          label: '难度',
          kind: 'select',
          default: 'normal',
          options: [
            { value: 'peaceful', label: '和平' },
            { value: 'easy', label: '简单' },
            { value: 'normal', label: '普通' },
            { value: 'hard', label: '困难' },
          ],
          width: 'md',
        },
      ],
      keywords: ['difficulty', '难度'],
    },
    {
      id: 'world-keep-inventory',
      name: '死亡保留物品',
      template: 'gamerule keepInventory {value}',
      method: 'run',
      args: [
        {
          key: 'value',
          label: '状态',
          kind: 'select',
          default: 'true',
          options: [
            { value: 'true', label: '开启' },
            { value: 'false', label: '关闭' },
          ],
          width: 'sm',
        },
      ],
      keywords: ['gamerule', 'keepInventory', '死亡', '物品'],
    },
    {
      id: 'world-daylight-cycle',
      name: '昼夜循环',
      template: 'gamerule doDaylightCycle {value}',
      method: 'run',
      args: [
        {
          key: 'value',
          label: '状态',
          kind: 'select',
          default: 'true',
          options: [
            { value: 'true', label: '开启' },
            { value: 'false', label: '关闭' },
          ],
          width: 'sm',
        },
      ],
      keywords: ['gamerule', 'doDaylightCycle', '昼夜'],
    },
    {
      id: 'world-mob-griefing',
      name: '怪物破坏方块',
      template: 'gamerule mobGriefing {value}',
      method: 'run',
      args: [
        {
          key: 'value',
          label: '状态',
          kind: 'select',
          default: 'true',
          options: [
            { value: 'true', label: '开启' },
            { value: 'false', label: '关闭' },
          ],
          width: 'sm',
        },
      ],
      keywords: ['gamerule', 'mobGriefing', '怪物'],
    },
    {
      id: 'world-immediate-respawn',
      name: '立即重生',
      template: 'gamerule doImmediateRespawn {value}',
      method: 'run',
      args: [
        {
          key: 'value',
          label: '状态',
          kind: 'select',
          default: 'true',
          options: [
            { value: 'true', label: '开启' },
            { value: 'false', label: '关闭' },
          ],
          width: 'sm',
        },
      ],
      keywords: ['gamerule', 'doImmediateRespawn', '重生'],
    },
    {
      id: 'world-random-tick',
      name: '随机刻速度',
      template: 'gamerule randomTickSpeed {speed}',
      method: 'run',
      args: [
        {
          key: 'speed',
          label: '速度',
          kind: 'number',
          default: '3',
          required: true,
          min: 0,
          max: 1000,
          width: 'sm',
        },
      ],
      keywords: ['gamerule', 'randomTickSpeed', '随机刻'],
    },
    {
      id: 'world-save-all',
      name: '保存世界',
      template: 'save-all',
      method: 'run',
      args: [],
      keywords: ['save', '保存'],
    },
  ],
}

const serverGroup: CommandGroup = {
  id: 'server',
  name: '服务器',
  description: '广播、在线列表与自定义指令',
  keywords: ['server', '服务器', '广播', '自定义'],
  commands: [
    {
      id: 'server-say',
      name: '全服广播',
      template: 'say {message}',
      method: 'say',
      args: [
        {
          key: 'message',
          label: '消息内容',
          kind: 'text',
          default: '',
          placeholder: '输入要广播的内容',
          required: true,
          width: 'lg',
        },
      ],
      keywords: ['say', 'broadcast', '广播', '公告'],
    },
    {
      id: 'server-list',
      name: '查看在线玩家',
      template: 'list',
      method: 'list',
      args: [],
      keywords: ['list', '在线', '玩家列表'],
    },
    {
      id: 'server-whitelist-list',
      name: '查看白名单',
      template: 'whitelist list',
      method: 'run',
      args: [],
      keywords: ['whitelist', '白名单'],
    },
    {
      id: 'server-custom',
      name: '自定义指令',
      template: '{command}',
      method: 'run',
      args: [
        {
          key: 'command',
          label: '指令',
          kind: 'text',
          default: '',
          placeholder: '例如：time set day',
          required: true,
          width: 'lg',
        },
      ],
      keywords: ['custom', 'run', '自定义'],
    },
  ],
}

export const defaultCommandGroups: CommandGroup[] = [
  giveGroup,
  effectGroup,
  playerGroup,
  worldGroup,
  serverGroup,
]

export function createDefaultValues(command: CommandDef): CommandValues {
  const values: CommandValues = {}
  for (const arg of command.args) values[arg.key] = arg.default
  return values
}

export function buildCommand(command: CommandDef, values: CommandValues): string {
  const text = command.template
    .replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? '').trim())
    .trim()
  return text.startsWith('/') ? text.slice(1) : text
}

function coerceValue(arg: ArgDef, raw: string | number | undefined): unknown {
  if (arg.kind === 'toggle') return raw === 'true'

  const text = String(raw ?? '').trim()
  if (!text) return undefined
  if (arg.kind === 'number') return Number(text)
  return text
}

export function buildCall(command: CommandDef, values: CommandValues): McCall {
  if (command.method === 'run') {
    return { method: 'run', args: [buildCommand(command, values)] }
  }

  return {
    method: command.method,
    args: command.args.map((arg) => coerceValue(arg, values[arg.key])),
  }
}

export function commandIssue(command: CommandDef, values: CommandValues): string | null {
  for (const arg of command.args) {
    if (arg.kind === 'toggle') continue

    const text = String(values[arg.key] ?? '').trim()
    if (!text) {
      if (arg.required) return `请填写${arg.label}`
      continue
    }

    if (arg.kind === 'number') {
      const value = Number(text)
      if (!Number.isSafeInteger(value)) return `${arg.label}需为整数`
      if (arg.min !== undefined && value < arg.min) return `${arg.label}不能小于 ${arg.min}`
      if (arg.max !== undefined && value > arg.max) return `${arg.label}不能大于 ${arg.max}`
    }
  }

  return null
}

export function isCommandReady(command: CommandDef, values: CommandValues): boolean {
  return commandIssue(command, values) === null
}

function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0
  for (const char of haystack) {
    if (char === needle[index]) index += 1
    if (index === needle.length) return true
  }
  return index === needle.length
}

export function matchesQuery(query: string, command: CommandDef, group: CommandGroup): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const haystack = [
    command.name,
    command.template,
    ...(command.keywords ?? []),
    group.name,
    ...group.keywords,
  ]
    .join(' ')
    .toLowerCase()

  return normalized.split(/\s+/).every((token) => isSubsequence(token, haystack))
}
