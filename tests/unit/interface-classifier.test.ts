import { describe, expect, it } from "vitest"
import { classify } from "@/lib/interface-classifier"

describe("classify", () => {
  it.each([
    ["HL7v2 ADT to FHIR Bundle", "ADT"],
    ["Patient Reg Listener", "ADT"],
    ["Lab Results (ORU) Listener", "Results"],
    ["Orders (ORM) Listener", "Orders"],
    ["Pharmacy (RDS) Listener", "Pharmacy"],
    ["Claims (837) Listener", "Claims"],
    ["Scheduling SIU", "Scheduling"],
    ["MDM Documents", "Documents"],
    ["VXU Immunizations", "Immunization"],
    ["Kafka Producer", "Data Lake"],
    ["openEHR Composition", "Clinical Repo"],
    ["FHIR pipeline", "FHIR Pipeline"],
    ["Smart Router", "Routing"],
    ["totally unrelated channel name", "Other"],
  ])("%s → %s", (name, expectedType) => {
    expect(classify(name).type).toBe(expectedType)
  })

  it("returns a non-empty impact string per type", () => {
    expect(classify("ADT feed").impact.length).toBeGreaterThan(0)
    expect(classify("uncategorized junk").impact).toBe("Uncategorized")
  })
})
