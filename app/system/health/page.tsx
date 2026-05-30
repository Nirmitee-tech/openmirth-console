import { getMirthClient } from "@/lib/mirth/client"
import { MirthError } from "@/lib/mirth/errors"
import { parseSystemInfo, parseSystemStats, type SystemInfo, type SystemStats } from "@/lib/mirth/system"
import { Gauge } from "@/components/Gauge"
import { childLogger } from "@/lib/logger"

const log = childLogger({ component: "system-health-page" })

export const dynamic = "force-dynamic"

function bytes(n: number): string {
  if (!n) return "0 B"
  const u = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`
}

export default async function SystemHealthPage() {
  let info: SystemInfo | null = null
  let stats: SystemStats | null = null
  let version: string | null = null
  let error: string | null = null

  try {
    const client = getMirthClient()
    const [v, infoXml, statsXml] = await Promise.all([
      client.serverVersion().catch(() => null),
      client.systemInfo(),
      client.serverStats(),
    ])
    version = v
    info = parseSystemInfo(infoXml)
    stats = parseSystemStats(statsXml)
  } catch (e) {
    log.error({ err: (e as Error).message }, "system health fetch failed")
    error = e instanceof MirthError ? e.message : "Unable to load system health"
  }

  // Compute derived metrics
  const heapUsed = stats ? stats.allocatedMemoryBytes - stats.freeMemoryBytes : 0
  const heapUsedPct = stats && stats.maxMemoryBytes > 0
    ? (heapUsed / stats.maxMemoryBytes) * 100
    : 0
  const diskUsedPct = stats && stats.diskTotalBytes > 0
    ? ((stats.diskTotalBytes - stats.diskFreeBytes) / stats.diskTotalBytes) * 100
    : 0

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">System Health</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">
          Mirth Connect JVM + OS stats. Refresh the page for a fresh sample.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-900 px-4 py-3 text-sm dark:bg-red-900/40 dark:text-red-200 dark:border-red-800">
          {error}
        </div>
      ) : null}

      {stats ? (
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100 uppercase tracking-wide mb-4">
            Live gauges
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 place-items-center">
            <Gauge value={heapUsedPct} label="Heap" caption={`${bytes(heapUsed)} / ${bytes(stats.maxMemoryBytes)}`} />
            <Gauge value={stats.cpuUsagePct} label="CPU" caption="process" />
            <Gauge value={diskUsedPct} label="Disk" caption={`${bytes(stats.diskTotalBytes - stats.diskFreeBytes)} / ${bytes(stats.diskTotalBytes)}`} />
            <Gauge value={(stats.allocatedMemoryBytes / stats.maxMemoryBytes) * 100} label="Allocated" caption={bytes(stats.allocatedMemoryBytes)} />
          </div>
        </section>
      ) : null}

      {info ? (
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100 uppercase tracking-wide mb-3">
            Server info
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Pair label="Mirth Connect" value={version ?? "—"} />
            <Pair label="JVM" value={info.jvmVersion} />
            <Pair label="OS" value={`${info.osName} ${info.osVersion}`} />
            <Pair label="Arch" value={info.osArchitecture} />
            <Pair label="Database" value={`${info.dbName} ${info.dbVersion}`} />
            {stats ? (
              <Pair label="Sampled at" value={new Date(stats.timestamp).toISOString()} />
            ) : null}
          </dl>
        </section>
      ) : null}

      {stats ? (
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100 uppercase tracking-wide mb-3">
            Raw counters
          </h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
            <Pair label="Heap allocated" value={bytes(stats.allocatedMemoryBytes)} />
            <Pair label="Heap free" value={bytes(stats.freeMemoryBytes)} />
            <Pair label="Heap max" value={bytes(stats.maxMemoryBytes)} />
            <Pair label="Disk free" value={bytes(stats.diskFreeBytes)} />
            <Pair label="Disk total" value={bytes(stats.diskTotalBytes)} />
            <Pair label="CPU" value={`${stats.cpuUsagePct.toFixed(1)}%`} />
          </dl>
        </section>
      ) : null}
    </div>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-ink-600 dark:text-ink-400 w-[140px] text-xs uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-ink-800 dark:text-ink-200 dark:text-ink-100 font-mono text-sm break-all">{value}</dd>
    </div>
  )
}
