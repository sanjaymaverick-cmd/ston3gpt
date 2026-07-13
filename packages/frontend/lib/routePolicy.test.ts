import test from "node:test";
import assert from "node:assert/strict";
// Node's built-in type-stripping test runner requires the explicit extension.
// @ts-ignore -- production TS imports remain extensionless; this file runs directly in Node.
import { canAccessRoute } from "./routePolicy.ts";

test("operator is limited to production workflows", () => {
  assert.equal(canAccessRoute("operator", "/dashboard"), true);
  assert.equal(canAccessRoute("operator", "/dpr"), true);
  assert.equal(canAccessRoute("operator", "/polishing"), true);
  assert.equal(canAccessRoute("operator", "/sales"), false);
  assert.equal(canAccessRoute("operator", "/admin/users"), false);
});

test("supervisor can operate but cannot administer", () => {
  assert.equal(canAccessRoute("supervisor", "/receipts/raw-blocks"), true);
  assert.equal(canAccessRoute("supervisor", "/inventory"), true);
  assert.equal(canAccessRoute("supervisor", "/sales"), true);
  assert.equal(canAccessRoute("supervisor", "/setup/opening-inventory"), false);
  assert.equal(canAccessRoute("supervisor", "/admin/users"), false);
});

test("manager and owner can access administration", () => {
  for (const role of ["manager", "owner"]) {
    assert.equal(canAccessRoute(role, "/setup/opening-inventory"), true);
    assert.equal(canAccessRoute(role, "/admin/users"), true);
    assert.equal(canAccessRoute(role, "/admin/historical-sales"), true);
  }
});

test("signed-in users can reach the root dashboard redirect", () => {
  for (const role of ["operator", "supervisor", "manager", "owner"]) {
    assert.equal(canAccessRoute(role, "/"), true);
  }
});

test("missing and unknown roles fail closed", () => {
  assert.equal(canAccessRoute(undefined, "/dashboard"), false);
  assert.equal(canAccessRoute("unknown", "/dashboard"), false);
  assert.equal(canAccessRoute("owner", "/not-a-route"), false);
});
