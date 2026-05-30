import { describe, expect, it } from "vitest"
import { getChannelScripts, patchChannelScripts } from "@/lib/mirth/scripts"

const SAMPLE = `<channel version="4.5.2">
  <id>11111111-1111-4111-8111-111111111111</id>
  <nextMetaDataId>2</nextMetaDataId>
  <name>Test Channel</name>
  <description>x</description>
  <revision>1</revision>
  <sourceConnector version="4.5.2">
    <metaDataId>0</metaDataId>
    <name>sourceConnector</name>
    <properties class="x"/>
    <transformer version="4.5.2">
      <elements>
        <com.mirth.connect.plugins.javascriptstep.JavaScriptStep version="4.5.2">
          <name>Parse PID</name>
          <sequenceNumber>0</sequenceNumber>
          <enabled>true</enabled>
          <script>var mrn = msg[&apos;PID&apos;][&apos;PID.3&apos;][&apos;PID.3.1&apos;].toString();
channelMap.put(&apos;mrn&apos;, mrn);
return message;</script>
        </com.mirth.connect.plugins.javascriptstep.JavaScriptStep>
        <com.mirth.connect.plugins.javascriptstep.JavaScriptStep version="4.5.2">
          <name>Map facility</name>
          <sequenceNumber>1</sequenceNumber>
          <enabled>false</enabled>
          <script>// disabled for now
return message;</script>
        </com.mirth.connect.plugins.javascriptstep.JavaScriptStep>
      </elements>
    </transformer>
    <filter version="4.5.2">
      <elements>
        <com.mirth.connect.plugins.javascriptrule.JavaScriptRule version="4.5.2">
          <name>Reject test patients</name>
          <sequenceNumber>0</sequenceNumber>
          <enabled>true</enabled>
          <script>return !msg[&apos;PID&apos;][&apos;PID.3&apos;][&apos;PID.3.1&apos;].toString().startsWith(&apos;TEST&apos;);</script>
        </com.mirth.connect.plugins.javascriptrule.JavaScriptRule>
      </elements>
    </filter>
    <transportName>TCP Listener</transportName>
    <mode>SOURCE</mode>
    <enabled>true</enabled>
    <waitForPrevious>true</waitForPrevious>
  </sourceConnector>
  <destinationConnectors>
      <connector version="4.5.2">
        <metaDataId>1</metaDataId>
        <name>Forward to FHIR</name>
        <properties class="y"/>
        <transformer version="4.5.2">
          <elements>
            <com.mirth.connect.plugins.javascriptstep.JavaScriptStep version="4.5.2">
              <name>Build FHIR</name>
              <sequenceNumber>0</sequenceNumber>
              <enabled>true</enabled>
              <script>return JSON.stringify({resourceType:&apos;Patient&apos;});</script>
            </com.mirth.connect.plugins.javascriptstep.JavaScriptStep>
          </elements>
        </transformer>
        <responseTransformer version="4.5.2">
          <elements/>
        </responseTransformer>
        <filter version="4.5.2"><elements/></filter>
        <transportName>HTTP Sender</transportName>
        <mode>DESTINATION</mode>
        <enabled>true</enabled>
        <waitForPrevious>false</waitForPrevious>
      </connector>
    </destinationConnectors>
  <preprocessingScript>return message;</preprocessingScript>
  <postprocessingScript>logger.info(&apos;done&apos;);
return;</postprocessingScript>
  <deployScript>return;</deployScript>
  <undeployScript>return;</undeployScript>
  <properties version="4.5.2"/>
</channel>`

