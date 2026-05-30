import Link from "next/link"

export default function AboutPage() {
  return (
    <div className="prose prose-ink max-w-3xl">
      <h1 className="text-2xl font-semibold text-ink-900 mb-6">About OpenMirth Console</h1>

      <p className="text-ink-800 leading-relaxed">
        OpenMirth Console is an open-source operations layer for{" "}
        <a
          href="https://github.com/nextgenhealthcare/connect"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-500 underline underline-offset-4"
        >
          Mirth Connect
        </a>{" "}
        and the{" "}
        <a
          href="https://openintegrationengine.org"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-500 underline underline-offset-4"
        >
          Open Integration Engine
        </a>{" "}
        community fork. It modernizes a 13-year-old Java admin client into a browser-native console
        that healthcare integration teams can actually live in.
      </p>

      <h2 className="text-lg font-semibold text-ink-900 mt-8 mb-2">Why we built it</h2>
      <p className="text-ink-800 leading-relaxed">
        Mirth Connect runs healthcare interoperability for thousands of hospitals worldwide, but
        its Java Administrator is universally hated. When NextGen Healthcare made versions 4.6 and
        later commercial in 2025, the open-source community fractured into OIE and BridgeLink
        forks. None of them had a modern, vendor-neutral tooling layer.
      </p>
      <p className="text-ink-800 leading-relaxed">
        We built OpenMirth Console to be that layer — open source, multi-engine, and built around
        clinical-workflow observability rather than generic infra metrics.
      </p>

      <h2 className="text-lg font-semibold text-ink-900 mt-8 mb-2">Who maintains it</h2>
      <p className="text-ink-800 leading-relaxed">
        OpenMirth Console is built and maintained by{" "}
        <Link
          href="https://nirmitee.io?utm_source=openmirth-console&utm_medium=about-body"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-500 underline underline-offset-4 font-medium"
        >
          Nirmitee.io
        </Link>
        , a healthcare IT consultancy specializing in Mirth Connect, FHIR, HL7v2, and clinical
        data interoperability. We also publish the open-source{" "}
        <a
          href="https://github.com/Nirmitee-tech/mirth-connect-cookbook"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-500 underline underline-offset-4"
        >
          Mirth Connect Cookbook
        </a>
        , a collection of 50+ production-grade recipes for HL7v2 transformers, FHIR pipelines,
        observability stacks, and channel patterns.
      </p>

      <h2 className="text-lg font-semibold text-ink-900 mt-8 mb-2">Get help</h2>
      <p className="text-ink-800 leading-relaxed">
        For bugs and feature requests, open a{" "}
        <a
          href="https://github.com/Nirmitee-tech/openmirth-console/issues"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-500 underline underline-offset-4"
        >
          GitHub issue
        </a>
        . For commercial support, custom integration work, or migration consulting from
        Cloverleaf/Rhapsody to Mirth/OIE, reach the Nirmitee team at{" "}
        <Link
          href="https://nirmitee.io/get-in-touch?utm_source=openmirth-console&utm_medium=about-support"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-500 underline underline-offset-4"
        >
          nirmitee.io/get-in-touch
        </Link>
        .
      </p>

      <h2 className="text-lg font-semibold text-ink-900 mt-8 mb-2">License</h2>
      <p className="text-ink-800 leading-relaxed">
        OpenMirth Console is released under the{" "}
        <a
          href="https://github.com/Nirmitee-tech/openmirth-console/blob/main/LICENSE"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-500 underline underline-offset-4"
        >
          Apache License 2.0
        </a>
        . Use it commercially, modify it, host it. Just don&apos;t remove the attribution.
      </p>
    </div>
  )
}
