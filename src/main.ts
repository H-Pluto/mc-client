import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useConnectionStore } from '@/stores/connection'
import { useUpdaterStore } from '@/stores/updater'
import { logError } from '@/services/logger'

import '@/assets/styles/main.css'

window.addEventListener('error', (event) => {
  logError('渲染进程未捕获异常', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  logError('渲染进程未处理的 Promise 异常', event.reason)
})

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.config.errorHandler = (error, _instance, info) => {
    logError(`Vue 运行错误（${info}）`, error)
  }

  app.use(pinia)
  void useUpdaterStore(pinia).init()
  await useConnectionStore(pinia).restore()

  app.use(router)
  app.mount('#app')
}

void bootstrap()
