<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { UpdateSummary } from '@/services/updater'
import { useUpdaterStore } from '@/stores/updater'

const updater = useUpdaterStore()
const dialogRef = ref<HTMLElement | null>(null)

const label = computed(() => {
  switch (updater.status) {
    case 'checking':
      return '检查中…'
    case 'available':
      return `新版本 v${versionOf(updater.available)}`
    case 'downloading':
      return `下载中 ${updater.percent}%`
    case 'downloaded':
      return '重启安装'
    default:
      return '检查更新'
  }
})

const accent = computed(() => updater.hasUpdate || updater.status === 'downloading')

const buttonTitle = computed(() => {
  if (updater.status === 'error') return updater.error || '检查更新失败'
  return '检查更新'
})

const noticeTitle = computed(() => (updater.status === 'error' ? updater.error : ''))

const dialogTitle = computed(() => {
  switch (updater.status) {
    case 'available':
      return `发现新版本 v${versionOf(updater.available)}`
    case 'downloading':
      return `正在下载 v${versionOf(updater.available)}`
    case 'downloaded':
      return `新版本 v${versionOf(updater.downloaded)} 已就绪`
    case 'up-to-date':
      return '已是最新版本'
    case 'error':
      return '检查更新失败'
    default:
      return '检查更新'
  }
})

const notes = computed(
  () => updater.available?.releaseNotes || updater.downloaded?.releaseNotes || '',
)

const transferText = computed(() => {
  const progress = updater.progress
  if (!progress) return ''
  return `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)} · ${formatSpeed(progress.bytesPerSecond)}`
})

function versionOf(summary: UpdateSummary | null) {
  return summary?.version ?? '—'
}

