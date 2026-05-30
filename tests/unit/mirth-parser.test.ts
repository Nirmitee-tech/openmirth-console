import { describe, expect, it } from "vitest"
import { parseChannels, parseStatuses } from "@/lib/mirth/parser"
import { MirthSchemaError } from "@/lib/mirth/errors"

const STATUSES_XML = `
<list>
  <dashboardStatus>
    <channelId>11111111-1111-4111-8111-111111111111</channelId>
    <name>HL7v2 ADT to FHIR Bundle</name>
    <state>STARTED</state>
    <statistics>
      <entry><com.mirth.connect.donkey.model.message.Status>RECEIVED</com.mirth.connect.donkey.model.message.Status><long>42</long></entry>
      <entry><com.mirth.connect.donkey.model.message.Status>SENT</com.mirth.connect.donkey.model.message.Status><long>40</long></entry>
      <entry><com.mirth.connect.donkey.model.message.Status>ERROR</com.mirth.connect.donkey.model.message.Status><long>2</long></entry>
      <entry><com.mirth.connect.donkey.model.message.Status>QUEUED</com.mirth.connect.donkey.model.message.Status><long>0</long></entry>
      <entry><com.mirth.connect.donkey.model.message.Status>FILTERED</com.mirth.connect.donkey.model.message.Status><long>0</long></entry>
    </statistics>
  </dashboardStatus>
  <dashboardStatus>
    <channelId>22222222-2222-4222-8222-222222222222</channelId>
    <name>Lab Results (ORU) Listener</name>
    <state>STOPPED</state>
    <statistics>
      <entry><com.mirth.connect.donkey.model.message.Status>RECEIVED</com.mirth.connect.donkey.model.message.Status><long>0</long></entry>
    </statistics>
  </dashboardStatus>
</list>
`.trim()

const CHANNELS_XML = `
<list>
  <channel version="4.5.2">
    <id>11111111-1111-4111-8111-111111111111</id>
    <name>HL7v2 ADT to FHIR Bundle</name>
    <description>HL7v2 ADT to FHIR R4 Bundle</description>
    <revision>3</revision>
    <sourceConnector>
      <name>sourceConnector</name>
      <transportName>TCP Listener</transportName>
      <enabled>true</enabled>
      <properties class="com.mirth.connect.connectors.tcp.TcpReceiverProperties">
        <listenerConnectorProperties>
          <host>0.0.0.0</host>
          <port>6661</port>
        </listenerConnectorProperties>
      </properties>
    </sourceConnector>
    <destinationConnectors>
      <connector>
        <name>Destination 1</name>
        <transportName>HTTP Sender</transportName>
        <enabled>true</enabled>
        <properties class="com.mirth.connect.connectors.http.HttpDispatcherProperties">
          <url>http://example.invalid/api/lab</url>
          <method>post</method>
        </properties>
      </connector>
    </destinationConnectors>
  </channel>
</list>
`.trim()

describe("parseStatuses", () => {
  it("returns typed DashboardStatus[] with stats extracted", () => {
    const statuses = parseStatuses(STATUSES_XML)
    expect(statuses).toHaveLength(2)
    expect(statuses[0]).toMatchObject({
      channelId: "11111111-1111-4111-8111-111111111111",
      name: "HL7v2 ADT to FHIR Bundle",
      state: "STARTED",
      statistics: {
        received: 42,
        sent: 40,
        errored: 2,
        queued: 0,
        filtered: 0,
      },
    })
    expect(statuses[1].state).toBe("STOPPED")
  })

  it("returns [] for an empty list", () => {
    expect(parseStatuses("<list/>")).toEqual([])
  })

  it("throws MirthSchemaError on malformed XML", () => {
    expect(() => parseStatuses("not-xml-at-all-<<<")).toThrow(MirthSchemaError)
  })

  it("rejects a dashboardStatus with an invalid UUID", () => {
    const bad = `
<list><dashboardStatus>
  <channelId>not-a-uuid</channelId>
  <name>x</name><state>STARTED</state>
  <statistics/>
</dashboardStatus></list>`.trim()
    expect(() => parseStatuses(bad)).toThrow(MirthSchemaError)
  })
})

describe("parseChannels", () => {
  it("extracts channel id, name, description, source and destinations", () => {
    const chans = parseChannels(CHANNELS_XML)
    expect(chans).toHaveLength(1)
    const ch = chans[0]
    expect(ch.id).toBe("11111111-1111-4111-8111-111111111111")
    expect(ch.name).toBe("HL7v2 ADT to FHIR Bundle")
    expect(ch.revision).toBe("3")
    expect(ch.source.transportName).toBe("TCP Listener")
    expect(ch.source.details.port).toBe("6661")
    expect(ch.destinations).toHaveLength(1)
    expect(ch.destinations[0].transportName).toBe("HTTP Sender")
    expect(ch.destinations[0].details.url).toBe("http://example.invalid/api/lab")
    expect(ch.destinations[0].details.method).toBe("POST")
  })

  it("returns [] for an empty list", () => {
    expect(parseChannels("<list/>")).toEqual([])
  })

  it("throws MirthSchemaError on a channel without a uuid id", () => {
    const bad = `
<list><channel><id>not-a-uuid</id><name>n</name>
<sourceConnector><name>s</name><transportName>TCP Listener</transportName></sourceConnector>
<destinationConnectors/></channel></list>`.trim()
    expect(() => parseChannels(bad)).toThrow(MirthSchemaError)
  })
})
