<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppBar from '@/components/AppBar.vue'
import UpdateControl from '@/components/UpdateControl.vue'
import {
    buildCall,
    buildCommand,
    commandIssue,
    createDefaultValues,
    isCommandReady,
    matchesQuery,
    type CommandDef,
    type CommandGroup,
    type CommandValues,
} from '@/lib/commands'
import { useCommandsStore } from '@/stores/commands'
import { useConnectionStore } from '@/stores/connection'

const router = useRouter()
const connection = useConnectionStore()
const commands = useCommandsStore()

const query = ref('')
const expanded = reactive<Record<string, boolean>>({})
const values = reactive<Record<string, CommandValues>>({})
const selected = ref(new Set<string>())
const runningIds = reactive(new Set<string>())
const feedback = reactive<Record<string, { tone: 'ok' | 'error'; text: string }>>({})
const batchRunning = ref(false)
const batchDone = ref(0)
const batchTotal = ref(0)
const batchMessage = ref<{ tone: 'ok' | 'error'; text: string } | null>(null)

const allCommands = computed(() => commands.groups.flatMap((group) => group.commands))
const commandIndex = computed(
    () => new Map(allCommands.value.map((command) => [command.id, command])),
)

function valuesFor(id: string): CommandValues {
    let current = values[id]
    if (!current) {
        const command = commandIndex.value.get(id)
        current = command ? createDefaultValues(command) : {}
        values[id] = current
    }
    return current
}

const filteredGroups = computed(() =>
    commands.groups
        .map((group) => ({
            ...group,
            commands: group.commands.filter((command) => matchesQuery(query.value, command, group)),
        }))
        .filter((group) => group.commands.length > 0),
)

const visibleCount = computed(() =>
    filteredGroups.value.reduce((sum, group) => sum + group.commands.length, 0),
)

const selectedCount = computed(() => selected.value.size)

const selectedRunnableCount = computed(
    () =>
        allCommands.value.filter(
            (command) => selected.value.has(command.id) && isCommandReady(command, valuesFor(command.id)),
        ).length,
)

const bulkLabel = computed(() => {
    if (batchRunning.value) return `执行中 ${batchDone.value}/${batchTotal.value}`
    if (selectedRunnableCount.value) return `批量执行 (${selectedRunnableCount.value})`
    return '批量执行'
})

const connected = computed(() => connection.isConnected)
const barStatus = computed(() => (connected.value ? `已连接 · ${connection.address}` : '未连接'))
const canRun = computed(() => connected.value && !batchRunning.value)
const playerNames = computed(() => connection.players?.names ?? [])

const sourceLabel = computed(() => {
    if (commands.source === 'json') return '指令来自 command.json'
    return '正在使用内置指令'
})

watch(query, (value) => {
    if (!value.trim()) return
    for (const group of filteredGroups.value) expanded[group.id] = true
})

watch(
    () => commands.groups,
    () => {
        for (const key of Object.keys(values)) delete values[key]
        for (const key of Object.keys(expanded)) delete expanded[key]
        selected.value = new Set()
    },
)

onMounted(() => {
    void commands.load()
})

function isExpanded(group: CommandGroup): boolean {
    return expanded[group.id] ?? group.defaultExpanded ?? false
}

function toggleGroup(group: CommandGroup) {
    expanded[group.id] = !isExpanded(group)
}

function expandAll() {
    for (const group of commands.groups) expanded[group.id] = true
}

function collapseAll() {
    for (const group of commands.groups) expanded[group.id] = false
}

async function reload() {
    await commands.load()
}

function isSelected(id: string) {
    return selected.value.has(id)
}

function toggleSelection(id: string) {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
}

function clearSelection() {
    selected.value = new Set()
}

function preview(command: CommandDef) {
    return buildCommand(command, valuesFor(command.id))
}

function issue(command: CommandDef) {
    return commandIssue(command, valuesFor(command.id))
}

function setToggle(commandId: string, key: string, event: Event) {
    valuesFor(commandId)[key] = (event.target as HTMLInputElement).checked ? 'true' : 'false'
}

