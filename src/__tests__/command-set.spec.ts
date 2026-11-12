import { describe, expect, it } from 'vitest'

import { parseCommandFile, parseCommandFileText } from '@/lib/command-set'

function doc(groups: unknown[]) {
  return { version: 1, groups }
}

describe('parseCommandFile', () => {
  it('解析最简指令并补全默认字段', () => {
    const groups = parseCommandFile(
      doc([
        {
          id: 'custom',
          name: '自定义',
          commands: [{ id: 'custom-hello', name: '打招呼', template: 'say 你好' }],
        },
      ]),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      id: 'custom',
      name: '自定义',
      description: '',
      keywords: [],
    })
    expect(groups[0]!.commands[0]).toMatchObject({
      id: 'custom-hello',
      name: '打招呼',
      template: 'say 你好',
      method: 'run',
      args: [],
    })
  })

  it('解析各种参数类型', () => {
    const groups = parseCommandFile(
      doc([
        {
          id: 'custom',
          name: '自定义',
          commands: [
            {
              id: 'custom-give',
              name: '给予',
              template: 'give {player} {item} {count} {silent}',
              method: 'giveApple',
              args: [
                { key: 'player', label: '玩家', required: true, suggestPlayers: true },
                {
                  key: 'item',
                  label: '物品',
                  kind: 'select',
                  options: [{ value: 'apple', label: '苹果' }],
                  width: 'md',
                },
                { key: 'count', label: '数量', kind: 'number', default: 3, min: 1 },
                { key: 'silent', label: '静默', kind: 'toggle', default: true },
              ],
            },
          ],
        },
      ]),
    )

    const args = groups[0]!.commands[0]!.args
    expect(args[0]).toMatchObject({
      kind: 'text',
      default: '',
      required: true,
      suggestPlayers: true,
    })
    expect(args[1]).toMatchObject({ kind: 'select', default: '', width: 'md' })
    expect(args[1]!.options).toEqual([{ value: 'apple', label: '苹果' }])
    expect(args[2]).toMatchObject({ kind: 'number', default: '3', min: 1 })
    expect(args[3]).toMatchObject({ kind: 'toggle', default: 'true' })
  })

  it('缺少必填字段时给出带路径的错误', () => {
    expect(() =>
      parseCommandFile(doc([{ id: 'custom', name: '自定义', commands: [{ name: '无 id' }] }])),
    ).toThrow(/groups\[0\]\.commands\[0\]\.id/)
  })

  it('指令 id 重复时报错', () => {
    expect(() =>
      parseCommandFile(
        doc([
          {
            id: 'custom',
            name: '自定义',
            commands: [
              { id: 'dup', name: 'A', template: 'say a' },
              { id: 'dup', name: 'B', template: 'say b' },
            ],
          },
        ]),
      ),
    ).toThrow(/重复/)
  })

  it('下拉参数缺少选项时报错', () => {
    expect(() =>
      parseCommandFile(
        doc([
          {
            id: 'custom',
            name: '自定义',
            commands: [
              {
                id: 'x',
                name: 'X',
                template: 'say {v}',
                args: [{ key: 'v', label: '值', kind: 'select' }],
              },
            ],
          },
        ]),
      ),
    ).toThrow(/options/)
  })

  it('空组列表报错', () => {
    expect(() => parseCommandFile(doc([]))).toThrow(/至少需要一个组/)
  })

  it('JSON 语法错误时给出提示', () => {
    expect(() => parseCommandFileText('{ groups: ')).toThrow(/JSON 格式错误/)
  })
})
