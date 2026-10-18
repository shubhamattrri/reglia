import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CARD_FRONT_LAYOUT,
  frontNumber,
  frontValidity,
  parseCardFrontLayout,
  readCardFrontLayout,
} from "../../src/lib/card-front";

function layout(patch: Record<string, unknown> = {}) {
  return { ...structuredClone(DEFAULT_CARD_FRONT_LAYOUT), ...patch };
}

describe("card front layout", () => {
  test("accepts the standard layout and rounds to 0.1", () => {
    const parsed = parseCardFrontLayout(layout({ name: { show: false, x: 10.04, y: 70, size: 3.26 } }));
    assert.ok(typeof parsed !== "string", String(parsed));
    assert.deepEqual(parsed.name, { show: false, x: 10, y: 70, size: 3.3 });
  });

  test("rejects off-card positions, oversized text, bad colours and unknown number sources", () => {
    assert.match(String(parseCardFrontLayout(layout({ number: { show: true, x: 96, y: 50, size: 4 } }))), /between 0 and 90/);
    assert.match(String(parseCardFrontLayout(layout({ name: { show: true, x: 8, y: 70, size: 20 } }))), /between 1.5 and 9/);
    assert.match(String(parseCardFrontLayout(layout({ color: "gold" }))), /hex colour/);
    assert.match(String(parseCardFrontLayout(layout({ numberSource: "CVV" }))), /MEMBERSHIP_NO/);
    assert.match(String(parseCardFrontLayout(layout({ validity: undefined }))), /validity is missing/);
  });

  test("invalid stored JSON falls back to the standard layout", () => {
    assert.equal(readCardFrontLayout(null), null);
    assert.equal(readCardFrontLayout({ name: "x" }), null);
    assert.deepEqual(readCardFrontLayout(DEFAULT_CARD_FRONT_LAYOUT), DEFAULT_CARD_FRONT_LAYOUT);
  });

  test("prints validity as MM/YY and picks the chosen number", () => {
    assert.equal(frontValidity("2028-12-31T00:00:00Z"), "VALID THRU 12/28");
    assert.equal(frontValidity("not a date"), "");
    const card = { membershipNo: "M-1", regaliaId: "RGL · IMP · 26 · 0001", serialNumber: "LR-CSN-1" };
    assert.equal(frontNumber("MEMBERSHIP_NO", card), "M-1");
    assert.equal(frontNumber("REGALIA_ID", card), "RGL · IMP · 26 · 0001");
    assert.equal(frontNumber("SERIAL", card), "LR-CSN-1");
  });
});
