import { describe, it, expect } from 'vitest'

import {
  parseDifficulty,
  parseGameTime,
  parsePlayerList,
  parseTps,
  parseVersion,
  parseWeather,
} from '../lib/rcon-format'

describe('parsePlayerList', () => {
  it('reads the player count and names', () => {
    expect(
      parsePlayerList('There are 2 of a max of 20 players online: Steve, Alex'),
    ).toEqual({
      online: 2,
      max: 20,
      names: ['Steve', 'Alex'],
    })
  })

  it('handles an empty server', () => {
    expect(parsePlayerList('There are 0 of a max of 20 players online:')).toEqual({
      online: 0,
      max: 20,
      names: [],
    })
  })

  it('strips color codes and rejects unrelated output', () => {
    expect(
      parsePlayerList('§6There are 1 of a max of 10 players online: §fSteve'),
    ).toEqual({
      online: 1,
      max: 10,
      names: ['Steve'],
    })
    expect(parsePlayerList('Unknown command')).toBeNull()
    expect(parsePlayerList(null)).toBeNull()
  })
})

describe('parseGameTime', () => {
  it('converts ticks to a day and clock time', () => {
    expect(parseGameTime('The time is 6000')).toEqual({ day: 1, label: '第 1 天 · 12:00' })
    expect(parseGameTime('The time is 25000')).toEqual({ day: 2, label: '第 2 天 · 07:00' })
  })

  it('rejects output without a time', () => {
    expect(parseGameTime('The time is unknown')).toBeNull()
    expect(parseGameTime(null)).toBeNull()
  })
})

describe('parseTps', () => {
  it('reads three TPS values', () => {
    expect(parseTps('TPS from last 1m, 5m, 15m: 20.0, 19.9, 19.5')).toEqual([
      20, 19.9, 19.5,
    ])
  })

  it('returns null when TPS is not supported', () => {
    expect(parseTps('Unknown command. Try /help')).toBeNull()
    expect(parseTps(null)).toBeNull()
  })
})

describe('parseVersion', () => {
  it('compacts Paper version output', () => {
    expect(
      parseVersion(
        'This server is running Paper version git-Paper-196 (MC: 1.21.4) (Implementing API version 1.21.4-R0.1-SNAPSHOT)',
      ),
    ).toBe('Paper 1.21.4')
  })

  it('rejects unknown-command output', () => {
    expect(parseVersion('Unknown command. Try /help')).toBeNull()
  })
})

describe('parseDifficulty and parseWeather', () => {
  it('translates difficulty values', () => {
    expect(parseDifficulty('The difficulty is Normal')).toBe('普通')
    expect(parseDifficulty('The difficulty is hard')).toBe('困难')
    expect(parseDifficulty('Unknown command')).toBeNull()
  })

  it('translates weather values', () => {
    expect(parseWeather('The weather is clear')).toBe('晴朗')
    expect(parseWeather('The weather is thunder')).toBe('雷暴')
    expect(parseWeather('Unknown command')).toBeNull()
  })
})
