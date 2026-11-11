<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppBar from '@/components/AppBar.vue'
import UpdateControl from '@/components/UpdateControl.vue'
import { useConnectionStore } from '@/stores/connection'

const REFRESH_INTERVAL = 10_000

const router = useRouter()
const connection = useConnectionStore()

const command = ref('')
const commandError = ref('')
const executing = ref(false)
let refreshTimer: number | undefined

const playersValue = computed(() =>
  connection.players ? `${connection.players.online} / ${connection.players.max}` : '—',
)

const playersMeta = computed(() =>
  connection.players ? `${connection.players.online} 名在线` : '—',
)

const playerNames = computed(() => connection.players?.names ?? [])

const latencyValue = computed(() =>
  connection.latency === null ? '—' : `${connection.latency} ms`,
)

const tpsValue = computed(() => {
  const tps = connection.tps
  if (!tps) return '不支持'
  return tps.map((value) => value.toFixed(1)).join(' / ')
})

const updatedText = computed(() => {
  if (!connection.lastUpdated) return '等待首次刷新'
  const time = connection.lastUpdated.toLocaleTimeString('zh-CN', { hour12: false })
  return `上次更新 ${time}`
})

const emptyText = computed(() => {
  if (!connection.snapshot) return '正在读取服务器数据…'

  const players = connection.players
  if (!players) return '无法解析玩家列表。'
  if (players.online > 0) return `服务器报告 ${players.online} 名玩家在线，但未返回玩家名。`
  return '当前没有玩家在线。'
})

onMounted(() => {
  if (!connection.snapshot) void connection.refresh()

  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void connection.refresh()
  }, REFRESH_INTERVAL)
})

onBeforeUnmount(() => {
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
})

async function submitCommand() {
  const text = command.value.trim()
  if (!text || executing.value) return

  executing.value = true
  commandError.value = ''

  const result = await connection.execute(text)

  executing.value = false
  if (result.ok) {
    command.value = ''
  } else {
    commandError.value = result.message ?? '指令执行失败'
  }
}

async function disconnect() {
  await connection.disconnect()
  await router.push({ name: 'connect' })
}

async function goCommandList() {
  await router.push({ name: 'commandList' })
}

async function goFlow() {
  await router.push({ name: 'flow' })
}
</script>

<template>
  <div class="console">
    <AppBar tone="ready" :status="`已连接 · ${connection.address}`">
      <button class="bar-button" type="button" :disabled="connection.refreshing" @click="connection.refresh()">
        {{ connection.refreshing ? '刷新中' : '刷新' }}
      </button>
      <button class="bar-button" type="button" @click="goCommandList">指令集</button>
      <button class="bar-button" type="button" @click="goFlow">流程图</button>
      <button class="bar-button" type="button" @click="disconnect">断开连接</button>
      <UpdateControl />
    </AppBar>

    <main class="console__main">
      <header class="console__head">
        <h1 class="console__title">服务器概览</h1>
        <p class="console__sub">每 10 秒自动刷新 · {{ updatedText }}</p>
      </header>

      <p v-if="connection.syncError" class="banner" role="alert">
        <span>{{ connection.syncError }}</span>
        <button class="banner__retry" type="button" @click="connection.refresh()">重试</button>
      </p>

      <section class="readout" aria-label="服务器指标">
        <div class="readout__item">
          <span class="readout__label">在线玩家</span>
          <span class="readout__value">{{ playersValue }}</span>
        </div>
        <div class="readout__item">
          <span class="readout__label">连接延迟</span>
          <span class="readout__value">{{ latencyValue }}</span>
        </div>
        <div class="readout__item">
          <span class="readout__label">服务器版本</span>
          <span class="readout__value readout__value--small">{{ connection.version ?? '—' }}</span>
        </div>
        <div class="readout__item">
          <span class="readout__label">游戏内时间</span>
          <span class="readout__value readout__value--small">
            {{ connection.gameTime?.label ?? '—' }}
          </span>
        </div>
      </section>

      <div class="console__grid">
        <section class="panel">
          <header class="panel__head">
            <h2 class="panel__title">在线玩家</h2>
            <span class="panel__meta">{{ playersMeta }}</span>
          </header>

          <ul v-if="playerNames.length" class="players">
            <li v-for="name in playerNames" :key="name" class="players__row">
              <span class="players__avatar" aria-hidden="true">
                {{ name.slice(0, 1).toUpperCase() }}
              </span>
              <span class="players__name">{{ name }}</span>
              <span class="players__state">在线</span>
            </li>
          </ul>
          <p v-else class="panel__empty">{{ emptyText }}</p>
        </section>

        <section class="panel">
          <header class="panel__head">
            <h2 class="panel__title">服务器状态</h2>
            <span class="panel__meta">{{ updatedText }}</span>
          </header>

          <dl class="facts">
            <div class="facts__row">
              <dt>地址</dt>
              <dd>{{ connection.address }}</dd>
            </div>
            <div class="facts__row">
              <dt>难度</dt>
              <dd>{{ connection.difficulty ?? '—' }}</dd>
            </div>
            <div class="facts__row">
              <dt>天气</dt>
              <dd>{{ connection.weather ?? '—' }}</dd>
            </div>
            <div class="facts__row">
              <dt>TPS（1m / 5m / 15m）</dt>
              <dd>{{ tpsValue }}</dd>
            </div>
            <div class="facts__row">
              <dt>加密</dt>
              <dd>无，明文传输</dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="panel">
        <header class="panel__head">
          <h2 class="panel__title">执行指令</h2>
          <span class="panel__meta">通过 RCON 发送</span>
        </header>

        <form class="command" @submit.prevent="submitCommand">
          <span class="command__prompt" aria-hidden="true">/</span>
          <input v-model="command" class="command__input" type="text" placeholder="say 服务器将在 5 分钟后重启" autocomplete="off"
            spellcheck="false" aria-label="服务器指令" />
          <button class="command__submit" type="submit" :disabled="!command.trim() || executing">
            {{ executing ? '执行中' : '执行' }}
          </button>
        </form>

        <p v-if="commandError" class="command__error" role="alert">{{ commandError }}</p>

        <ul v-if="connection.commandLog.length" class="log">
          <li v-for="entry in connection.commandLog" :key="entry.id" class="log__row">
            <div class="log__line">
              <span class="log__time">{{ entry.at }}</span>
              <code class="log__command">/{{ entry.command }}</code>
            </div>
            <pre class="log__response">{{ entry.response }}</pre>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.console {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background-color: var(--bg);
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 36px 36px;
}

