import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import App from '../App.vue'
import router from '../router'

describe('App', () => {
  it('opens the RCON connection page', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.text()).toContain('Rcon 连接')
    expect(wrapper.text()).toContain('服务地址')
  })
})
