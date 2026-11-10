import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import ConnectView from '../views/ConnectView.vue'
import { useConnectionStore } from '../stores/connection'
import type { RconApi, SnapshotRaw } from '../services/rcon'

const push = vi.fn<(to: { name: string }) => void>()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const snapshot: SnapshotRaw = {
  list: 'There are 1 of a max of 20 players online: Steve',
  version: null,
  tps: null,
  difficulty: null,
  time: null,
  weather: null,
  latency: 12,
}

function createApi(overrides: Partial<RconApi> = {}): RconApi {
  return {
    connect: async () => ({ ok: true, data: null }),
    disconnect: async () => ({ ok: true, data: null }),
    status: async () => ({ ok: true, data: { connected: false, host: null, port: null } }),
    snapshot: async () => ({ ok: true, data: snapshot }),
    execute: async () => ({ ok: true, data: '' }),
    ...overrides,
  }
}

async function fillForm(wrapper: VueWrapper) {
  const inputs = wrapper.findAll('input')
  await inputs[0]!.setValue('mc.example.com')
  await inputs[1]!.setValue('25575')
  await inputs[2]!.setValue('secret')
}

describe('ConnectView', () => {
  beforeEach(() => {
    push.mockReset()
    setActivePinia(createPinia())
    window.rcon = createApi()
  })

  afterEach(() => {
    delete window.rcon
  })

  it('shows validation errors when the form is empty', async () => {
    const wrapper = mount(ConnectView)

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('请填写服务器地址。')
    expect(wrapper.text()).toContain('请填写 RCON 密码。')
    expect(push).not.toHaveBeenCalled()
  })

  it('connects and opens the console', async () => {
    const wrapper = mount(ConnectView)
    await fillForm(wrapper)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const store = useConnectionStore()
    expect(store.isConnected).toBe(true)
    expect(store.address).toBe('mc.example.com:25575')
    expect(push).toHaveBeenCalledWith({ name: 'console' })
  })

  it('shows the connection error and stays on the page', async () => {
    window.rcon = createApi({
      connect: async () => ({ ok: false, message: 'RCON 密码错误' }),
    })

    const wrapper = mount(ConnectView)
    await fillForm(wrapper)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('RCON 密码错误')
    expect(useConnectionStore().isConnected).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })
})
