import assert from "node:assert/strict";
import test from "node:test";
import { safeNext } from "../netlify/edge-functions/github-auth.js";

const origin = "https://localform.example";
test("OAuth return path stays on the same origin", () => {
  assert.equal(safeNext("/project?p=1", origin), "/project?p=1");
  for (const value of [
    "https://attacker.example",
    "//attacker.example",
    "/\\\\attacker.example",
    "/__auth/login",
    "/__auth/callback?x=1",
    "/__auth/logout",
    "javascript:alert(1)",
    "/home\nLocation: https://attacker.example",
  ]) {
    assert.equal(safeNext(value, origin), "/", `unsafe redirect ${JSON.stringify(value)}`);
  }
});
