import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  getUpdaterApi,
  type UpdateProgress,
  type UpdateSummary,
  type UpdaterEvent,
} from '@/services/updater'

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error'

const CHECK_DELAY = 1500
const NOTICE_DURATION = 5000
const UNSUPPORTED_ENV = '当前环境不支持检查更新，请通过 Electron 客户端运行。'
const DEV_ENV = '开发模式下不检查更新，请使用打包后的应用。'

export const useUpdaterStore = defineStore('updater', () => {
  const status = ref<UpdaterStatus>('idle')
  const currentVersion = ref('')
  const packaged = ref(false)
  const portable = ref(false)
  const available = ref<UpdateSummary | null>(null)
  const downloaded = ref<UpdateSummary | null>(null)
  const progress = ref<UpdateProgress | null>(null)
  const error = ref('')
  const notice = ref('')
  const dialogOpen = ref(false)

  let started = false
  let manual = false
  let unsubscribe: (() => void) | null = null
  let noticeTimer: number | undefined

  const busy = computed(() => status.value === 'checking' || status.value === 'downloading')
  const hasUpdate = computed(() => status.value === 'available' || status.value === 'downloaded')
  const percent = computed(() => Math.round(progress.value?.percent ?? 0))

  function flash(text: string) {
    notice.value = text
    window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => {
      notice.value = ''
    }, NOTICE_DURATION)
  }

  function applyEvent(event: UpdaterEvent) {
    switch (event.type) {
      case 'checking':
        status.value = 'checking'
        error.value = ''
        progress.value = null
        break

      case 'available':
        status.value = 'available'
        available.value = event.payload
        downloaded.value = null
        progress.value = null
        break

      case 'not-available':
        status.value = 'up-to-date'
        available.value = null
        error.value = ''
        if (!manual) flash(`已是最新版本 v${currentVersion.value}`)
        break

      case 'progress':
        status.value = 'downloading'
        progress.value = event.payload
        break

      case 'downloaded':
        status.value = 'downloaded'
        downloaded.value = event.payload
        progress.value = null
        dialogOpen.value = true
        break

      case 'error':
        status.value = 'error'
        error.value = event.payload?.message ?? '检查更新失败'
        break
    }

    if (event.type !== 'checking' && event.type !== 'progress') manual = false
  }

  async function init() {
    if (started) return
    started = true

    const api = getUpdaterApi()
    if (!api) return

    unsubscribe = api.onEvent(applyEvent)

    const result = await api.info()
    if (!result.ok || !result.data) return

    currentVersion.value = result.data.version
    packaged.value = result.data.packaged
    portable.value = result.data.portable

    if (packaged.value) {
      window.setTimeout(() => {
        void check({ silent: true })
      }, CHECK_DELAY)
    }
  }

  async function check(options: { silent?: boolean } = {}) {
    const api = getUpdaterApi()
    if (!api) {
      status.value = 'error'
      error.value = UNSUPPORTED_ENV
      return
    }
    if (busy.value) return

    manual = !options.silent
    status.value = 'checking'
    error.value = ''
    available.value = null
    downloaded.value = null
    progress.value = null

    if (!packaged.value) {
      status.value = 'error'
      error.value = DEV_ENV
      return
    }

    const result = await api.check()
    if (!result.ok) {
      status.value = 'error'
      error.value = result.message ?? '检查更新失败'
    }
  }

  async function download() {
    const api = getUpdaterApi()
    if (!api || busy.value) return

    if (portable.value) {
      await openReleasePage()
      return
    }

    status.value = 'downloading'
    progress.value = { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 }

    const result = await api.download()
    if (!result.ok) {
      status.value = 'error'
      error.value = result.message ?? '下载更新失败'
    }
  }

  async function install() {
    const api = getUpdaterApi()
    if (!api) return

    const result = await api.install()
    if (!result.ok) {
      status.value = 'error'
      error.value = result.message ?? '安装更新失败'
    }
  }

  async function openReleasePage() {
    await getUpdaterApi()?.openReleasePage()
  }

  function openDialog() {
    dialogOpen.value = true
  }

  function closeDialog() {
    dialogOpen.value = false
  }

  function dispose() {
    unsubscribe?.()
    unsubscribe = null
    window.clearTimeout(noticeTimer)
  }

  return {
    status,
    currentVersion,
    packaged,
    portable,
    available,
    downloaded,
    progress,
    percent,
    error,
    notice,
    dialogOpen,
    busy,
    hasUpdate,
    init,
    check,
    download,
    install,
    openReleasePage,
    openDialog,
    closeDialog,
    dispose,
  }
})