.console__main {
  display: grid;
  flex: 1;
  gap: 24px;
  align-content: start;
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: clamp(24px, 3vw, 40px) clamp(20px, 4vw, 40px) 48px;
}

.console__title {
  font-family: var(--font-display);
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 600;
  line-height: 1.2;
}

.console__sub {
  margin-top: 6px;
  color: var(--text-dim);
  font-size: 12px;
}

.bar-button {
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

.bar-button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--text);
}

.bar-button:disabled {
  opacity: 0.55;
  cursor: progress;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(229, 119, 95, 0.08);
  border: 1px solid rgba(229, 119, 95, 0.4);
  color: var(--danger);
  font-size: 13px;
}

.banner__retry {
  flex: none;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 2px;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.readout {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.readout__item {
  display: grid;
  gap: 6px;
  padding: 18px 22px;
}

.readout__item+.readout__item {
  border-left: 1px solid var(--line);
}

.readout__label {
  color: var(--text-dim);
  font-size: 12px;
}

.readout__value {
  overflow: hidden;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 22px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.readout__value--small {
  font-family: var(--font-sans);
  font-size: 14px;
}

.console__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 24px;
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: rgba(22, 27, 34, 0.62);
  border: 1px solid var(--line);
}

.panel__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}

.panel__title {
  font-size: 14px;
  font-weight: 600;
}

.panel__meta {
  overflow: hidden;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel__empty {
  padding: 32px 20px;
  color: var(--text-dim);
  font-size: 13px;
}

.players {
  margin: 0;
  padding: 0;
  list-style: none;
}

.players__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 20px;
  border-bottom: 1px solid var(--line);
}

.players__row:last-child {
  border-bottom: 0;
}

.players__avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  background: rgba(226, 165, 75, 0.14);
  border: 1px solid rgba(226, 165, 75, 0.35);
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 13px;
}

.players__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.players__state {
  flex: none;
  color: var(--gold);
  font-size: 12px;
}

.facts {
  margin: 0;
  padding: 6px 20px;
}

.facts__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-bottom: 1px dashed var(--line);
}

.facts__row:last-child {
  border-bottom: 0;
}

.facts__row dt {
  flex: none;
  color: var(--text-muted);
  font-size: 13px;
}

.facts__row dd {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: right;
}

.command {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 20px 0;
}

.command__prompt {
  color: var(--gold);
  font-family: var(--font-mono);
}

.command__input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  background: var(--panel-input);
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
}

.command__input::placeholder {
  color: var(--text-dim);
  font-family: var(--font-sans);
}

.command__input:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(226, 165, 75, 0.14);
}

.command__submit {
  flex: none;
  height: 42px;
  padding: 0 18px;
  background: var(--gold);
  border: 0;
  border-radius: 2px;
  color: var(--gold-ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.command__submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.command__error {
  margin: 10px 20px 0;
  color: var(--danger);
  font-size: 12px;
}

.log {
  display: grid;
  gap: 12px;
  margin: 16px 0 0;
  padding: 0 20px 18px;
  list-style: none;
}

.log__row {
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.log__line {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.log__time {
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
}

.log__command {
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 12px;
}

.log__response {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: no-preference) {

  .bar-button,
  .command__input,
  .command__submit {
    transition:
      border-color 0.15s ease,
      color 0.15s ease,
      background-color 0.15s ease;
  }
}

@media (max-width: 960px) {
  .console__grid {
    grid-template-columns: 1fr;
  }

  .readout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .readout__item:nth-child(3) {
    border-left: 0;
  }

  .readout__item:nth-child(n + 3) {
    border-top: 1px solid var(--line);
  }
}

@media (max-width: 560px) {
  .readout {
    grid-template-columns: 1fr;
  }

  .readout__item+.readout__item {
    border-top: 1px solid var(--line);
    border-left: 0;
  }
}
</style>