describe("getChannelScripts", () => {
  it("extracts channel-level scripts with entities un-escaped", () => {
    const s = getChannelScripts(SAMPLE)
    expect(s.channelLevel.preprocessing).toBe("return message;")
    expect(s.channelLevel.postprocessing).toBe("logger.info('done');\nreturn;")
    expect(s.channelLevel.deploy).toBe("return;")
    expect(s.channelLevel.undeploy).toBe("return;")
  })

  it("extracts source transformer steps in order with un-escaped scripts", () => {
    const s = getChannelScripts(SAMPLE)
    expect(s.source.transformerSteps).toHaveLength(2)
    expect(s.source.transformerSteps[0].name).toBe("Parse PID")
    expect(s.source.transformerSteps[0].enabled).toBe(true)
    expect(s.source.transformerSteps[0].script).toContain("var mrn = msg['PID']['PID.3']['PID.3.1']")
    expect(s.source.transformerSteps[1].name).toBe("Map facility")
    expect(s.source.transformerSteps[1].enabled).toBe(false)
  })

  it("extracts source filter rules", () => {
    const s = getChannelScripts(SAMPLE)
    expect(s.source.filterRules).toHaveLength(1)
    expect(s.source.filterRules[0].name).toBe("Reject test patients")
    expect(s.source.filterRules[0].script).toContain("startsWith('TEST')")
  })

  it("extracts destination transformers", () => {
    const s = getChannelScripts(SAMPLE)
    expect(s.destinations).toHaveLength(1)
    expect(s.destinations[0].metaDataId).toBe(1)
    expect(s.destinations[0].name).toBe("Forward to FHIR")
    expect(s.destinations[0].transformerSteps).toHaveLength(1)
    expect(s.destinations[0].transformerSteps[0].name).toBe("Build FHIR")
    expect(s.destinations[0].responseTransformerSteps).toHaveLength(0)
    expect(s.destinations[0].filterRules).toHaveLength(0)
  })
})

describe("patchChannelScripts", () => {
  it("replaces a channel-level script and preserves other channel content", () => {
    const out = patchChannelScripts(SAMPLE, {
      channelLevel: { postprocessing: "var x = 1; return;" },
    })
    expect(out).toContain("<postprocessingScript>var x = 1; return;</postprocessingScript>")
    // Other channel-level scripts untouched
    expect(out).toContain("<deployScript>return;</deployScript>")
    // Transformer steps untouched
    expect(out).toContain("Parse PID")
  })

  it("replaces source transformer steps", () => {
    const out = patchChannelScripts(SAMPLE, {
      source: {
        transformerSteps: [
          { name: "New step", enabled: true, sequenceNumber: 0, script: "return message;" },
        ],
      },
    })
    expect(out).toContain("<name>New step</name>")
    expect(out).not.toContain("Parse PID")
    // Destinations untouched
    expect(out).toContain("Build FHIR")
  })

  it("replaces destination transformer steps by metaDataId", () => {
    const out = patchChannelScripts(SAMPLE, {
      destinations: [
        {
          metaDataId: 1,
          transformerSteps: [
            { name: "Replaced", enabled: true, sequenceNumber: 0, script: "return null;" },
          ],
        },
      ],
    })
    expect(out).toContain("<name>Replaced</name>")
    expect(out).not.toContain("Build FHIR")
    // Source untouched
    expect(out).toContain("Parse PID")
  })

  it("clears a steps block when given an empty array", () => {
    const out = patchChannelScripts(SAMPLE, {
      source: { filterRules: [] },
    })
    // The filter block should now contain <elements/>
    expect(out).toMatch(/<filter[^>]*>\s*<elements\s*\/>/)
    // Source transformer untouched
    expect(out).toContain("Parse PID")
  })

  it("escapes JS that contains XML metacharacters when writing back", () => {
    const out = patchChannelScripts(SAMPLE, {
      source: {
        transformerSteps: [
          { name: "x", enabled: true, sequenceNumber: 0, script: "if (a < b && c > 0) {}" },
        ],
      },
    })
    expect(out).toContain("if (a &lt; b &amp;&amp; c &gt; 0)")
    // And NOT the raw form (which would corrupt the XML)
    expect(out).not.toContain("if (a < b && c > 0)")
  })
})