async function runOne(command: CommandDef): Promise<boolean> {
    if (runningIds.has(command.id) || !isCommandReady(command, valuesFor(command.id))) return false

    runningIds.add(command.id)
    try {
        const result = await connection.execute(
            buildCommand(command, valuesFor(command.id)),
            buildCall(command, valuesFor(command.id)),
        )
        if (result.ok) {
            feedback[command.id] = {
                tone: 'ok',
                text: result.response ? `已执行 · ${result.response}` : '已执行',
            }
            return true
        }
        feedback[command.id] = { tone: 'error', text: result.message ?? '执行失败' }
        return false
    } catch (error) {
        feedback[command.id] = {
            tone: 'error',
            text: error instanceof Error ? error.message : '执行失败',
        }
        return false
    } finally {
        runningIds.delete(command.id)
    }
}

async function runSelected() {
    if (batchRunning.value || !canRun.value) return

    const selectedCommands = allCommands.value.filter((command) => selected.value.has(command.id))
    const runnable = selectedCommands.filter((command) => isCommandReady(command, valuesFor(command.id)))
    const skipped = selectedCommands.length - runnable.length

    if (!runnable.length) {
        batchMessage.value = { tone: 'error', text: '选中的指令参数不完整，请先填写后再执行。' }
        return
    }

    batchRunning.value = true
    batchDone.value = 0
    batchTotal.value = runnable.length
    batchMessage.value = null

    let ok = 0
    let failed = 0
    for (const command of runnable) {
        const success = await runOne(command)
        if (success) ok += 1
        else failed += 1
        batchDone.value += 1
    }

    batchRunning.value = false

    const parts = [`成功 ${ok} 条`]
    if (failed) parts.push(`失败 ${failed} 条`)
    if (skipped) parts.push(`跳过 ${skipped} 条（参数不完整）`)
    batchMessage.value = {
        tone: failed ? 'error' : 'ok',
        text: `批量执行完成：${parts.join('，')}。`,
    }
}

async function goConsole() {
    await router.push({ name: 'console' })
}

async function goFlow() {
    await router.push({ name: 'flow' })
}
</script>

