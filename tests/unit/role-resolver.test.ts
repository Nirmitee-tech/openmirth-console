import { describe, expect, it } from "vitest"
import {
  buildRoleMap,
  isAnyRoleConfigured,
  resolveRoleFromMap,
} from "@/lib/auth/role-resolver"

function map(spec: Partial<{ admin: string; operator: string; viewer: string }>) {
  return buildRoleMap({
    OMCC_ROLE_ADMIN: spec.admin ?? "",
    OMCC_ROLE_OPERATOR: spec.operator ?? "",
    OMCC_ROLE_VIEWER: spec.viewer ?? "",
  } as Parameters<typeof buildRoleMap>[0])
}

describe("resolveRoleFromMap", () => {
  it("denies a user not in any tier (closed-world)", () => {
    const result = resolveRoleFromMap("alice", map({}))
    expect(result.granted).toBe(false)
  })

  it("grants admin tier when in OMCC_ROLE_ADMIN", () => {
    const result = resolveRoleFromMap("alice", map({ admin: "alice,bob" }))
    expect(result).toEqual({ granted: true, role: "admin" })
  })

  it("grants the most-privileged tier when a user is listed in multiple", () => {
    const result = resolveRoleFromMap(
      "alice",
      map({ admin: "alice", operator: "alice", viewer: "alice" })
    )
    expect(result).toEqual({ granted: true, role: "admin" })
  })

  it("treats username comparison as case-insensitive", () => {
    const m = map({ operator: "Alice,BOB" })
    expect(resolveRoleFromMap("ALICE", m).granted).toBe(true)
    expect(resolveRoleFromMap("alice", m).granted).toBe(true)
    expect(resolveRoleFromMap("Bob", m).granted).toBe(true)
  })

  it("supports '*' wildcard to grant a tier to every user", () => {
    const m = map({ admin: "alice", viewer: "*" })
    expect(resolveRoleFromMap("alice", m)).toEqual({ granted: true, role: "admin" })
    expect(resolveRoleFromMap("nobody", m)).toEqual({ granted: true, role: "viewer" })
  })

  it("tolerates whitespace and blank entries in the env var", () => {
    const m = map({ operator: "  alice ,, , bob  " })
    expect(resolveRoleFromMap("alice", m).granted).toBe(true)
    expect(resolveRoleFromMap("bob", m).granted).toBe(true)
    expect(resolveRoleFromMap("charlie", m).granted).toBe(false)
  })

  it("does not match partial substrings", () => {
    const m = map({ admin: "alicea" })
    expect(resolveRoleFromMap("alice", m).granted).toBe(false)
  })

  it("returns a non-empty reason on denial for audit logging", () => {
    const result = resolveRoleFromMap("alice", map({}))
    if (result.granted) throw new Error("expected denied")
    expect(result.reason.length).toBeGreaterThan(0)
  })
})

describe("isAnyRoleConfigured", () => {
  function env(spec: Partial<{ admin: string; operator: string; viewer: string }>) {
    return {
      OMCC_ROLE_ADMIN: spec.admin ?? "",
      OMCC_ROLE_OPERATOR: spec.operator ?? "",
      OMCC_ROLE_VIEWER: spec.viewer ?? "",
    } as Parameters<typeof isAnyRoleConfigured>[0]
  }
  it("false when nothing is set", () => {
    expect(isAnyRoleConfigured(env({}))).toBe(false)
  })
  it("true when admin tier has names", () => {
    expect(isAnyRoleConfigured(env({ admin: "alice" }))).toBe(true)
  })
  it("true when operator tier has names", () => {
    expect(isAnyRoleConfigured(env({ operator: "alice" }))).toBe(true)
  })
  it("true when viewer tier has names", () => {
    expect(isAnyRoleConfigured(env({ viewer: "alice" }))).toBe(true)
  })
  it("true on wildcard in any tier", () => {
    expect(isAnyRoleConfigured(env({ viewer: "*" }))).toBe(true)
    expect(isAnyRoleConfigured(env({ admin: "*" }))).toBe(true)
    expect(isAnyRoleConfigured(env({ operator: "*" }))).toBe(true)
  })
})
