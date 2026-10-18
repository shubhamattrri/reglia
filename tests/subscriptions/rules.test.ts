import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  describeDuration,
  durationUnits,
  isExpiringSoon,
  parsePlanInput,
  stackExpiry,
} from "../../src/lib/subscriptions/plans";
import {
  SANDBOX_DECLINE_CARD,
  chargeSavedCard,
  detectBrand,
  parseExpiry,
  passesLuhn,
  tokenizeCard,
  validateCard,
} from "../../src/lib/payments/gateway";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-10T12:00:00Z");

function plan(body: Record<string, unknown>) {
  return parsePlanInput({ name: "Imperium", price: "49.99", ...body });
}

describe("plan form", () => {
  test("week, month and year counts are stored as days", () => {
    const cases: [string, number, number][] = [
      ["WEEK", 1, 7],
      ["WEEK", 2, 14],
      ["MONTH", 1, 30],
      ["MONTH", 3, 90],
      ["YEAR", 1, 365],
      ["CUSTOM", 45, 45],
    ];
    for (const [durationType, count, days] of cases) {
      const result = plan({ durationType, count });
      assert.ok(result.ok, `${durationType} × ${count}`);
      assert.equal(result.value.durationValue, days);
      assert.equal(durationUnits(result.value.durationType, days), durationType === "CUSTOM" ? days : count);
    }
  });

  test("prices keep two decimals and reject anything else", () => {
    const ok = plan({ durationType: "MONTH", count: 1, price: "49.5" });
    assert.ok(ok.ok);
    assert.equal(ok.value.price, "49.50");
    for (const price of ["4.999", "-1", "abc", "", "1e3", "100000000"]) {
      assert.equal(plan({ durationType: "MONTH", count: 1, price }).ok, false, price);
    }
  });

  test("rejects a missing name, unknown unit, zero count and over-long plans", () => {
    assert.equal(plan({ name: "  ", durationType: "MONTH", count: 1 }).ok, false);
    assert.equal(plan({ durationType: "DAY", count: 1 }).ok, false);
    assert.equal(plan({ durationType: "MONTH", count: 0 }).ok, false);
    assert.equal(plan({ durationType: "MONTH", count: 1.5 }).ok, false);
    assert.equal(plan({ durationType: "CUSTOM", count: 3651 }).ok, false);
    assert.equal(plan({ durationType: "YEAR", count: 11 }).ok, false);
  });

  test("durations read naturally", () => {
    assert.equal(describeDuration("WEEK", 7), "1 week");
    assert.equal(describeDuration("MONTH", 90), "3 months");
    assert.equal(describeDuration("YEAR", 365), "1 year");
    assert.equal(describeDuration("CUSTOM", 1), "1 day");
    assert.equal(describeDuration("MONTH", 45), "45 days");
  });
});

describe("expiry rules", () => {
  test("renewal stacks on the remaining time", () => {
    const expiry = new Date(NOW.getTime() + 1.5 * DAY);
    assert.equal(stackExpiry(expiry, 30, NOW).getTime(), expiry.getTime() + 30 * DAY);
  });

  test("a lapsed subscription restarts from now", () => {
    const expiry = new Date(NOW.getTime() - 10 * DAY);
    assert.equal(stackExpiry(expiry, 7, NOW).getTime(), NOW.getTime() + 7 * DAY);
  });

  test("the warning window is now through 2 days ahead", () => {
    assert.equal(isExpiringSoon(new Date(NOW.getTime() + DAY), NOW), true);
    assert.equal(isExpiringSoon(new Date(NOW.getTime() + 2 * DAY), NOW), true);
    assert.equal(isExpiringSoon(new Date(NOW.getTime() + 2 * DAY + 1000), NOW), false);
    assert.equal(isExpiringSoon(new Date(NOW.getTime() - 1000), NOW), false);
  });
});

describe("sandbox gateway", () => {
  test("Luhn and brand detection", () => {
    assert.equal(passesLuhn("4242424242424242"), true);
    assert.equal(passesLuhn("4242424242424241"), false);
    assert.equal(passesLuhn("42424"), false);
    assert.equal(detectBrand("4242424242424242"), "Visa");
    assert.equal(detectBrand("5555555555554444"), "Mastercard");
    assert.equal(detectBrand("2223003122003222"), "Mastercard");
    assert.equal(detectBrand("378282246310005"), "American Express");
  });

  test("expiry parsing and validation", () => {
    assert.deepEqual(parseExpiry("12/30"), { month: 12, year: 2030 });
    assert.deepEqual(parseExpiry("07 / 2031"), { month: 7, year: 2031 });
    assert.equal(parseExpiry("13/30"), null);
    assert.equal(parseExpiry("1230x"), null);
    const card = { number: "4242 4242 4242 4242", cvc: "123" };
    assert.equal(validateCard({ ...card, expMonth: 10, expYear: 2026 }, NOW).ok, true, "valid through its expiry month");
    assert.equal(validateCard({ ...card, expMonth: 9, expYear: 2026 }, NOW).ok, false);
    assert.equal(validateCard({ ...card, cvc: "12", expMonth: 1, expYear: 2030 }, NOW).ok, false);
    assert.equal(
      validateCard({ number: "378282246310005", cvc: "123", expMonth: 1, expYear: 2030 }, NOW).ok,
      false,
      "Amex needs four digits",
    );
  });

  test("tokens never carry the card number; charges are idempotent; the decline card declines", async () => {
    const tokenized = await tokenizeCard({ number: "4242424242424242", expMonth: 12, expYear: 2034, cvc: "123" });
    assert.ok(tokenized.ok);
    assert.equal(tokenized.card.cardLast4, "4242");
    assert.doesNotMatch(JSON.stringify(tokenized.card), /424242424242/);

    const charge = (key: string) =>
      chargeSavedCard({ ...tokenized.card, amount: 10, currency: "GBP", idempotencyKey: key });
    const [a, b, c] = await Promise.all([charge("key-one-1"), charge("key-one-1"), charge("key-two-2")]);
    assert.ok(a.ok && b.ok && c.ok);
    assert.equal(a.chargeId, b.chargeId);
    assert.notEqual(a.chargeId, c.chargeId);

    const decline = await tokenizeCard({ number: SANDBOX_DECLINE_CARD, expMonth: 12, expYear: 2034, cvc: "123" });
    assert.ok(decline.ok);
    const declined = await chargeSavedCard({ ...decline.card, amount: 10, currency: "GBP", idempotencyKey: "key-dcl-1" });
    assert.equal(declined.ok, false);
  });
});
