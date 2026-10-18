import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseStaffApplication, parseStaffDetails } from "../src/lib/staff-application";

const NOW = new Date("2026-10-10T12:00:00Z");

const VALID = {
  fullName: "Priya Raman",
  email: "  Priya.Raman@Example.com ",
  phone: "+44 20 7946 0958",
  dateOfBirth: "1994-06-02",
  address: "22 Mount Street, London W1K 2RP",
  region: " London ",
  password: "Concierge#2026",
  primaryType: "Passport",
  secondaryType: "PAN Card",
};

describe("staff application", () => {
  test("accepts a complete application and normalises email and region", () => {
    const result = parseStaffApplication(VALID, NOW);
    assert.ok(result.ok);
    assert.equal(result.value.email, "priya.raman@example.com");
    assert.equal(result.value.region, "London");
    assert.equal(result.value.dateOfBirth.toISOString().slice(0, 10), "1994-06-02");
  });

  test("details step does not need password or documents", () => {
    const { fullName, email, phone, dateOfBirth, address, region } = VALID;
    assert.ok(parseStaffDetails({ fullName, email, phone, dateOfBirth, address, region }, NOW).ok);
  });

  test("speaks to staff, not members, about the minimum age", () => {
    const result = parseStaffApplication({ ...VALID, dateOfBirth: "2012-01-01" }, NOW);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : "", /^Staff must be at least 18/);
  });

  test("rejects bad email, missing region and short password", () => {
    assert.equal(parseStaffApplication({ ...VALID, email: "nope" }, NOW).ok, false);
    assert.equal(parseStaffApplication({ ...VALID, region: "" }, NOW).ok, false);
    assert.equal(parseStaffApplication({ ...VALID, password: "short" }, NOW).ok, false);
  });

  test("first document must be a photo ID and the second a different type", () => {
    const notPhoto = parseStaffApplication({ ...VALID, primaryType: "PAN Card", secondaryType: "Passport" }, NOW);
    assert.equal(notPhoto.ok, false);
    const same = parseStaffApplication({ ...VALID, secondaryType: "Passport" }, NOW);
    assert.equal(same.ok, false);
    assert.equal(parseStaffApplication({ ...VALID, secondaryType: "Library card" }, NOW).ok, false);
  });
});
