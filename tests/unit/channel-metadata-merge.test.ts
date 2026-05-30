import { describe, expect, it } from "vitest"
import { mergeChannelMetadata } from "@/lib/mirth/parser"

const EXISTING = `<map>
  <entry>
    <string>00000000-0000-4000-8000-aaaaaaaaaaaa</string>
    <com.mirth.connect.model.ChannelMetadata>
      <enabled>true</enabled>
      <lastModified><time>1700000000000</time><timezone>UTC</timezone></lastModified>
      <pruningSettings>
        <pruneMetaDataDays>60</pruneMetaDataDays>
        <pruneContentDays>60</pruneContentDays>
        <archiveEnabled>true</archiveEnabled>
      </pruningSettings>
    </com.mirth.connect.model.ChannelMetadata>
  </entry>
  <entry>
    <string>00000000-0000-4000-8000-bbbbbbbbbbbb</string>
    <com.mirth.connect.model.ChannelMetadata>
      <enabled>false</enabled>
      <lastModified><time>0</time><timezone>UTC</timezone></lastModified>
      <pruningSettings>
        <pruneMetaDataDays>30</pruneMetaDataDays>
        <pruneContentDays>30</pruneContentDays>
        <archiveEnabled>false</archiveEnabled>
      </pruningSettings>
    </com.mirth.connect.model.ChannelMetadata>
  </entry>
</map>`

describe("mergeChannelMetadata", () => {
  it("preserves all existing entries when adding a new channel", () => {
    const out = mergeChannelMetadata(
      EXISTING,
      "00000000-0000-4000-8000-cccccccccccc",
      true
    )
    expect(out).toContain("00000000-0000-4000-8000-aaaaaaaaaaaa")
    expect(out).toContain("00000000-0000-4000-8000-bbbbbbbbbbbb")
    expect(out).toContain("00000000-0000-4000-8000-cccccccccccc")
  })

  it("preserves per-channel pruning settings (60-day archive)", () => {
    const out = mergeChannelMetadata(
      EXISTING,
      "00000000-0000-4000-8000-cccccccccccc",
      true
    )
    expect(out).toMatch(
      /<string>00000000-0000-4000-8000-aaaaaaaaaaaa<\/string>[\s\S]*?<pruneMetaDataDays>60<\/pruneMetaDataDays>[\s\S]*?<archiveEnabled>true<\/archiveEnabled>/
    )
  })

  it("flips the enabled flag for an existing channel without losing siblings", () => {
    const out = mergeChannelMetadata(
      EXISTING,
      "00000000-0000-4000-8000-bbbbbbbbbbbb",
      true
    )
    // Target channel now enabled
    expect(out).toMatch(
      /<string>00000000-0000-4000-8000-bbbbbbbbbbbb<\/string>\s*<com.mirth.connect.model.ChannelMetadata>\s*<enabled>true<\/enabled>/
    )
    // First channel's settings untouched
    expect(out).toContain("<pruneMetaDataDays>60</pruneMetaDataDays>")
  })

  it("handles an empty existing map by emitting just the new entry", () => {
    const out = mergeChannelMetadata(
      "<map/>",
      "00000000-0000-4000-8000-ffffffffffff",
      true
    )
    expect(out).toContain("00000000-0000-4000-8000-ffffffffffff")
    expect(out).toMatch(/<enabled>true<\/enabled>/)
  })

  it("emits sane pruning defaults for a brand-new entry", () => {
    const out = mergeChannelMetadata(
      "<map/>",
      "00000000-0000-4000-8000-ffffffffffff",
      false
    )
    expect(out).toContain("<pruneMetaDataDays>30</pruneMetaDataDays>")
    expect(out).toContain("<pruneContentDays>30</pruneContentDays>")
    expect(out).toContain("<archiveEnabled>false</archiveEnabled>")
  })
})
