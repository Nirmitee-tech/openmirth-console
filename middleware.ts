import { NextResponse, type NextRequest } from "next/server"

/**
 * Edge middleware — runs on every request before any route handler.
 *
 * Responsibilities:
 *   1. Assign / propagate X-Request-ID for tracing
 *   2. Apply strict security headers (CSP, HSTS, X-Frame-Options, etc.)
 *   3. Redirect un-authenticated users away from app routes
 *      (the actual auth check happens in route handlers; this is a
 *       cheap edge-side short-circuit for the common case)
 */

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/healthz",
  "/api/readyz",
  "/api/metrics",
])

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith("/_next/")) return true
  if (pathname.startsWith("/favicon")) return true
  if (pathname === "/manifest.json" || pathname === "/robots.txt") return true
  return false
}

function generateId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function middleware(req: NextRequest): NextResponse {
  const requestId = req.headers.get("x-request-id") ?? generateId()

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-request-id", requestId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Correlation
  response.headers.set("x-request-id", requestId)

  // Security headers — defaults for an enterprise app
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Next inline runtime requires unsafe-inline
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'self'", // permit embedded Grafana / catalog iframes
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  )

  // Cheap edge-side auth gate for app pages.
  // Real authorization still happens in route handlers / RSC code.
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "openmirth_session"
  const hasCookie = Boolean(req.cookies.get(cookieName))

  if (!isPublic(req.nextUrl.pathname) && !hasCookie && !req.nextUrl.pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // Run on everything except Next internals + static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
}
