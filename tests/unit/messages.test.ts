import { describe, expect, it } from "vitest"
import { parseMessages } from "@/lib/mirth/messages"

const SAMPLE = `<list>
  <message>
    <messageId>42</messageId>
    <receivedDate><time>1779000000000</time><timezone>Etc/UTC</timezone></receivedDate>
    <processed>true</processed>
    <connectorMessages class="linked-hash-map">
      <entry>
        <int>0</int>
        <connectorMessage>
          <metaDataId>0</metaDataId>
          <connectorName>Source</connectorName>
          <status>TRANSFORMED</status>
          <raw>
            <contentType>RAW</contentType>
            <content>MSH|^~\\&amp;|EPIC|HOSP|MIRTH|DEMO|20260528000000||ADT^A01|M42|P|2.5.1&#xd;PID|1||MRN42||DOE^JANE||19800101|F</content>
          </raw>
          <transformed>
            <contentType>TRANSFORMED</contentType>
            <content>&lt;HL7Message&gt;&lt;MSH&gt;&lt;MSH.10&gt;M42&lt;/MSH.10&gt;&lt;/MSH&gt;&lt;/HL7Message&gt;</content>
          </transformed>
          <encoded>
            <contentType>ENCODED</contentType>
            <content>MSH|^~\\&amp;|EPIC|HOSP|...</content>
          </encoded>
        </connectorMessage>
      </entry>
      <entry>
        <int>1</int>
        <connectorMessage>
          <metaDataId>1</metaDataId>
          <connectorName>FHIR Bundle Out</connectorName>
          <status>SENT</status>
          <raw>
            <contentType>RAW</contentType>
            <content>{"resourceType":"Bundle"}</content>
          </raw>
          <response>
            <contentType>RESPONSE</contentType>
            <content>{"id":"abc123"}</content>
          </response>
        </connectorMessage>
      </entry>
    </connectorMessages>
  </message>
  <message>
    <messageId>43</messageId>
    <receivedDate><time>1779000010000</time><timezone>Etc/UTC</timezone></receivedDate>
    <processed>false</processed>
    <connectorMessages class="linked-hash-map">
      <entry><int>0</int>
        <connectorMessage>
          <metaDataId>0</metaDataId>
          <connectorName>Source</connectorName>
          <status>ERROR</status>
        </connectorMessage>
      </entry>
    </connectorMessages>
  </message>
</list>`

describe("parseMessages", () => {
  it("returns one entry per <message>", () => {
    const out = parseMessages(SAMPLE)
    expect(out).toHaveLength(2)
    expect(out[0].messageId).toBe("42")
    expect(out[1].messageId).toBe("43")
  })

  it("parses receivedAt as epoch ms", () => {
    const out = parseMessages(SAMPLE)
    expect(out[0].receivedAt).toBe(1779000000000)
  })

  it("orders connectors by metaDataId", () => {
    const out = parseMessages(SAMPLE)
    expect(out[0].connectors.map((c) => c.metaDataId)).toEqual([0, 1])
  })

  it("un-escapes XML entities and CR markers in content", () => {
    const out = parseMessages(SAMPLE)
    expect(out[0].connectors[0].raw).toContain("ADT^A01")
    expect(out[0].connectors[0].raw).toContain("\r") // &#xd; un-escaped
    expect(out[0].connectors[0].transformed).toContain("<HL7Message>")
    expect(out[0].connectors[0].transformed).not.toContain("&lt;")
  })

  it("returns null for missing payload fields", () => {
    const out = parseMessages(SAMPLE)
    expect(out[0].connectors[0].response).toBe(null)
    expect(out[0].connectors[1].transformed).toBe(null)
    expect(out[0].connectors[1].encoded).toBe(null)
  })

  it("recognizes valid status codes and maps unknown to UNKNOWN", () => {
    const out = parseMessages(SAMPLE)
    expect(out[0].connectors[0].status).toBe("TRANSFORMED")
    expect(out[0].connectors[1].status).toBe("SENT")
    expect(out[1].connectors[0].status).toBe("ERROR")
  })
})
