import { getEnv } from "@/lib/env"

export default function CatalogPage() {
  const env = getEnv()
  if (!env.CATALOG_URL) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink-900">Interface Catalog</h1>
        <div className="rounded border border-ink-200 bg-white p-6 text-sm text-ink-600">
          The interface catalog isn&apos;t configured. Set <code>CATALOG_URL</code> in your env
          to the published location of the{" "}
          <a
            href="https://github.com/Nirmitee-tech/mirth-connect-cookbook/tree/main/scripts/operations/interface-catalog-generator"
            className="text-brand-500 underline underline-offset-4"
            rel="noreferrer"
            target="_blank"
          >
            interface-catalog-generator
          </a>
          &nbsp;output (GitHub Pages, S3, or any nginx host).
        </div>
      </div>
    )
  }
  return (
    <div className="-mt-8 -mx-6 h-[calc(100vh-8rem)]">
      <iframe
        src={env.CATALOG_URL}
        className="w-full h-full border-0"
        title="Interface Catalog"
      />
    </div>
  )
}
