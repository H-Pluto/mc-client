const COLOR_CODE = /§./g

export interface PlayerSummary {
  online: number
  max: number
  names: string[]
}

export interface GameTime {
  day: number
  label: string
}

const DIFFICULTIES: Record<string, string> = {
  peaceful: '和平',
  easy: '简单',
  normal: '普通',
  hard: '困难',
}

const WEATHERS: Record<string, string> = {
  clear: '晴朗',
  rain: '下雨',
  thunder: '雷暴',
}

function stripColors(value: string): string {
  return value.replace(COLOR_CODE, '')
}

export function parsePlayerList(raw: string | null): PlayerSummary | null {
  if (!raw) return null

  const text = stripColors(raw).trim()
  const standard = text.match(/There are (\d+) of a max(?: of)? (\d+) players online\s*:?\s*/i)
  const fallback = text.match(/(\d+)\s*\/\s*(\d+)\s*players online/i)

  const onlineText = standard?.[1] ?? fallback?.[1]
  const maxText = standard?.[2] ?? fallback?.[2]
  if (onlineText === undefined || maxText === undefined) return null

  const remainder = standard ? text.slice(standard[0].length) : ''
  const names = remainder
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

  return {
    online: Number(onlineText),
    max: Number(maxText),
    names,
  }
}

export function parseGameTime(raw: string | null): GameTime | null {
  if (!raw) return null

  const match = stripColors(raw).match(/time is (\d+)/i)
  const ticksText = match?.[1]
  if (ticksText === undefined) return null

  const ticks = Number(ticksText)
  if (!Number.isFinite(ticks)) return null

  const day = Math.floor(ticks / 24000) + 1
  const dayTicks = ticks % 24000
  const totalMinutes = Math.floor((dayTicks / 1000 + 6) * 60)
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  return { day, label: `第 ${day} 天 · ${clock}` }
}

export function parseTps(raw: string | null): number[] | null {
  if (!raw) return null

  const match = stripColors(raw).match(
    /(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/,
  )
  const [, one, five, fifteen] = match ?? []
  if (one === undefined || five === undefined || fifteen === undefined) return null

  return [Number(one), Number(five), Number(fifteen)]
}

export function parseVersion(raw: string | null): string | null {
  if (!raw) return null

  const text = stripColors(raw).trim()
  if (!text || /unknown|incomplete command/i.test(text)) return null

  const software = text.match(/running\s+([A-Za-z][\w-]*)/i)?.[1]
  const gameVersion = text.match(/MC:\s*([0-9][\w.+-]*)/i)?.[1]

  if (software && gameVersion) return `${software} ${gameVersion}`
  if (gameVersion) return gameVersion
  return text.length <= 60 ? text : null
}

export function parseDifficulty(raw: string | null): string | null {
  if (!raw) return null

  const word = stripColors(raw).match(/difficulty is (\w+)/i)?.[1]?.toLowerCase()
  if (!word) return null

  return DIFFICULTIES[word] ?? word
}

export function parseWeather(raw: string | null): string | null {
  if (!raw) return null

  const word = stripColors(raw).match(/weather is (\w+)/i)?.[1]?.toLowerCase()
  if (!word) return null

  return WEATHERS[word] ?? word
}
