<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppBar from '@/components/AppBar.vue'
import BaseField from '@/components/BaseField.vue'
import UpdateControl from '@/components/UpdateControl.vue'
import { useConnectionStore } from '@/stores/connection'

type Tone = 'idle' | 'partial' | 'ready'

interface FormErrors {
  host?: string
  port?: string
  password?: string
}

const router = useRouter()
const connection = useConnectionStore()

const form = reactive({
  host: connection.server?.host ?? '',
  port: connection.server ? String(connection.server.port) : '25575',
  password: '',
})

const errors = reactive<FormErrors>({})
const showPassword = ref(false)

const hostValid = computed(() => form.host.trim().length > 0)
const portNumber = computed(() => Number(form.port))
const portValid = computed(
  () => /^\d+$/.test(form.port) && portNumber.value >= 1 && portNumber.value <= 65535,
)
const passwordValid = computed(() => form.password.length > 0)

const filled = computed(
  () => [hostValid.value, portValid.value, passwordValid.value].filter(Boolean).length,
)

const status = computed<{ tone: Tone; label: string }>(() => {
  if (filled.value === 3) return { tone: 'ready', label: '可以连接' }
  if (filled.value === 0) return { tone: 'idle', label: '等待输入' }
  return { tone: 'partial', label: '信息未完成' }
})

const target = computed(() => (hostValid.value ? `${form.host.trim()}:${form.port || '—'}` : '—'))

const barStatus = computed<{ tone: Tone; label: string }>(() =>
  connection.status === 'connecting' ? { tone: 'partial', label: '正在连接' } : status.value,
)

watch(
  () => form.port,
  (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 5)
    if (digits !== value) form.port = digits
  },
)

function validate() {
  errors.host = hostValid.value ? undefined : '请填写服务器地址。'
  errors.port = portValid.value ? undefined : '端口需为 1 到 65535 之间的整数。'
  errors.password = passwordValid.value ? undefined : '请填写 RCON 密码。'
  return !errors.host && !errors.port && !errors.password
}

async function submit() {
  if (connection.status === 'connecting') return
  if (!validate()) return

  const connected = await connection.connect({
    host: form.host.trim(),
    port: portNumber.value,
    password: form.password,
  })

  if (connected) router.push({ name: 'console' })
}
</script>

<template>
  <div class="connect">
    <AppBar :tone="barStatus.tone" :status="barStatus.label">
      <UpdateControl />
    </AppBar>

    <div class="connect__body">
      <section class="form-panel">
        <h1 class="form-panel__title">Rcon 连接</h1>
        <p class="form-panel__lede">填写服务器信息，建立一个 RCON 远程控制台。</p>

        <form class="form" novalidate @submit.prevent="submit">
          <div class="form__pair">
            <BaseField id="host" v-model="form.host" label="服务地址" placeholder="127.0.0.1" autocomplete="off"
              spellcheck="false" :error="errors.host" @update:model-value="errors.host = undefined" />
            <BaseField id="port" v-model="form.port" label="端口" placeholder="25575" inputmode="numeric"
              autocomplete="off" :error="errors.port" @update:model-value="errors.port = undefined" />
          </div>

          <BaseField id="password" v-model="form.password" label="密码" placeholder="输入 RCON 密码"
            :type="showPassword ? 'text' : 'password'" autocomplete="off" :error="errors.password"
            @update:model-value="errors.password = undefined">
            <template #suffix>
              <button class="reveal" type="button" :aria-pressed="showPassword" @click="showPassword = !showPassword">
                {{ showPassword ? '隐藏' : '显示' }}
              </button>
            </template>
          </BaseField>

          <p v-if="connection.connectError" class="form-error" role="alert">
            {{ connection.connectError }}
          </p>

          <button class="submit" type="submit" :disabled="connection.status === 'connecting'">
            {{ connection.status === 'connecting' ? '连接中…' : '连接' }}
          </button>
        </form>

        <p class="form-panel__note">
          需要先在服务器 <code>server.properties</code> 中开启
          <code>enable-rcon=true</code>，默认端口为 <code>25575</code>。
        </p>
      </section>

      <aside class="summary" aria-label="连接概况">
        <p class="summary__title">连接概况</p>

        <dl class="summary__list">
          <div class="summary__row">
            <dt>目标</dt>
            <dd :class="{ 'is-empty': !hostValid }">{{ target }}</dd>
          </div>
          <div class="summary__row">
            <dt>协议</dt>
            <dd>RCON / TCP</dd>
          </div>
          <div class="summary__row">
            <dt>加密</dt>
            <dd>无，凭据明文传输</dd>
          </div>
        </dl>

        <div class="summary__progress">
          <div class="summary__progress-head">
            <span>信息完整度</span>
            <span class="summary__count">{{ filled }} / 3</span>
          </div>
          <div class="summary__blocks" aria-hidden="true">
            <span v-for="step in 3" :key="step" :class="{ 'is-on': step <= filled }"></span>
          </div>
        </div>

        <p class="summary__note">凭据只在建立连接时使用，不会保存在界面或磁盘中。</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.connect {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background-color: var(--bg);
  background-image:
    radial-gradient(860px 520px at 12% -12%, rgba(226, 165, 75, 0.1), transparent 62%),
    radial-gradient(760px 460px at 108% 112%, rgba(111, 207, 151, 0.05), transparent 68%),
    linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
  background-size:
    auto,
    auto,
    36px 36px,
    36px 36px;
}

