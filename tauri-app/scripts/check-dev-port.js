import { execSync } from 'node:child_process'
import { createServer } from 'node:net'

const PORT = 5174
const HOST = '127.0.0.1'

const canListen = () => new Promise(resolve => {
  const server = createServer()
  server.once('error', () => {
    server.close?.()
    resolve(false)
  })
  server.once('listening', () => {
    server.close(() => resolve(true))
  })
  // Try IPv6 first (::), then IPv4 (0.0.0.0) to catch all interfaces
  server.listen(PORT, '::', () => {
    // If IPv6 succeeds, also check IPv4
    const server4 = createServer()
    server4.once('error', () => {
      server4.close?.()
      server.close(() => resolve(false))
    })
    server4.once('listening', () => {
      server4.close(() => {
        server.close(() => resolve(true))
      })
    })
    server4.listen(PORT, '0.0.0.0')
  })
})

const getPidOnPort = () => {
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano', { encoding: 'utf8' })
      const lines = output.split(/\r?\n/)
      for (const line of lines) {
        // Match both IPv4 and IPv6 addresses
        const match = line.match(/TCP\s+(\[?::\]?|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|\[::\]):${PORT}\s+\S+\s+LISTENING\s+(\d+)/i)
        if (match) {
          return Number(match[2])
        }
      }
      return null
    }

    const output = execSync(`lsof -iTCP:${PORT} -sTCP:LISTEN -Pn`, { encoding: 'utf8' })
    const line = output.split(/\r?\n/).find(l => l && !l.startsWith('COMMAND'))
    if (!line) return null
    const parts = line.trim().split(/\s+/)
    return Number(parts[1])
  } catch {
    return null
  }
}

const killPid = pid => {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    } else {
      process.kill(pid, 'SIGTERM')
    }
    console.log(`Killed process ${pid} holding port ${PORT}`)
  } catch (error) {
    console.error(`Unable to kill process ${pid} on port ${PORT}:`, error.message)
    process.exit(1)
  }
}

const main = async () => {
  if (await canListen()) {
    console.log(`Port ${PORT} is free, starting Vite...`)
  } else {
    const pid = getPidOnPort()
    if (pid) {
      console.log(`Port ${PORT} is occupied by PID ${pid}, terminating it...`)
      killPid(pid)
      // 等待端口完全释放
      await new Promise(resolve => setTimeout(resolve, 2000))
      const free = await canListen()
      if (!free) {
        console.error(`Port ${PORT} is still occupied after killing PID ${pid}`)
        process.exit(1)
      }
    } else {
      console.error(`Port ${PORT} is occupied and PID could not be determined.`)
      process.exit(1)
    }
  }

  // 再次检查端口是否可用
  if (!(await canListen())) {
    const pid = getPidOnPort()
    if (pid) {
      console.log(`Port ${PORT} is still occupied by PID ${pid}, terminating it...`)
      killPid(pid)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  execSync('npm run dev', { stdio: 'inherit' })
}

main().catch(error => {
  console.error('Failed to start dev server:', error)
  process.exit(1)
})
