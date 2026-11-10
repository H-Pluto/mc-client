<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'idle' | 'partial' | 'ready'
    status?: string
  }>(),
  { tone: 'idle' },
)
</script>

<template>
  <header class="app-bar">
    <div class="app-bar__brand">
      <span class="app-bar__mark" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </span>
      <span class="app-bar__name">MC RCON</span>
    </div>

    <div class="app-bar__end">
      <span v-if="status" class="app-bar__status" :data-tone="tone" aria-live="polite">
        <span class="app-bar__dot" aria-hidden="true"></span>
        <span class="app-bar__status-text">{{ status }}</span>
      </span>
      <slot />
    </div>
  </header>
</template>

<style scoped>
.app-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  height: 60px;
  padding: 0 clamp(18px, 4vw, 32px);
  border-bottom: 1px solid var(--line);
}

.app-bar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-bar__mark {
  display: grid;
  grid-template-columns: repeat(2, 5px);
  grid-template-rows: repeat(2, 5px);
  gap: 3px;
}

.app-bar__mark span {
  background: var(--gold);
}

.app-bar__mark span:nth-child(4) {
  opacity: 0.35;
}

.app-bar__name {
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 0.14em;
}

.app-bar__end {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.app-bar__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
}

.app-bar__dot {
  flex: none;
  width: 6px;
  height: 6px;
  background: var(--text-dim);
}

.app-bar__status[data-tone='partial'] {
  color: var(--text-muted);
}

.app-bar__status[data-tone='partial'] .app-bar__dot {
  background: var(--text-muted);
}

.app-bar__status[data-tone='ready'] {
  color: var(--text);
}

.app-bar__status[data-tone='ready'] .app-bar__dot {
  background: var(--gold);
  box-shadow: 0 0 8px rgba(226, 165, 75, 0.55);
}

.app-bar__status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: no-preference) {
  .app-bar__dot {
    transition: background-color 0.2s ease;
  }
}
</style>
