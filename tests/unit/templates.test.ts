import { describe, expect, it } from "vitest"
import { buildChannelXml, TemplateInputSchema } from "@/lib/mirth/templates"

const ID = "11111111-1111-4111-8111-111111111111"

function valid(template: "mllp-passthrough" | "http-passthrough" | "channel-writer") {
  switch (template) {
    case "mllp-passthrough":
      return { template, name: "ADT In", description: "x", port: 6661 }
    case "http-passthrough":
      return { template, name: "Webhook", description: "x", port: 8081, contextPath: "/in" }
    case "channel-writer":
      return { template, name: "Bridge", description: "x" }
  }
}

describe("TemplateInputSchema", () => {
  it("requires port for MLLP", () => {
    const r = TemplateInputSchema.safeParse({
      template: "mllp-passthrough",
      name: "x",
      description: "",
    })
    expect(r.success).toBe(false)
  })
  it("requires port + contextPath for HTTP", () => {
    const r = TemplateInputSchema.safeParse({
      template: "http-passthrough",
      name: "x",
      description: "",
      port: 8080,
    })
    expect(r.success).toBe(false)
  })
  it("rejects contextPath without leading slash", () => {
    const r = TemplateInputSchema.safeParse({
      template: "http-passthrough",
      name: "x",
      description: "",
      port: 8080,
      contextPath: "noLeadingSlash",
    })
    expect(r.success).toBe(false)
  })
  it("rejects port out of range", () => {
    expect(
      TemplateInputSchema.safeParse({
        template: "mllp-passthrough",
        name: "x",
        description: "",
        port: 70000,
      }).success
    ).toBe(false)
    expect(
      TemplateInputSchema.safeParse({
        template: "mllp-passthrough",
        name: "x",
        description: "",
        port: 0,
      }).success
    ).toBe(false)
  })
})

describe("buildChannelXml", () => {
  it("produces well-formed XML for MLLP passthrough", () => {
    const xml = buildChannelXml(valid("mllp-passthrough"), ID)
    expect(xml).toContain(`<id>${ID}</id>`)
    expect(xml).toContain(`<name>ADT In</name>`)
    expect(xml).toContain(`<port>6661</port>`)
    expect(xml).toContain(`<transportName>TCP Listener</transportName>`)
    expect(xml).toContain(`<mode>SOURCE</mode>`)
    expect(xml).toContain(`<mode>DESTINATION</mode>`)
  })

  it("produces well-formed XML for HTTP passthrough", () => {
    const xml = buildChannelXml(valid("http-passthrough"), ID)
    expect(xml).toContain(`<port>8081</port>`)
    expect(xml).toContain(`<contextPath>/in</contextPath>`)
    expect(xml).toContain(`<transportName>HTTP Listener</transportName>`)
  })

  it("produces well-formed XML for channel-writer", () => {
    const xml = buildChannelXml(valid("channel-writer"), ID)
    expect(xml).toContain(`<transportName>Channel Reader</transportName>`)
    expect(xml).toContain(`<transportName>Channel Writer</transportName>`)
  })

  it("escapes XML metacharacters in name/description", () => {
    const xml = buildChannelXml(
      { ...valid("channel-writer"), name: `Bad & <name>`, description: `"<>'&"` },
      ID
    )
    expect(xml).toContain("Bad &amp; &lt;name&gt;")
    expect(xml).not.toContain(`Bad & <name>`)
  })

  it("uses target channel id when supplied", () => {
    const target = "22222222-2222-4222-8222-222222222222"
    const xml = buildChannelXml(
      { ...valid("mllp-passthrough"), targetChannelId: target },
      ID
    )
    expect(xml).toContain(`<channelId>${target}</channelId>`)
  })
})
