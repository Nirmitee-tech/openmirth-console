import { describe, expect, it } from "vitest"
import {
  hasMinimumRole,
  isRole,
  permit,
  PERMISSIONS,
  ROLES,
  type Role,
} from "@/lib/auth/roles"

describe("roles", () => {
  describe("isRole", () => {
    it.each(ROLES)("recognises valid role %s", (r) => {
      expect(isRole(r)).toBe(true)
    })
    it.each(["", "root", "Admin", null, undefined, 1, {}])(
      "rejects invalid value %s",
      (v) => {
        expect(isRole(v)).toBe(false)
      }
    )
  })

  describe("hasMinimumRole", () => {
    it("orders viewer < operator < admin", () => {
      expect(hasMinimumRole("viewer", "viewer")).toBe(true)
      expect(hasMinimumRole("viewer", "operator")).toBe(false)
      expect(hasMinimumRole("viewer", "admin")).toBe(false)
      expect(hasMinimumRole("operator", "viewer")).toBe(true)
      expect(hasMinimumRole("operator", "operator")).toBe(true)
      expect(hasMinimumRole("operator", "admin")).toBe(false)
      expect(hasMinimumRole("admin", "viewer")).toBe(true)
      expect(hasMinimumRole("admin", "operator")).toBe(true)
      expect(hasMinimumRole("admin", "admin")).toBe(true)
    })
  })

  describe("permit", () => {
    it("blocks viewer from operator-tier actions", () => {
      expect(permit("viewer", "channel:start")).toBe(false)
      expect(permit("viewer", "channel:stop")).toBe(false)
      expect(permit("viewer", "message:reprocess")).toBe(false)
    })
    it("allows viewer to read system + messages", () => {
      expect(permit("viewer", "system:read")).toBe(true)
      expect(permit("viewer", "message:read")).toBe(true)
    })
    it("blocks operator from admin-tier mutations", () => {
      expect(permit("operator", "channel:create")).toBe(false)
      expect(permit("operator", "channel:delete")).toBe(false)
      expect(permit("operator", "message:purge")).toBe(false)
      expect(permit("operator", "users:manage")).toBe(false)
    })
    it("allows operator to operate channels", () => {
      expect(permit("operator", "channel:start")).toBe(true)
      expect(permit("operator", "channel:stop")).toBe(true)
      expect(permit("operator", "channel:deploy")).toBe(true)
      expect(permit("operator", "message:reprocess")).toBe(true)
    })
    it("admin can do everything", () => {
      for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
        expect(permit("admin" as Role, p)).toBe(true)
      }
    })
  })
})
