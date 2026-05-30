import { describe, expect, it } from "vitest"
import {
  parseChannelGroups,
  parseEvents,
  parseSystemInfo,
  parseSystemStats,
} from "@/lib/mirth/system"

describe("parseSystemInfo", () => {
  it("extracts JVM / OS / DB fields", () => {
    const xml = `<com.mirth.connect.model.SystemInfo>
      <jvmVersion>17.0.13</jvmVersion>
      <osName>Linux</osName>
      <osVersion>6.12</osVersion>
      <osArchitecture>aarch64</osArchitecture>
      <dbName>PostgreSQL</dbName>
      <dbVersion>16.14</dbVersion>
    </com.mirth.connect.model.SystemInfo>`
    const info = parseSystemInfo(xml)
    expect(info).toEqual({
      jvmVersion: "17.0.13",
      osName: "Linux",
      osVersion: "6.12",
      osArchitecture: "aarch64",
      dbName: "PostgreSQL",
      dbVersion: "16.14",
    })
  })
  it("returns empty strings for missing fields", () => {
    expect(parseSystemInfo("<x/>")).toEqual({
      jvmVersion: "",
      osName: "",
      osVersion: "",
      osArchitecture: "",
      dbName: "",
      dbVersion: "",
    })
  })
})

describe("parseSystemStats", () => {
  it("extracts numeric counters", () => {
    const xml = `<com.mirth.connect.model.SystemStats>
      <timestamp><time>1780000000000</time><timezone>Etc/UTC</timezone></timestamp>
      <cpuUsagePct>12.5</cpuUsagePct>
      <allocatedMemoryBytes>177209344</allocatedMemoryBytes>
      <freeMemoryBytes>44781944</freeMemoryBytes>
      <maxMemoryBytes>536870912</maxMemoryBytes>
      <diskFreeBytes>10</diskFreeBytes>
      <diskTotalBytes>100</diskTotalBytes>
    </com.mirth.connect.model.SystemStats>`
    const s = parseSystemStats(xml)
    expect(s.timestamp).toBe(1780000000000)
    expect(s.cpuUsagePct).toBeCloseTo(12.5)
    expect(s.allocatedMemoryBytes).toBe(177209344)
    expect(s.diskFreeBytes).toBe(10)
    expect(s.diskTotalBytes).toBe(100)
  })
  it("coerces missing values to 0", () => {
    const s = parseSystemStats("<x/>")
    expect(s.timestamp).toBe(0)
    expect(s.cpuUsagePct).toBe(0)
    expect(s.maxMemoryBytes).toBe(0)
  })
})

describe("parseEvents", () => {
  const xml = `<list>
    <event>
      <id>1</id>
      <eventTime><time>1779999990000</time><timezone>UTC</timezone></eventTime>
      <level>INFORMATION</level>
      <name>Get channels</name>
      <outcome>SUCCESS</outcome>
      <userId>1</userId>
      <ipAddress>10.0.0.1</ipAddress>
      <attributes class="linked-hash-map"/>
    </event>
    <event>
      <id>2</id>
      <eventTime><time>1779999991000</time><timezone>UTC</timezone></eventTime>
      <level>ERROR</level>
      <name>Channel start failed &amp; rejected</name>
      <outcome>FAILURE</outcome>
      <userId>2</userId>
      <ipAddress>10.0.0.2</ipAddress>
      <attributes class="linked-hash-map">
        <entry>
          <string>channelId</string>
          <string>abc-123</string>
        </entry>
        <entry>
          <string>error</string>
          <string>NPE in transformer</string>
        </entry>
      </attributes>
    </event>
  </list>`

  it("extracts events with id + eventTime", () => {
    const events = parseEvents(xml)
    expect(events).toHaveLength(2)
    expect(events[0].id).toBe("1")
    expect(events[0].eventTime).toBe(1779999990000)
    expect(events[1].id).toBe("2")
  })
  it("maps known level + outcome values", () => {
    const events = parseEvents(xml)
    expect(events[0].level).toBe("INFORMATION")
    expect(events[0].outcome).toBe("SUCCESS")
    expect(events[1].level).toBe("ERROR")
    expect(events[1].outcome).toBe("FAILURE")
  })
  it("falls back to INFORMATION / UNKNOWN for unknown level/outcome", () => {
    const events = parseEvents(`<list><event><id>1</id>
      <eventTime><time>1</time><timezone>UTC</timezone></eventTime>
      <level>BOGUS</level><name>n</name><outcome>BOGUS</outcome>
      <userId>1</userId><ipAddress/></event></list>`)
    expect(events[0].level).toBe("INFORMATION")
    expect(events[0].outcome).toBe("UNKNOWN")
  })
  it("un-escapes XML entities in event names + attribute values", () => {
    const events = parseEvents(xml)
    expect(events[1].name).toContain("&")
    expect(events[1].name).not.toContain("&amp;")
  })
  it("parses attribute maps", () => {
    const events = parseEvents(xml)
    expect(events[1].attributes).toEqual({
      channelId: "abc-123",
      error: "NPE in transformer",
    })
  })
  it("returns [] on empty list", () => {
    expect(parseEvents("<list/>")).toEqual([])
  })
})

describe("parseChannelGroups", () => {
  const xml = `<list>
    <channelGroup version="4.5.2">
      <id>g1</id>
      <name>HL7 Inbound</name>
      <description>All inbound HL7 feeds</description>
      <channels>
        <channel version="4.5.2"><id>11111111-1111-4111-8111-111111111111</id></channel>
        <channel version="4.5.2"><id>22222222-2222-4222-8222-222222222222</id></channel>
      </channels>
    </channelGroup>
  </list>`

  it("extracts group id/name/description", () => {
    const groups = parseChannelGroups(xml)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      id: "g1",
      name: "HL7 Inbound",
      description: "All inbound HL7 feeds",
    })
  })
  it("extracts member channel IDs", () => {
    const groups = parseChannelGroups(xml)
    expect(groups[0].channelIds).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ])
  })
  it("returns [] on empty list", () => {
    expect(parseChannelGroups("<list/>")).toEqual([])
  })
})
