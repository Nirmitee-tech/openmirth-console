/**
 * Channel templates the New Channel page exposes.
 *
 * Each template renders a complete XStream-serialized <channel> element that
 * Mirth's REST API accepts. We build the XML from a typed input object so
 * the UI can validate fields server-side before submitting.
 *
 * Why this approach (vs cloning an existing channel): Mirth's exporter
 * produces XML with subtle field ordering and `version` attribute quirks
 * the importer is strict about. Hand-authoring known-good fragments per
 * template type is more reliable than generic XML manipulation.
 */
import { z } from "zod"

export const CHANNEL_TEMPLATES = ["mllp-passthrough", "http-passthrough", "channel-writer"] as const
export type ChannelTemplateId = (typeof CHANNEL_TEMPLATES)[number]

interface TemplateMeta {
  id: ChannelTemplateId
  title: string
  subtitle: string
  bestFor: string
}

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: "mllp-passthrough",
    title: "MLLP listener → Channel Writer",
    subtitle:
      "Receive HL7v2 over MLLP and dispatch to an internal Mirth channel. The pattern for fan-out and HL7v2 ingest.",
    bestFor: "ADT feeds from EHRs, lab/RIS results, pharmacy dispense messages",
  },
  {
    id: "http-passthrough",
    title: "HTTP listener → log only",
    subtitle:
      "Receive an HTTP POST (JSON, XML, or raw) and write it to the message store. Use as a webhook ingress.",
    bestFor: "Webhooks from Redox/Health Gorilla, FHIR resource notifications, vendor callbacks",
  },
  {
    id: "channel-writer",
    title: "Channel Writer (internal route)",
    subtitle:
      "A Channel Reader source paired with a Channel Writer dispatch. Used as a glue channel that joins two pipelines.",
    bestFor: "Splitting / merging pipelines, multi-tenant routing, retry buffers",
  },
]

// Inputs the UI collects per template. All templates share name + description.
export const TemplateInputSchema = z
  .object({
    template: z.enum(CHANNEL_TEMPLATES),
    name: z.string().min(1).max(120),
    description: z.string().max(2000).default(""),
    // MLLP / HTTP listeners need a port
    port: z.coerce.number().int().min(1).max(65535).optional(),
    // HTTP listener also needs a path
    contextPath: z
      .string()
      .regex(/^\/[a-zA-Z0-9/_\-]*$/, "Must start with / and contain only URL-safe chars")
      .max(200)
      .optional(),
    // Optional: dispatch target channel (Channel Writer destination)
    targetChannelId: z.string().uuid().optional(),
  })
  .refine(
    (v) => (v.template === "mllp-passthrough" ? typeof v.port === "number" : true),
    { message: "Port is required for MLLP listener", path: ["port"] }
  )
  .refine(
    (v) =>
      v.template === "http-passthrough"
        ? typeof v.port === "number" && typeof v.contextPath === "string"
        : true,
    { message: "Port and path are required for HTTP listener", path: ["port"] }
  )

export type TemplateInput = z.infer<typeof TemplateInputSchema>

