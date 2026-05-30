/**
 * Classify a channel name into a clinical interface type.
 *
 * Mirrors the rules used by the hospital-operations-dashboard cookbook
 * recipe so both surfaces agree on terminology. Update both when the
 * naming convention evolves.
 */
export const INTERFACE_TYPES = [
  "ADT",
  "Orders",
  "Results",
  "Pharmacy",
  "Claims",
  "Scheduling",
  "Documents",
  "Immunization",
  "Data Lake",
  "Clinical Repo",
  "FHIR Pipeline",
  "Routing",
  "Other",
] as const

export type InterfaceType = (typeof INTERFACE_TYPES)[number]

interface Rule {
  pattern: RegExp
  type: InterfaceType
  impact: string
}

const RULES: Rule[] = [
  { pattern: /\b(ADT|admission|discharge|transfer|patient[_ ]?reg)/i, type: "ADT",          impact: "Bed mgmt, registration, census" },
  { pattern: /\bORM\b|order[_ ]?entry|servicerequest/i,               type: "Orders",       impact: "Lab/Rad/Pharmacy orders flow" },
  { pattern: /\bORU\b|result|diagnosticreport|lab\b/i,                type: "Results",      impact: "Lab/Rad results to chart" },
  { pattern: /\bRDS\b|\bRDE\b|pharmacy|medication/i,                  type: "Pharmacy",     impact: "Medication safety, MAR" },
  { pattern: /\b837\b|\b835\b|\b270\b|\b271\b|\b278\b|claim|billing|charge/i, type: "Claims", impact: "Revenue cycle, AR" },
  { pattern: /\bSIU\b|schedul|appointment/i,                          type: "Scheduling",   impact: "OR/clinic scheduling" },
  { pattern: /\bMDM\b|document|note|transcrip/i,                      type: "Documents",    impact: "Clinical documentation" },
  { pattern: /\bVXU\b|immun|vaccin/i,                                 type: "Immunization", impact: "Vaccination registry" },
  { pattern: /kafka/i,                                                type: "Data Lake",    impact: "Analytics, ML feature store" },
  { pattern: /openehr|composition|CDR/i,                              type: "Clinical Repo", impact: "Longitudinal record (openEHR)" },
  { pattern: /fhir/i,                                                  type: "FHIR Pipeline", impact: "Downstream FHIR consumers" },
  { pattern: /router|smart/i,                                          type: "Routing",      impact: "Cross-system message routing" },
]

export function classify(name: string): { type: InterfaceType; impact: string } {
  for (const r of RULES) {
    if (r.pattern.test(name)) return { type: r.type, impact: r.impact }
  }
  return { type: "Other", impact: "Uncategorized" }
}

export const INTERFACE_BADGE_CLASS: Record<InterfaceType, string> = {
  ADT:             "bg-blue-100 text-blue-800",
  Orders:          "bg-orange-100 text-orange-800",
  Results:         "bg-purple-100 text-purple-800",
  Pharmacy:        "bg-emerald-100 text-emerald-800",
  Claims:          "bg-pink-100 text-pink-800",
  Scheduling:      "bg-lime-100 text-lime-800",
  Documents:       "bg-indigo-100 text-indigo-800",
  Immunization:    "bg-cyan-100 text-cyan-800",
  "Data Lake":     "bg-yellow-100 text-yellow-800",
  "Clinical Repo": "bg-rose-100 text-rose-800",
  "FHIR Pipeline": "bg-indigo-100 text-indigo-800",
  Routing:         "bg-violet-100 text-violet-800",
  Other:           "bg-ink-100 text-ink-700",
}