function formatBytes(bytes: number) {
  if (!bytes) return '—'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatSpeed(bytesPerSecond: number) {
  if (!bytesPerSecond) return '—'
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
}

function activate() {
  updater.openDialog()
  if (updater.status === 'idle' || updater.status === 'up-to-date') {
    void updater.check()
  } else if (updater.status === 'error' && !updater.available) {
    void updater.check()
  }
}

function startDownload() {
  void updater.download()
}

function install() {
  void updater.install()
}

function openReleasePage() {
  void updater.openReleasePage()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') updater.closeDialog()
}

watch(
  () => updater.dialogOpen,
  async (open) => {
    if (open) {
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      dialogRef.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="updater">
    <span
      v-if="updater.notice"
      class="updater__notice"
      :class="{ 'is-error': updater.status === 'error' }"
      :title="noticeTitle"
      aria-live="polite"
    >
      {{ updater.notice }}
    </span>

    <button
      class="updater__button"
      :class="{ 'is-accent': accent }"
      type="button"
      :title="buttonTitle"
      @click="activate"
    >
      {{ label }}
    </button>

    <Teleport to="body">
      <div
        v-if="updater.dialogOpen"
        class="update-dialog"
        role="presentation"
        @click.self="updater.closeDialog()"
      >
        <section
          ref="dialogRef"
          class="update-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-dialog-title"
          tabindex="-1"
        >
          <header class="update-dialog__head">
            <h2 id="update-dialog-title" class="update-dialog__title">{{ dialogTitle }}</h2>
            <button
              class="update-dialog__close"
              type="button"
              aria-label="关闭"
              @click="updater.closeDialog()"
            >
              ×
            </button>
          </header>

          <dl class="update-dialog__meta">
            <div>
              <dt>当前版本</dt>
              <dd>v{{ updater.currentVersion || '—' }}</dd>
            </div>
            <div v-if="updater.available || updater.downloaded">
              <dt>最新版本</dt>
              <dd>v{{ versionOf(updater.available ?? updater.downloaded) }}</dd>
            </div>
          </dl>

          <p v-if="updater.status === 'checking'" class="update-dialog__text">
            正在从 GitHub Releases 检查新版本…
          </p>

          <p v-else-if="updater.status === 'up-to-date'" class="update-dialog__text">
            当前版本 v{{ updater.currentVersion }} 已是最新。
          </p>

          <template v-else-if="updater.status === 'available'">
            <pre v-if="notes" class="update-dialog__notes">{{ notes }}</pre>
            <p v-if="updater.portable" class="update-dialog__text">
              便携版不支持应用内安装，请点击“打开下载页”获取新版本。
            </p>
          </template>

          <template v-else-if="updater.status === 'downloading'">
            <div class="update-dialog__progress" role="progressbar" :aria-valuenow="updater.percent"
              aria-valuemin="0" aria-valuemax="100">
              <span :style="{ width: `${updater.percent}%` }"></span>
            </div>
            <p class="update-dialog__text">
              {{ updater.percent }}% · {{ transferText }}
            </p>
          </template>

          <template v-else-if="updater.status === 'downloaded'">
            <p class="update-dialog__text">更新已下载完成，重启应用后将自动安装。</p>
          </template>

          <p v-else-if="updater.status === 'error'" class="update-dialog__text update-dialog__text--error">
            {{ updater.error }}
          </p>

          <footer class="update-dialog__actions">
            <template v-if="updater.status === 'available'">
              <button class="update-dialog__button" type="button" @click="updater.closeDialog()">
                稍后
              </button>
              <button v-if="updater.portable" class="update-dialog__button is-primary" type="button"
                @click="openReleasePage">
                打开下载页
              </button>
              <button v-else class="update-dialog__button is-primary" type="button" @click="startDownload">
                下载并安装
              </button>
            </template>

            <template v-else-if="updater.status === 'downloading'">
              <button class="update-dialog__button" type="button" @click="updater.closeDialog()">
                后台下载
              </button>
            </template>

            <template v-else-if="updater.status === 'downloaded'">
              <button class="update-dialog__button" type="button" @click="updater.closeDialog()">
                稍后
              </button>
              <button class="update-dialog__button is-primary" type="button" @click="install">
                重启并安装
              </button>
            </template>

            <template v-else-if="updater.status === 'error'">
              <button class="update-dialog__button" type="button" @click="updater.closeDialog()">
                关闭
              </button>
              <button v-if="updater.available" class="update-dialog__button is-primary" type="button"
                @click="startDownload">
                重试下载
              </button>
              <button v-else class="update-dialog__button is-primary" type="button" @click="updater.check()">
                重试
              </button>
            </template>

            <template v-else>
              <button class="update-dialog__button" type="button" @click="updater.closeDialog()">
                关闭
              </button>
            </template>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.updater {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.updater__notice {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.updater__notice.is-error {
  color: var(--danger);
}

.updater__button {
  flex: none;
  height: 32px;
  padding: 0 12px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.updater__button:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.updater__button.is-accent {
  border-color: rgba(226, 165, 75, 0.5);
  color: var(--gold);
}

.updater__button.is-accent:hover {
  border-color: var(--gold);
  color: var(--gold-strong);
}

.update-dialog {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(6, 9, 13, 0.66);
}

.update-dialog__panel {
  width: min(520px, 100%);
  max-height: min(80vh, 640px);
  overflow: auto;
  padding: 22px 24px 20px;
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.update-dialog__panel:focus {
  outline: none;
}

.update-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.update-dialog__title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}

.update-dialog__close {
  flex: none;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  color: var(--text-dim);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.update-dialog__close:hover {
  border-color: var(--line);
  color: var(--text);
}

.update-dialog__meta {
  display: flex;
  gap: 28px;
  margin-top: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.update-dialog__meta dt {
  color: var(--text-dim);
  font-size: 11px;
}

.update-dialog__meta dd {
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
}

.update-dialog__text {
  margin-top: 14px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.update-dialog__text--error {
  color: var(--danger);
}

.update-dialog__notes {
  margin: 14px 0 0;
  max-height: 200px;
  overflow: auto;
  padding: 12px 14px;
  background: var(--panel-input);
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.update-dialog__progress {
  height: 6px;
  margin-top: 18px;
  background: var(--line);
  overflow: hidden;
}

.update-dialog__progress span {
  display: block;
  height: 100%;
  background: var(--gold);
}

.update-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.update-dialog__button {
  height: 36px;
  padding: 0 16px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.update-dialog__button:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.update-dialog__button.is-primary {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--gold-ink);
  font-weight: 600;
}

.update-dialog__button.is-primary:hover {
  background: var(--gold-strong);
  border-color: var(--gold-strong);
}

@media (prefers-reduced-motion: no-preference) {
  .updater__button,
  .update-dialog__button,
  .update-dialog__progress span {
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      width 0.2s linear;
  }
}
</style>
