import { describe, expect, it } from "vitest"
import {
  MirthApiError,
  MirthAuthError,
  MirthError,
  MirthSchemaError,
  MirthUnreachableError,
} from "@/lib/mirth/errors"

describe("Mirth error hierarchy", () => {
  it("MirthAuthError extends MirthError", () => {
    const e = new MirthAuthError("nope")
    expect(e).toBeInstanceOf(MirthError)
    expect(e.name).toBe("MirthAuthError")
  })
  it("MirthUnreachableError extends MirthError", () => {
    const e = new MirthUnreachableError("down", new Error("ECONNREFUSED"))
    expect(e).toBeInstanceOf(MirthError)
    expect(e.cause).toBeInstanceOf(Error)
  })
  it("MirthSchemaError carries issues", () => {
    const issues = [{ path: ["x"], message: "bad" }]
    const e = new MirthSchemaError("bad", issues)
    expect(e.issues).toEqual(issues)
  })
  it("MirthApiError carries status + body", () => {
    const e = new MirthApiError("oops", 500, "<html>500</html>")
    expect(e.status).toBe(500)
    expect(e.body).toContain("500")
  })
})
