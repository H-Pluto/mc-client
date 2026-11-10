import { test, expect } from '@playwright/test'

test('connects from the RCON page and shows server data', async ({ page }) => {
  await page.addInitScript(() => {
    const snapshot = {
      list: 'There are 2 of a max of 20 players online: Steve, Alex',
      version:
        'This server is running Paper version git-Paper-196 (MC: 1.21.4) (Implementing API version 1.21.4-R0.1-SNAPSHOT)',
      tps: 'TPS from last 1m, 5m, 15m: 20.0, 19.9, 19.5',
      difficulty: 'The difficulty is Normal',
      time: 'The time is 13000',
      weather: 'The weather is clear',
      latency: 9,
    }

    const target = window as unknown as Record<string, unknown>
    target.rcon = {
      connect: async () => ({ ok: true, data: null }),
      disconnect: async () => ({ ok: true, data: null }),
      status: async () => ({ ok: true, data: { connected: false, host: null, port: null } }),
      snapshot: async () => ({ ok: true, data: snapshot }),
      execute: async (command: string) => ({ ok: true, data: `Executed: ${command}` }),
    }
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Rcon 连接' })).toBeVisible()

  await page.getByLabel('服务地址').fill('127.0.0.1')
  await page.getByLabel('端口').fill('25575')
  await page.getByLabel('密码').fill('secret')

  await page.getByRole('button', { name: '连接', exact: true }).click()

  await expect(page).toHaveURL(/#\/console$/)
  await expect(page.getByRole('heading', { name: '服务器概览' })).toBeVisible()
  await expect(page.getByText('Steve')).toBeVisible()
  await expect(page.getByText('Paper 1.21.4')).toBeVisible()
})
