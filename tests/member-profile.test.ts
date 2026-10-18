import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  formatBirthDate,
  isoDate,
  parseAddress,
  parseDateOfBirth,
  parseFullName,
  parseMemberProfile,
  parsePhone,
} from "../src/lib/member-profile";

const NOW = new Date("2026-10-10T12:00:00Z");

const VALID = {
  fullName: "  Éloïse   O'Brien-Dvořák ",
  phone: "+91 98765 43210",
  dateOfBirth: "1990-03-12",
  address: "14 Rue de Rivoli\n75004 Paris",
};

describe("signup identity details", () => {
  test("a complete profile is cleaned and kept in the member's own spelling", () => {
    const result = parseMemberProfile(VALID, NOW);
    assert.ok(result.ok, result.ok ? "" : result.error);
    assert.equal(result.value.fullName, "Éloïse O'Brien-Dvořák");
    assert.equal(result.value.phone, "+91 98765 43210");
    assert.equal(result.value.dateOfBirth.toISOString(), "1990-03-12T00:00:00.000Z");
    assert.equal(result.value.address, "14 Rue de Rivoli, 75004 Paris");
  });

  test("every field is required at signup", () => {
    for (const key of Object.keys(VALID) as (keyof typeof VALID)[]) {
      const result = parseMemberProfile({ ...VALID, [key]: "" }, NOW);
      assert.equal(result.ok, false, key);
    }
  });

  test("names must look like a name", () => {
    assert.equal(parseFullName("A").ok, false);
    assert.equal(parseFullName("john123").ok, false);
    assert.equal(parseFullName("<script>").ok, false);
    assert.ok(parseFullName("Ætheling Søren").ok);
  });

  test("mobile numbers need 7 to 15 digits", () => {
    assert.ok(parsePhone("+44 20 7946 0184").ok);
    assert.ok(parsePhone("(020) 7946-0184").ok);
    assert.equal(parsePhone("12345").ok, false);
    assert.equal(parsePhone("+1 234 567 890 123 456").ok, false);
    assert.equal(parsePhone("call me").ok, false);
  });

  test("date of birth must be a real calendar date and the member at least 18", () => {
    assert.equal(parseDateOfBirth("1990-02-30", NOW).ok, false);
    assert.equal(parseDateOfBirth("12/03/1990", NOW).ok, false);
    assert.equal(parseDateOfBirth("2008-10-11", NOW).ok, false, "one day short of 18");
    assert.ok(parseDateOfBirth("2008-10-10", NOW).ok, "18th birthday");
    assert.equal(parseDateOfBirth("1890-01-01", NOW).ok, false);
  });

  test("addresses reject control and bidi characters", () => {
    assert.equal(parseAddress("Flat 2 \u202Eevil").ok, false);
    assert.equal(parseAddress("abc").ok, false);
  });

  test("birth dates display the same day in every time zone", () => {
    assert.equal(isoDate("1990-03-12T00:00:00.000Z"), "1990-03-12");
    assert.equal(formatBirthDate("1990-03-12T00:00:00.000Z"), "12 Mar 1990");
  });
});
