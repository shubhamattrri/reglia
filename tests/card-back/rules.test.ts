import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_BACK_LIMITS,
  effectiveCardStatus,
  formatValidThru,
  parseCardBackPatch,
  parseCardLayout,
  parseCardPanelStyle,
  readCardLayout,
} from "../../src/lib/card-back";

const FUTURE = new Date("2030-01-01T00:00:00Z");
const PAST = new Date("2020-01-01T00:00:00Z");
const NOW = new Date("2026-10-08T00:00:00Z");

function ok(body: unknown) {
  const result = parseCardBackPatch(body);
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.patch;
}

function rejects(body: unknown, pattern: RegExp) {
  const result = parseCardBackPatch(body);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, pattern);
}

describe("admin card-back input", () => {
  test("keeps privileges and validity byte-for-byte, including diacritics and combining marks", () => {
    const decomposed = "Re\u0301sidence prive\u0301e"; // e + combining acute, must not be normalised
    const patch = ok({
      cardValidityPeriod: "  EXP 12/28 · Ⅻ ",
      adminServicesPrivileges: ["Côte d'Azur résidence", "Œnothèque — Zürich", decomposed, "  ", "Ærial ∞ transfers"],
    });
    assert.equal(patch.cardValidityPeriod, "EXP 12/28 · Ⅻ");
    assert.deepEqual(patch.adminServicesPrivileges, ["Côte d'Azur résidence", "Œnothèque — Zürich", decomposed, "Ærial ∞ transfers"]);
    assert.equal(patch.adminServicesPrivileges?.[2].length, decomposed.length);
  });

  test("empty values reset a field to the membership-derived default", () => {
    assert.deepEqual(ok({ cardValidityPeriod: "", cardStatus: "", qrCodePayload: "", adminServicesPrivileges: null }), {
      cardValidityPeriod: null,
      cardStatus: null,
      qrCodePayload: null,
      adminServicesPrivileges: null,
    });
  });

  test("parses the valid-through date as a UTC calendar day", () => {
    assert.equal(ok({ validThru: "2028-12-31" }).validThru?.toISOString(), "2028-12-31T00:00:00.000Z");
    rejects({ validThru: "soon" }, /not a date/);
  });

  test("rejects unknown statuses, non-http QR payloads and oversize input", () => {
    rejects({ cardStatus: "REVOKED" }, /ACTIVE, INACTIVE, SUSPENDED, EXPIRED/);
    rejects({ qrCodePayload: "javascript:alert(1)" }, /https/);
    rejects({ qrCodePayload: "not a url" }, /https/);
    rejects({ qrCodePayload: `https://x.test/${"a".repeat(CARD_BACK_LIMITS.qrPayloadLength)}` }, /512/);
    rejects({ adminServicesPrivileges: Array.from({ length: 11 }, (_, i) => `Perk ${i}`) }, /at most 10/);
    rejects({ adminServicesPrivileges: ["x".repeat(61)] }, /longer than 60/);
    rejects({ adminServicesPrivileges: "Butler" }, /list/);
    rejects({}, /Nothing to update/);
  });

  test("accepts only the known details-panel styles", () => {
    assert.equal(parseCardPanelStyle("TRANSPARENT"), "TRANSPARENT");
    assert.equal(parseCardPanelStyle("GLASS"), "GLASS");
    assert.match(parseCardPanelStyle("transparent"), /GLASS, TRANSPARENT/);
    assert.match(parseCardPanelStyle(null), /GLASS, TRANSPARENT/);
  });

  test("the panel style is a tier setting, not part of a membership edit", () => {
    rejects({ cardPanelStyle: "TRANSPARENT" }, /Nothing to update/);
  });

  test("rejects bidi overrides and control characters that could reorder the printed card", () => {
    rejects({ adminServicesPrivileges: ["Butler \u202Eevil"] }, /unsupported/);
    rejects({ cardValidityPeriod: "EXP\u000012/28" }, /unsupported/);
  });
});

describe("tier card-back layout", () => {
  const layout = { detailsX: 8, detailsY: 30.04, detailsW: 55, qrX: 70, qrY: 12, qrW: 22 };

  test("accepts a layout that keeps both panels on the card, rounded to 0.1%", () => {
    assert.deepEqual(parseCardLayout(layout), { ...layout, detailsY: 30 });
  });

  test("rejects missing, out-of-range and off-card values", () => {
    assert.match(String(parseCardLayout({ ...layout, qrW: "22" })), /qrW must be a number/);
    assert.match(String(parseCardLayout({ ...layout, detailsY: 95 })), /detailsY must be between 0 and 80/);
    assert.match(String(parseCardLayout({ ...layout, detailsX: 60, detailsW: 50 })), /details panel would run off/);
    assert.match(String(parseCardLayout({ ...layout, qrX: 80, qrW: 20 })), /QR panel would run off/);
    assert.match(String(parseCardLayout("top-left")), /must be an object/);
  });

  test("a damaged stored value falls back to the standard layout", () => {
    assert.equal(readCardLayout(null), null);
    assert.equal(readCardLayout({ detailsX: 5 }), null);
    assert.deepEqual(readCardLayout(layout), { ...layout, detailsY: 30 });
  });
});

describe("effective card status", () => {
  test("derives from the membership when the admin has not set one", () => {
    assert.deepEqual(effectiveCardStatus(null, "ACTIVE", FUTURE, NOW), { status: "ACTIVE", source: "membership" });
    assert.equal(effectiveCardStatus(null, "ACTIVE", PAST, NOW).status, "EXPIRED");
    assert.equal(effectiveCardStatus(null, "SUSPENDED", FUTURE, NOW).status, "SUSPENDED");
    assert.equal(effectiveCardStatus(null, "CANCELLED", FUTURE, NOW).status, "INACTIVE");
    assert.equal(effectiveCardStatus(null, "PENDING", FUTURE, NOW).status, "INACTIVE");
  });

  test("an admin can restrict any card but cannot show a closed membership as ACTIVE", () => {
    assert.deepEqual(effectiveCardStatus("SUSPENDED", "ACTIVE", FUTURE, NOW), { status: "SUSPENDED", source: "admin" });
    assert.deepEqual(effectiveCardStatus("ACTIVE", "CANCELLED", FUTURE, NOW), { status: "INACTIVE", source: "membership" });
    assert.deepEqual(effectiveCardStatus("ACTIVE", "ACTIVE", PAST, NOW), { status: "ACTIVE", source: "admin" });
  });

  test("formats the derived validity line", () => {
    assert.equal(formatValidThru(new Date("2028-12-31T00:00:00Z")), "VALID THRU 12/28");
  });
});
