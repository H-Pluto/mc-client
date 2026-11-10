import { createRouter, createWebHashHistory } from 'vue-router'

import { useConnectionStore } from '@/stores/connection'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'connect',
      component: () => import('@/views/ConnectView.vue'),
      meta: { title: 'Rcon 连接' },
    },
    {
      path: '/console',
      name: 'console',
      component: () => import('@/views/ConsoleView.vue'),
      meta: { title: '控制台' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const connection = useConnectionStore()

  if (to.name === 'console' && !connection.isConnected) {
    return { name: 'connect' }
  }

  if (to.name === 'connect' && connection.isConnected) {
    return { name: 'console' }
  }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · MC RCON` : 'MC RCON'
})

export default router
