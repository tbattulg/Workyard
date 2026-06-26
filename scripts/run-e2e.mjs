import { spawn } from 'node:child_process'
import { createServer } from 'vite'

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})

await server.listen()
server.printUrls()

const args = ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)]
const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never' },
})

let shuttingDown = false
async function shutdown(code = 1) {
  if (shuttingDown) return
  shuttingDown = true
  child.kill()
  await server.close()
  process.exit(code)
}

child.on('exit', (code) => {
  void shutdown(code ?? 1)
})

process.on('SIGINT', () => {
  void shutdown(130)
})
process.on('SIGTERM', () => {
  void shutdown(143)
})
