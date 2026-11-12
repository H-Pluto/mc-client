import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { defaultCommandGroups, type CommandGroup } from '@/lib/commands'
import { parseCommandFileText } from '@/lib/command-set'
import { getCommandFileApi } from '@/services/command-file'

export type CommandSource = 'json' | 'builtin'

export const useCommandsStore = defineStore('commands', () => {
  const groups = ref<CommandGroup[]>(defaultCommandGroups)
  const source = ref<CommandSource>('builtin')
  const filePath = ref('')
  const error = ref('')
  const loading = ref(false)

  const total = computed(() => groups.value.reduce((sum, group) => sum + group.commands.length, 0))

  async function load() {
    if (loading.value) return

    const api = getCommandFileApi()
    if (!api) {
      groups.value = defaultCommandGroups
      source.value = 'builtin'
      filePath.value = ''
      error.value = ''
      return
    }

    loading.value = true
    try {
      const result = await api.load()
      if (!result.ok) {
        groups.value = defaultCommandGroups
        source.value = 'builtin'
        filePath.value = ''
        error.value = result.message
        return
      }

      filePath.value = result.data.path
      try {
        groups.value = parseCommandFileText(result.data.content)
        source.value = 'json'
        error.value = ''
      } catch (parseError) {
        groups.value = defaultCommandGroups
        source.value = 'builtin'
        error.value = parseError instanceof Error ? parseError.message : String(parseError)
      }
    } catch (loadError) {
      groups.value = defaultCommandGroups
      source.value = 'builtin'
      error.value = loadError instanceof Error ? loadError.message : String(loadError)
    } finally {
      loading.value = false
    }
  }

  return { groups, source, filePath, error, loading, total, load }
})