// ── XML rendering ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function dataTypeBlock(direction: "inbound" | "outbound", type: "HL7V2" | "RAW"): string {
  if (type === "RAW") {
    return `<${direction}DataType>RAW</${direction}DataType>
      <${direction}Properties class="com.mirth.connect.plugins.datatypes.raw.RawDataTypeProperties" version="4.5.2"/>`
  }
  // Full HL7v2 data type properties — includes batch + response generation +
  // response validation blocks. Mirth's deploy validator silently rejects
  // channels whose HL7v2 dataType is missing these sibling blocks.
  return `<${direction}DataType>HL7V2</${direction}DataType>
      <${direction}Properties class="com.mirth.connect.plugins.datatypes.hl7v2.HL7v2DataTypeProperties" version="4.5.2">
        <serializationProperties class="com.mirth.connect.plugins.datatypes.hl7v2.HL7v2SerializationProperties" version="4.5.2">
          <handleRepetitions>true</handleRepetitions>
          <handleSubcomponents>true</handleSubcomponents>
          <useStrictParser>false</useStrictParser>
          <useStrictValidation>false</useStrictValidation>
          <stripNamespaces>false</stripNamespaces>
          <segmentDelimiter>\\r</segmentDelimiter>
          <convertLineBreaks>true</convertLineBreaks>
        </serializationProperties>
        <deserializationProperties class="com.mirth.connect.plugins.datatypes.hl7v2.HL7v2DeserializationProperties" version="4.5.2">
          <useStrictParser>false</useStrictParser>
          <useStrictValidation>false</useStrictValidation>
          <segmentDelimiter>\\r</segmentDelimiter>
        </deserializationProperties>
        <batchProperties class="com.mirth.connect.plugins.datatypes.hl7v2.HL7v2BatchProperties" version="4.5.2">
          <splitType>MSH_Segment</splitType>
          <batchScript></batchScript>
        </batchProperties>
        <responseGenerationProperties class="com.mirth.connect.plugins.datatypes.hl7v2.HL7v2ResponseGenerationProperties" version="4.5.2">
          <segmentDelimiter>\\r</segmentDelimiter>
          <successfulACKCode>AA</successfulACKCode>
          <successfulACKMessage></successfulACKMessage>
          <errorACKCode>AE</errorACKCode>
          <errorACKMessage>An Error Occurred Processing Message.</errorACKMessage>
          <rejectedACKCode>AR</rejectedACKCode>
          <rejectedACKMessage>Message Rejected.</rejectedACKMessage>
          <msh15ACKAccept>false</msh15ACKAccept>
          <dateFormat>yyyyMMddHHmmss.SSS</dateFormat>
        </responseGenerationProperties>
        <responseValidationProperties class="com.mirth.connect.plugins.datatypes.hl7v2.HL7v2ResponseValidationProperties" version="4.5.2">
          <successfulACKCode>AA,CA</successfulACKCode>
          <errorACKCode>AE,CE</errorACKCode>
          <rejectedACKCode>AR,CR</rejectedACKCode>
          <validateMessageControlId>true</validateMessageControlId>
          <originalMessageControlId>Destination_Encoded</originalMessageControlId>
          <originalIdMapVariable></originalIdMapVariable>
        </responseValidationProperties>
      </${direction}Properties>`
}

function commonChannelProperties(): string {
  return `<properties version="4.5.2">
    <clearGlobalChannelMap>true</clearGlobalChannelMap>
    <messageStorageMode>DEVELOPMENT</messageStorageMode>
    <encryptData>false</encryptData>
    <encryptAttachments>false</encryptAttachments>
    <encryptCustomMetaData>false</encryptCustomMetaData>
    <removeContentOnCompletion>false</removeContentOnCompletion>
    <removeOnlyFilteredOnCompletion>false</removeOnlyFilteredOnCompletion>
    <removeAttachmentsOnCompletion>false</removeAttachmentsOnCompletion>
    <initialState>STARTED</initialState>
    <storeAttachments>true</storeAttachments>
    <metaDataColumns>
      <metaDataColumn>
        <name>SOURCE</name>
        <type>STRING</type>
        <mappingName>mirth_source</mappingName>
      </metaDataColumn>
      <metaDataColumn>
        <name>TYPE</name>
        <type>STRING</type>
        <mappingName>mirth_type</mappingName>
      </metaDataColumn>
    </metaDataColumns>
    <attachmentProperties version="4.5.2">
      <type>None</type>
      <properties/>
    </attachmentProperties>
    <resourceIds class="linked-hash-map">
      <entry><string>Default Resource</string><string>[Default Resource]</string></entry>
    </resourceIds>
  </properties>`
}

