import type { ArgDef, ArgKind, ArgOption, CommandDef, CommandGroup } from './commands'

const ARG_KINDS: ArgKind[] = ['text', 'number', 'select', 'toggle']
const ARG_WIDTHS = ['sm', 'md', 'lg'] as const

function fail(path: string, message: string): never {
  throw new Error(`${path}：${message}`)
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, '需要是一个对象')
  }
  return value as Record<string, unknown>
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, '需要是一个数组')
  return value
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(path, '需要是非空字符串')
  return value.trim()
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') fail(path, '需要是字符串')
  return value
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') fail(path, '需要是 true 或 false')
  return value
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, '需要是数字')
  return value
}

function stringList(value: unknown, path: string): string[] {
  if (value === undefined || value === null) return []
  return asArray(value, path).map((entry, index) => asString(entry, `${path}[${index}]`))
}

function defaultValue(value: unknown, kind: ArgKind, path: string): string {
  if (value === undefined || value === null) return kind === 'toggle' ? 'false' : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  fail(path, '需要是字符串、数字或布尔值')
}

function parseArg(raw: unknown, path: string): ArgDef {
  const input = asObject(raw, path)
  const key = asString(input.key, `${path}.key`)
  const label = asString(input.label, `${path}.label`)

  const kind = (input.kind ?? 'text') as ArgKind
  if (!ARG_KINDS.includes(kind)) {
    fail(`${path}.kind`, `可选值：${ARG_KINDS.join(' / ')}`)
  }

  const width = input.width as ArgDef['width']
  if (width !== undefined && !ARG_WIDTHS.includes(width as (typeof ARG_WIDTHS)[number])) {
    fail(`${path}.width`, `可选值：${ARG_WIDTHS.join(' / ')}`)
  }

  const arg: ArgDef = {
    key,
    label,
    kind,
    default: defaultValue(input.default, kind, `${path}.default`),
  }

  const placeholder = optionalString(input.placeholder, `${path}.placeholder`)
  if (placeholder !== undefined) arg.placeholder = placeholder

  const required = optionalBoolean(input.required, `${path}.required`)
  if (required !== undefined) arg.required = required

  const min = optionalNumber(input.min, `${path}.min`)
  if (min !== undefined) arg.min = min

  const max = optionalNumber(input.max, `${path}.max`)
  if (max !== undefined) arg.max = max

  if (width !== undefined) arg.width = width

  const suggestPlayers = optionalBoolean(input.suggestPlayers, `${path}.suggestPlayers`)
  if (suggestPlayers !== undefined) arg.suggestPlayers = suggestPlayers

  if (input.options !== undefined) {
    const options = asArray(input.options, `${path}.options`).map((entry, index) => {
      const option = asObject(entry, `${path}.options[${index}]`)
      return {
        value: asString(option.value, `${path}.options[${index}].value`),
        label: asString(option.label, `${path}.options[${index}].label`),
      } satisfies ArgOption
    })
    if (!options.length) fail(`${path}.options`, '至少需要一个选项')
    arg.options = options
  }

  if (kind === 'select' && !arg.options) {
    fail(`${path}.options`, '下拉参数必须提供选项')
  }

  return arg
}

function parseCommand(raw: unknown, path: string, seenIds: Set<string>): CommandDef {
  const input = asObject(raw, path)
  const id = asString(input.id, `${path}.id`)
  if (seenIds.has(id)) fail(`${path}.id`, `与前面的指令重复：${id}`)
  seenIds.add(id)

  const name = asString(input.name, `${path}.name`)
  const template = asString(input.template, `${path}.template`)
  const method = optionalString(input.method, `${path}.method`)?.trim() || 'run'

  const args =
    input.args === undefined
      ? []
      : asArray(input.args, `${path}.args`).map((entry, index) =>
          parseArg(entry, `${path}.args[${index}]`),
        )

  const argKeys = new Set<string>()
  for (const arg of args) {
    if (argKeys.has(arg.key)) fail(`${path}.args`, `参数 key 重复：${arg.key}`)
    argKeys.add(arg.key)
  }

  const command: CommandDef = { id, name, template, method, args }

  const keywords = stringList(input.keywords, `${path}.keywords`)
  if (keywords.length) command.keywords = keywords

  return command
}

function parseGroup(
  raw: unknown,
  path: string,
  seenGroupIds: Set<string>,
  seenCommandIds: Set<string>,
): CommandGroup {
  const input = asObject(raw, path)
  const id = asString(input.id, `${path}.id`)
  if (seenGroupIds.has(id)) fail(`${path}.id`, `与前面的组重复：${id}`)
  seenGroupIds.add(id)

  const name = asString(input.name, `${path}.name`)
  const description = optionalString(input.description, `${path}.description`) ?? ''
  const keywords = stringList(input.keywords, `${path}.keywords`)
  const commands = asArray(input.commands, `${path}.commands`).map((entry, index) =>
    parseCommand(entry, `${path}.commands[${index}]`, seenCommandIds),
  )

  const group: CommandGroup = { id, name, description, keywords, commands }

  const defaultExpanded = optionalBoolean(input.defaultExpanded, `${path}.defaultExpanded`)
  if (defaultExpanded !== undefined) group.defaultExpanded = defaultExpanded

  return group
}

export function parseCommandFile(raw: unknown): CommandGroup[] {
  const input = asObject(raw, '根节点')
  const version = optionalNumber(input.version, 'version')
  if (version !== undefined && version !== 1) {
    fail('version', '当前仅支持版本 1')
  }

  const groups = asArray(input.groups, 'groups')
  if (!groups.length) fail('groups', '至少需要一个组')

  const seenGroupIds = new Set<string>()
  const seenCommandIds = new Set<string>()
  return groups.map((entry, index) =>
    parseGroup(entry, `groups[${index}]`, seenGroupIds, seenCommandIds),
  )
}

export function parseCommandFileText(text: string): CommandGroup[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`JSON 格式错误：${detail}`)
  }
  return parseCommandFile(raw)
}
