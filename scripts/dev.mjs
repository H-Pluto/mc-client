import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const electronPath = require('electron')

const server = await createServer({ server: { open: false } })
await server.listen()
server.printUrls()

const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5173/'
const child = spawn(electronPath, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})

let closing = false

async function shutdown(code = 0) {
  if (closing) return
  closing = true
  await server.close()
  process.exit(code)
}

child.on('exit', (code) => {
  void shutdown(code ?? 0)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill()
    void shutdown(0)
  })
}