function mllpSourceConnector(port: number, dataType: "HL7V2" | "RAW"): string {
  // Mirth's TcpReceiverProperties has more required fields than the
  // official documentation suggests; missing any of them causes the
  // channel to be silently rejected by the deploy validator. The set
  // below was extracted from a known-deploying Mirth 4.5.2 channel
  // export and is the minimum that round-trips through XStream.
  return `<sourceConnector version="4.5.2">
    <metaDataId>0</metaDataId>
    <name>sourceConnector</name>
    <properties class="com.mirth.connect.connectors.tcp.TcpReceiverProperties" version="4.5.2">
      <pluginProperties/>
      <listenerConnectorProperties version="4.5.2">
        <host>0.0.0.0</host>
        <port>${port}</port>
      </listenerConnectorProperties>
      <sourceConnectorProperties version="4.5.2">
        <responseVariable>Auto-generate (After source transformer)</responseVariable>
        <respondAfterProcessing>true</respondAfterProcessing>
        <processBatch>false</processBatch>
        <firstResponse>true</firstResponse>
        <processingThreads>1</processingThreads>
        <resourceIds class="linked-hash-map">
          <entry><string>Default Resource</string><string>[Default Resource]</string></entry>
        </resourceIds>
        <queueBufferSize>1000</queueBufferSize>
      </sourceConnectorProperties>
      <transmissionModeProperties class="com.mirth.connect.plugins.mllpmode.MLLPModeProperties">
        <pluginPointName>MLLP</pluginPointName>
        <startOfMessageBytes>0B</startOfMessageBytes>
        <endOfMessageBytes>1C0D</endOfMessageBytes>
        <useMLLPv2>false</useMLLPv2>
        <ackBytes>06</ackBytes>
        <nackBytes>15</nackBytes>
        <maxRetries>2</maxRetries>
      </transmissionModeProperties>
      <serverMode>true</serverMode>
      <remoteAddress></remoteAddress>
      <remotePort></remotePort>
      <overrideLocalBinding>false</overrideLocalBinding>
      <reconnectInterval>5000</reconnectInterval>
      <receiveTimeout>0</receiveTimeout>
      <bufferSize>65536</bufferSize>
      <maxConnections>10</maxConnections>
      <keepConnectionOpen>true</keepConnectionOpen>
      <dataTypeBinary>false</dataTypeBinary>
      <charsetEncoding>DEFAULT_ENCODING</charsetEncoding>
      <respondOnNewConnection>0</respondOnNewConnection>
      <responseAddress></responseAddress>
      <responsePort></responsePort>
    </properties>
    <transformer version="4.5.2">
      <elements/>
      ${dataTypeBlock("inbound", dataType)}
      ${dataTypeBlock("outbound", dataType)}
    </transformer>
    <filter version="4.5.2"><elements/></filter>
    <transportName>TCP Listener</transportName>
    <mode>SOURCE</mode>
    <enabled>true</enabled>
    <waitForPrevious>true</waitForPrevious>
  </sourceConnector>`
}

function httpSourceConnector(port: number, contextPath: string): string {
  return `<sourceConnector version="4.5.2">
    <metaDataId>0</metaDataId>
    <name>sourceConnector</name>
    <properties class="com.mirth.connect.connectors.http.HttpReceiverProperties" version="4.5.2">
      <pluginProperties/>
      <listenerConnectorProperties version="4.5.2">
        <host>0.0.0.0</host>
        <port>${port}</port>
      </listenerConnectorProperties>
      <sourceConnectorProperties version="4.5.2">
        <responseVariable>None</responseVariable>
        <respondAfterProcessing>true</respondAfterProcessing>
        <processBatch>false</processBatch>
        <firstResponse>true</firstResponse>
        <processingThreads>1</processingThreads>
        <queueBufferSize>1000</queueBufferSize>
      </sourceConnectorProperties>
      <contextPath>${esc(contextPath)}</contextPath>
      <timeout>30000</timeout>
      <bodyOnly>true</bodyOnly>
      <parseMultipart>true</parseMultipart>
      <includeMetadata>false</includeMetadata>
      <binaryMimeTypes>application/.*(?&lt;!json|xml)$|image/.*|video/.*|audio/.*</binaryMimeTypes>
      <binaryMimeTypesRegex>true</binaryMimeTypesRegex>
      <responseContentType>text/plain</responseContentType>
      <responseDataTypeBinary>false</responseDataTypeBinary>
      <responseStatusCode/>
      <responseHeaders class="linked-hash-map"/>
      <charset>UTF-8</charset>
    </properties>
    <transformer version="4.5.2">
      <elements/>
      ${dataTypeBlock("inbound", "RAW")}
      ${dataTypeBlock("outbound", "RAW")}
    </transformer>
    <filter version="4.5.2"><elements/></filter>
    <transportName>HTTP Listener</transportName>
    <mode>SOURCE</mode>
    <enabled>true</enabled>
    <waitForPrevious>true</waitForPrevious>
  </sourceConnector>`
}