<template>
    <div class="commands">
        <AppBar :tone="connected ? 'ready' : 'idle'" :status="barStatus">
            <button class="bar-button" type="button" @click="goFlow">流程图</button>
            <button class="bar-button" type="button" @click="goConsole">返回控制台</button>
            <UpdateControl />
        </AppBar>

        <main class="commands__main">
            <header class="commands__head">
                <div class="commands__intro">
                    <h1 class="commands__title">指令集</h1>
                    <p class="commands__sub">
                        共 {{ commands.total }} 条指令 · 当前显示 {{ visibleCount }} 条
                    </p>
                </div>

                <div class="commands__tools">
                    <div class="search">
                        <span class="search__icon" aria-hidden="true"></span>
                        <input v-model="query" class="search__input" type="search" placeholder="搜索：give / 苹果 / 加速 …"
                            aria-label="搜索指令" autocomplete="off" spellcheck="false" />
                        <button v-if="query" class="search__clear" type="button" @click="query = ''">
                            清除
                        </button>
                    </div>

                    <div class="tools__group">
                        <button class="tool-button" type="button" @click="expandAll">全部展开</button>
                        <button class="tool-button" type="button" @click="collapseAll">全部折叠</button>
                        <button class="tool-button" type="button" :disabled="commands.loading" @click="reload">
                            {{ commands.loading ? '加载中…' : '重新加载指令' }}
                        </button>
                    </div>
                </div>
            </header>

            <p v-if="!connected" class="notice notice--warn" role="status">
                尚未连接服务器，执行按钮暂不可用。
            </p>

            <p v-if="commands.error" class="notice notice--error" role="status">
                读取 command.json 失败：{{ commands.error }}
                <template v-if="commands.filePath">（{{ commands.filePath }}）</template>
                ，当前使用内置指令。
            </p>
            <p v-else class="commands__source">
                {{ sourceLabel }}
                <template v-if="commands.filePath"> · {{ commands.filePath }}</template>
            </p>

            <p v-if="batchMessage" class="notice" :data-tone="batchMessage.tone" role="status">
                {{ batchMessage.text }}
            </p>

            <div v-if="selectedCount" class="bulk" role="region" aria-label="批量操作">
                <span class="bulk__count">
                    已选择 <strong>{{ selectedCount }}</strong> 条指令
                </span>
                <div class="bulk__actions">
                    <button class="bulk__run" type="button" :disabled="!canRun || !selectedRunnableCount"
                        @click="runSelected">
                        {{ bulkLabel }}
                    </button>
                    <button class="bulk__clear" type="button" :disabled="batchRunning" @click="clearSelection">
                        取消选择
                    </button>
                </div>
            </div>

            <p v-if="!filteredGroups.length" class="empty">
                没有找到与「{{ query.trim() }}」匹配的指令。
                <button class="empty__clear" type="button" @click="query = ''">清除搜索</button>
            </p>

            <section v-for="group in filteredGroups" :key="group.id" class="group">
                <button class="group__head" type="button" :aria-expanded="isExpanded(group)"
                    @click="toggleGroup(group)">
                    <span class="group__chevron" :class="{ 'is-open': isExpanded(group) }" aria-hidden="true"></span>
                    <span class="group__title">{{ group.name }}</span>
                    <span class="group__desc">{{ group.description }}</span>
                    <span class="group__count">{{ group.commands.length }}</span>
                </button>

                <ul v-if="isExpanded(group)" class="group__rows">
                    <li v-for="command in group.commands" :key="command.id" class="cmd"
                        :class="{ 'cmd--selected': isSelected(command.id) }">
                        <label class="cmd__select">
                            <input type="checkbox" :checked="isSelected(command.id)" :aria-label="`选择 ${command.name}`"
                                @change="toggleSelection(command.id)" />
                        </label>

                        <div class="cmd__main">
                            <div class="cmd__head">
                                <span class="cmd__name">{{ command.name }}</span>
                                <code class="cmd__preview">/{{ preview(command) }}</code>
                            </div>

                            <div v-if="command.args.length" class="cmd__fields">
                                <label v-for="arg in command.args" :key="arg.key" class="arg"
                                    :class="`arg--${arg.width ?? 'md'}`">
                                    <span class="arg__label">{{ arg.label }}</span>

                                    <input v-if="arg.kind === 'text' || arg.kind === 'number'"
                                        v-model="valuesFor(command.id)[arg.key]" class="arg__input"
                                        :type="arg.kind === 'number' ? 'number' : 'text'" :placeholder="arg.placeholder"
                                        :min="arg.min" :max="arg.max"
                                        :list="arg.suggestPlayers ? 'command-players' : undefined"
                                        :inputmode="arg.kind === 'number' ? 'numeric' : undefined" autocomplete="off"
                                        spellcheck="false" />

                                    <select v-else-if="arg.kind === 'select'" v-model="valuesFor(command.id)[arg.key]"
                                        class="arg__input">
                                        <option v-for="option in arg.options" :key="option.value" :value="option.value">
                                            {{ option.label }}
                                        </option>
                                    </select>

                                    <span v-else class="arg__toggle">
                                        <input type="checkbox" :checked="valuesFor(command.id)[arg.key] === 'true'"
                                            @change="setToggle(command.id, arg.key, $event)" />
                                        <span>{{ valuesFor(command.id)[arg.key] === 'true' ? '开启' : '关闭' }}</span>
                                    </span>
                                </label>
                            </div>

                            <p v-if="issue(command)" class="cmd__hint">{{ issue(command) }}</p>
                            <p v-if="feedback[command.id]" class="cmd__feedback" :data-tone="feedback[command.id]?.tone"
                                :title="feedback[command.id]?.text">
                                {{ feedback[command.id]?.text }}
                            </p>
                        </div>

                        <button class="cmd__run" type="button" :disabled="!canRun ||
                            !isCommandReady(command, valuesFor(command.id)) ||
                            runningIds.has(command.id)
                            " @click="runOne(command)">
                            {{ runningIds.has(command.id) ? '执行中' : '执行' }}
                        </button>
                    </li>
                </ul>
            </section>

            <datalist id="command-players">
                <option v-for="name in playerNames" :key="name" :value="name" />
            </datalist>
        </main>
    </div>
</template>

<style scoped>
.commands {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background-color: var(--bg);
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 36px 36px;
}

