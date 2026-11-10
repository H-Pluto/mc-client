import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useConnectionStore } from '@/stores/connection'

import '@/assets/styles/main.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  await useConnectionStore(pinia).restore()

  app.use(router)
  app.mount('#app')
}

void bootstrap()