function channelReaderSourceConnector(): string {
  return `<sourceConnector version="4.5.2">
    <metaDataId>0</metaDataId>
    <name>sourceConnector</name>
    <properties class="com.mirth.connect.connectors.vm.VmReceiverProperties" version="4.5.2">
      <pluginProperties/>
      <sourceConnectorProperties version="4.5.2">
        <responseVariable>None</responseVariable>
        <respondAfterProcessing>true</respondAfterProcessing>
        <processBatch>false</processBatch>
        <firstResponse>true</firstResponse>
        <processingThreads>1</processingThreads>
        <queueBufferSize>1000</queueBufferSize>
      </sourceConnectorProperties>
    </properties>
    <transformer version="4.5.2">
      <elements/>
      ${dataTypeBlock("inbound", "RAW")}
      ${dataTypeBlock("outbound", "RAW")}
    </transformer>
    <filter version="4.5.2"><elements/></filter>
    <transportName>Channel Reader</transportName>
    <mode>SOURCE</mode>
    <enabled>true</enabled>
    <waitForPrevious>true</waitForPrevious>
  </sourceConnector>`
}

function channelWriterDestination(targetChannelId: string): string {
  // Destinations REQUIRE a <responseTransformer> block; Mirth's Donkey
  // engine NPEs at deploy time if it's missing (DEPLOY validator returns
  // 204 but actual deploy fails with a non-public exception, surfaced
  // only via ?returnErrors=true).
  return `<connector version="4.5.2">
        <metaDataId>1</metaDataId>
        <name>Forward to channel</name>
        <properties class="com.mirth.connect.connectors.vm.VmDispatcherProperties" version="4.5.2">
          <pluginProperties/>
          <destinationConnectorProperties version="4.5.2">
            <queueEnabled>true</queueEnabled>
            <sendFirst>false</sendFirst>
            <retryIntervalMillis>10000</retryIntervalMillis>
            <regenerateTemplate>false</regenerateTemplate>
            <retryCount>0</retryCount>
            <rotate>false</rotate>
            <includeFilterTransformer>false</includeFilterTransformer>
            <threadCount>1</threadCount>
            <threadAssignmentVariable></threadAssignmentVariable>
            <validateResponse>false</validateResponse>
            <resourceIds class="linked-hash-map">
              <entry><string>Default Resource</string><string>[Default Resource]</string></entry>
            </resourceIds>
            <queueBufferSize>1000</queueBufferSize>
            <reattachAttachments>true</reattachAttachments>
          </destinationConnectorProperties>
          <channelId>${esc(targetChannelId)}</channelId>
          <channelTemplate>\${message.encodedData}</channelTemplate>
          <mapVariables/>
        </properties>
        <transformer version="4.5.2">
          <elements/>
          ${dataTypeBlock("inbound", "RAW")}
          ${dataTypeBlock("outbound", "RAW")}
        </transformer>
        <responseTransformer version="4.5.2">
          <elements/>
          ${dataTypeBlock("inbound", "RAW")}
          ${dataTypeBlock("outbound", "RAW")}
        </responseTransformer>
        <filter version="4.5.2"><elements/></filter>
        <transportName>Channel Writer</transportName>
        <mode>DESTINATION</mode>
        <enabled>true</enabled>
        <waitForPrevious>false</waitForPrevious>
      </connector>`
}

function emptyDestinations(): string {
  // A no-op channel still needs at least one destination for Mirth to deploy.
  // We use a Channel Writer with channelId=none — messages flow through and stop.
  return channelWriterDestination("none")
}

export function buildChannelXml(input: TemplateInput, channelId: string): string {
  const { name, description } = input
  let source: string
  let destinations: string
  switch (input.template) {
    case "mllp-passthrough":
      source = mllpSourceConnector(input.port!, "HL7V2")
      destinations = input.targetChannelId
        ? channelWriterDestination(input.targetChannelId)
        : emptyDestinations()
      break
    case "http-passthrough":
      source = httpSourceConnector(input.port!, input.contextPath!)
      destinations = emptyDestinations()
      break
    case "channel-writer":
      source = channelReaderSourceConnector()
      destinations = input.targetChannelId
        ? channelWriterDestination(input.targetChannelId)
        : emptyDestinations()
      break
  }
  return `<channel version="4.5.2">
  <id>${channelId}</id>
  <nextMetaDataId>2</nextMetaDataId>
  <name>${esc(name)}</name>
  <description>${esc(description)}</description>
  <revision>1</revision>
  ${source}
  <destinationConnectors>
${destinations}
  </destinationConnectors>
  <preprocessingScript>return message;</preprocessingScript>
  <postprocessingScript>return;</postprocessingScript>
  <deployScript>return;</deployScript>
  <undeployScript>return;</undeployScript>
  ${commonChannelProperties()}
</channel>`
}