.commands__main {
    display: grid;
    flex: 1;
    gap: 18px;
    align-content: start;
    width: min(1180px, 100%);
    margin: 0 auto;
    padding: clamp(24px, 3vw, 40px) clamp(20px, 4vw, 40px) 56px;
}

.commands__head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
}

.commands__title {
    font-family: var(--font-display);
    font-size: clamp(24px, 2.6vw, 32px);
    font-weight: 600;
    line-height: 1.2;
}

.commands__sub {
    margin-top: 6px;
    color: var(--text-dim);
    font-size: 12px;
}

.commands__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}

.search {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    width: min(340px, 100%);
    height: 40px;
    padding: 0 10px;
    background: var(--panel-input);
    border: 1px solid var(--line);
    border-radius: 2px;
}

.search:focus-within {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(226, 165, 75, 0.14);
}

.search__icon {
    position: relative;
    flex: none;
    width: 11px;
    height: 11px;
    border: 1.5px solid var(--text-dim);
    border-radius: 50%;
}

.search__icon::after {
    content: '';
    position: absolute;
    right: -5px;
    bottom: -3px;
    width: 6px;
    height: 1.5px;
    background: var(--text-dim);
    transform: rotate(45deg);
}

.search__input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    background: transparent;
    border: 0;
    outline: none;
    color: var(--text);
    font-size: 13px;
}

.search__input::placeholder {
    color: var(--text-dim);
}

.search__input::-webkit-search-cancel-button {
    display: none;
}

.search__clear {
    flex: none;
    padding: 4px 6px;
    background: transparent;
    border: 0;
    border-radius: 2px;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
}

.search__clear:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.05);
}

.tools__group {
    display: flex;
    gap: 8px;
}

.bar-button,
.tool-button {
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

.bar-button:hover:not(:disabled),
.tool-button:hover:not(:disabled) {
    border-color: var(--line-strong);
    color: var(--text);
}

.notice {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    color: var(--text-muted);
    font-size: 12px;
}

.notice--warn {
    background: rgba(226, 165, 75, 0.06);
    border-color: rgba(226, 165, 75, 0.4);
    color: var(--gold-strong);
}

.notice[data-tone='ok'] {
    background: rgba(111, 207, 151, 0.06);
    border-color: rgba(111, 207, 151, 0.35);
    color: #9fd9b8;
}

.notice[data-tone='error'] {
    background: rgba(229, 119, 95, 0.08);
    border-color: rgba(229, 119, 95, 0.4);
    color: var(--danger);
}

.notice--error {
    background: rgba(229, 119, 95, 0.08);
    border-color: rgba(229, 119, 95, 0.4);
    color: var(--danger);
    word-break: break-all;
}

.commands__source {
    overflow: hidden;
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tool-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.bulk {
    position: sticky;
    top: 12px;
    z-index: 4;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
    padding: 10px 16px;
    background: rgba(22, 27, 34, 0.94);
    border: 1px solid rgba(226, 165, 75, 0.45);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(6px);
}

.bulk__count {
    color: var(--text-muted);
    font-size: 13px;
}

.bulk__count strong {
    color: var(--gold);
    font-family: var(--font-mono);
}

.bulk__actions {
    display: flex;
    gap: 8px;
}

.bulk__run,
.bulk__clear {
    height: 30px;
    padding: 0 14px;
    border-radius: 2px;
    font-size: 12px;
    cursor: pointer;
}

.bulk__run {
    background: var(--gold);
    border: 1px solid transparent;
    color: var(--gold-ink);
    font-weight: 600;
}

.bulk__run:hover:not(:disabled) {
    background: var(--gold-strong);
}

.bulk__clear {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--text-muted);
}

.bulk__clear:hover:not(:disabled) {
    border-color: var(--line-strong);
    color: var(--text);
}

.bulk__run:disabled,
.bulk__clear:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.empty {
    padding: 32px 0;
    color: var(--text-dim);
    font-size: 13px;
}

.empty__clear {
    margin-left: 8px;
    padding: 2px 6px;
    background: transparent;
    border: 0;
    color: var(--gold);
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
}

.group {
    background: rgba(22, 27, 34, 0.62);
    border: 1px solid var(--line);
}

.group__head {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 18px;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--line);
    color: var(--text);
    text-align: left;
    cursor: pointer;
}

