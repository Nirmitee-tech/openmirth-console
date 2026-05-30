import { describe, expect, it } from "vitest"
import { parseConfigurationMap, serializeConfigurationMap } from "@/lib/mirth/parser"

const SAMPLE = `
<map>
  <entry>
    <string>FACILITY_NPI</string>
    <com.mirth.connect.util.ConfigurationProperty>
      <value>1234567890</value>
      <comment>NPI for the main facility</comment>
    </com.mirth.connect.util.ConfigurationProperty>
  </entry>
  <entry>
    <string>LAB_ENDPOINT</string>
    <com.mirth.connect.util.ConfigurationProperty>
      <value>http://lab.internal/api</value>
      <comment></comment>
    </com.mirth.connect.util.ConfigurationProperty>
  </entry>
</map>
`.trim()

describe("parseConfigurationMap", () => {
  it("extracts key/value pairs", () => {
    const m = parseConfigurationMap(SAMPLE)
    expect(m).toEqual({
      FACILITY_NPI: "1234567890",
      LAB_ENDPOINT: "http://lab.internal/api",
    })
  })
  it("returns {} on empty map", () => {
    expect(parseConfigurationMap("<map/>")).toEqual({})
  })
  it("returns {} when root element is missing", () => {
    expect(parseConfigurationMap("<other/>")).toEqual({})
  })
})

describe("serializeConfigurationMap", () => {
  it("produces XStream-compatible XML that round-trips", () => {
    const original = {
      ZULU: "z-value",
      ALPHA: "a-value",
      "HAS<SPECIAL>": "1 & 2",
    }
    const xml = serializeConfigurationMap(original)
    expect(xml).toMatch(/^<map>/)
    expect(xml).toMatch(/<\/map>\s*$/)
    // Sorted by key (alpha first)
    expect(xml.indexOf("ALPHA")).toBeLessThan(xml.indexOf("ZULU"))
    // Round trip
    const back = parseConfigurationMap(xml)
    expect(back).toEqual(original)
  })
  it("escapes XML metacharacters in keys and values", () => {
    const xml = serializeConfigurationMap({ "K&Y": "<v>" })
    expect(xml).toContain("K&amp;Y")
    expect(xml).toContain("&lt;v&gt;")
    expect(xml).not.toContain("K&Y")
    expect(xml).not.toContain("<v>")
  })
})