.connect__body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  width: min(1080px, 100%);
  margin: 0 auto;
}

.form-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(40px, 7vw, 84px) clamp(24px, 5vw, 64px) clamp(32px, 5vw, 56px);
}

.form-panel__title {
  font-family: var(--font-display);
  font-size: clamp(28px, 3.4vw, 36px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.01em;
}

.form-panel__lede {
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 14px;
}

.form {
  display: grid;
  gap: 18px;
  margin-top: 36px;
}

.form__pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 14px;
}

.reveal {
  height: 32px;
  padding: 0 10px;
  background: transparent;
  border: 0;
  border-radius: 2px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.reveal:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.reveal:focus-visible {
  outline-offset: 0;
}

.submit {
  height: 48px;
  margin-top: 6px;
  background: var(--gold);
  border: 0;
  border-radius: 3px;
  box-shadow: inset 0 -3px 0 rgba(27, 20, 8, 0.28);
  color: var(--gold-ink);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.submit:hover {
  background: var(--gold-strong);
}

.submit:disabled {
  opacity: 0.55;
  cursor: progress;
}

.submit:active {
  transform: translateY(1px);
  box-shadow: inset 0 -2px 0 rgba(27, 20, 8, 0.28);
}

.form-error {
  padding: 10px 12px;
  background: rgba(229, 119, 95, 0.08);
  border: 1px solid rgba(229, 119, 95, 0.4);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.6;
}

.form-panel__note {
  margin-top: 28px;
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.8;
}

.form-panel__note code {
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11.5px;
}

.summary {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 26px;
  padding: clamp(32px, 5vw, 56px);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 45%);
  border-left: 1px solid var(--line);
}

.summary__title {
  color: var(--text-dim);
  font-size: 13px;
}

.summary__list {
  display: grid;
}

.summary__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.summary__row:first-child {
  border-top: 1px solid var(--line);
}

.summary__row dt {
  flex: none;
  color: var(--text-muted);
  font-size: 13px;
}

.summary__row dd {
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: right;
  word-break: break-all;
}

.summary__row dd.is-empty {
  color: var(--text-dim);
}

.summary__progress {
  display: grid;
  gap: 10px;
}

.summary__progress-head {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 12px;
}

.summary__count {
  color: var(--text);
  font-family: var(--font-mono);
}

.summary__blocks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.summary__blocks span {
  height: 6px;
  background: var(--line);
}

.summary__blocks span.is-on {
  background: var(--gold);
}

.summary__note {
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.7;
}

@media (prefers-reduced-motion: no-preference) {

  .form-panel,
  .summary {
    animation: rise 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  .summary {
    animation-delay: 0.08s;
  }

  .reveal,
  .submit,
  .summary__blocks span {
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@media (max-width: 820px) {
  .connect__body {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .form-panel {
    padding: 48px 24px 36px;
  }

  .summary {
    gap: 20px;
    padding: 36px 24px 48px;
    border-top: 1px solid var(--line);
    border-left: 0;
  }
}

@media (max-width: 380px) {
  .form__pair {
    grid-template-columns: 1fr;
  }
}
</style>