.group__head:hover {
    background: rgba(255, 255, 255, 0.02);
}

.group__chevron {
    flex: none;
    width: 7px;
    height: 7px;
    border-right: 1.5px solid var(--text-muted);
    border-bottom: 1.5px solid var(--text-muted);
    transform: rotate(-45deg);
}

.group__chevron.is-open {
    transform: rotate(45deg);
}

.group__title {
    flex: none;
    font-size: 14px;
    font-weight: 600;
}

.group__desc {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--text-dim);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.group__count {
    flex: none;
    padding: 1px 8px;
    border: 1px solid var(--line);
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 11px;
}

.group__rows {
    margin: 0;
    padding: 0;
    list-style: none;
}

.cmd {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    grid-template-areas: 'select main run';
    align-items: start;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
}

.cmd:last-child {
    border-bottom: 0;
}

.cmd--selected {
    background: rgba(226, 165, 75, 0.05);
    box-shadow: inset 2px 0 0 var(--gold);
}

.cmd__select {
    grid-area: select;
    display: flex;
    justify-content: center;
    padding-top: 2px;
    cursor: pointer;
}

.cmd__select input,
.arg__toggle input {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: var(--gold);
    cursor: pointer;
}

.cmd__main {
    grid-area: main;
    min-width: 0;
}

.cmd__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
}

.cmd__name {
    flex: none;
    font-size: 14px;
    font-weight: 600;
}

.cmd__preview {
    min-width: 0;
    overflow: hidden;
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cmd__fields {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 9px;
}

.arg {
    display: grid;
    gap: 4px;
    min-width: 0;
}

.arg--sm {
    width: 96px;
}

.arg--md {
    width: 152px;
}

.arg--lg {
    width: min(340px, 100%);
}

.arg__label {
    color: var(--text-dim);
    font-size: 11px;
}

.arg__input {
    width: 100%;
    height: 32px;
    padding: 0 9px;
    background: var(--panel-input);
    border: 1px solid var(--line);
    border-radius: 2px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
}

select.arg__input {
    padding-right: 4px;
    font-family: var(--font-sans);
}

.arg__input::placeholder {
    color: var(--text-dim);
    font-family: var(--font-sans);
}

.arg__input:focus {
    outline: none;
    border-color: var(--gold);
    box-shadow: 0 0 0 2px rgba(226, 165, 75, 0.14);
}

.arg__toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
}

.cmd__feedback {
    max-width: 100%;
    margin-top: 8px;
    overflow: hidden;
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cmd__feedback[data-tone='ok'] {
    color: #9fd9b8;
}

.cmd__feedback[data-tone='error'] {
    color: var(--danger);
}

.cmd__hint {
    margin-top: 8px;
    color: var(--text-dim);
    font-size: 11px;
}

.cmd__run {
    grid-area: run;
    align-self: center;
    min-width: 72px;
    height: 32px;
    padding: 0 14px;
    background: var(--gold);
    border: 0;
    border-radius: 2px;
    color: var(--gold-ink);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}

.cmd__run:hover:not(:disabled) {
    background: var(--gold-strong);
}

.cmd__run:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

@media (prefers-reduced-motion: no-preference) {

    .bar-button,
    .tool-button,
    .search,
    .arg__input,
    .cmd__run,
    .group__head,
    .group__chevron,
    .bulk__run,
    .bulk__clear {
        transition:
            border-color 0.15s ease,
            color 0.15s ease,
            background-color 0.15s ease,
            transform 0.15s ease;
    }
}

@media (max-width: 760px) {
    .commands__head {
        align-items: stretch;
    }

    .commands__tools {
        flex-direction: column;
        align-items: stretch;
    }

    .search {
        width: 100%;
    }

    .tools__group .tool-button {
        flex: 1;
    }

    .cmd {
        grid-template-columns: 26px minmax(0, 1fr);
        grid-template-areas:
            'select main'
            'run run';
        gap: 10px 12px;
    }

    .cmd__run {
        justify-self: end;
    }

    .group__desc {
        display: none;
    }
}

@media (max-width: 480px) {

    .arg--md,
    .arg--sm {
        width: calc(50% - 5px);
    }

    .arg--lg {
        width: 100%;
    }
}
</style>
