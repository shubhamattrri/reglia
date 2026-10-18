import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  fromMinorUnits,
  readHandoff,
  toMinorUnits,
  verifyRazorpaySignature,
} from "../../src/lib/payments/razorpay";

const SECRET = "test_secret_value";

function sign(orderId: string, paymentId: string, secret = SECRET) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

describe("razorpay signature", () => {
  const orderId = "order_Abc123";
  const paymentId = "pay_Xyz789";

  test("accepts the signature Razorpay produces", () => {
    assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature: sign(orderId, paymentId) }, SECRET), true);
  });

  test("rejects a signature for another payment or secret", () => {
    assert.equal(
      verifyRazorpaySignature({ orderId, paymentId: "pay_Other", signature: sign(orderId, paymentId) }, SECRET),
      false,
    );
    assert.equal(
      verifyRazorpaySignature({ orderId, paymentId, signature: sign(orderId, paymentId, "wrong") }, SECRET),
      false,
    );
    assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature: "short" }, SECRET), false);
  });

  test("readHandoff only accepts well-formed ids", () => {
    const signature = sign(orderId, paymentId);
    assert.deepEqual(readHandoff({ orderId, paymentId, signature }), { orderId, paymentId, signature });
    assert.equal(readHandoff({ orderId: "x", paymentId, signature }), null);
    assert.equal(readHandoff({ orderId, paymentId, signature: "nothex" }), null);
    assert.equal(readHandoff(null), null);
  });
});

describe("razorpay amounts", () => {
  test("converts to and from the smallest currency unit", () => {
    assert.equal(toMinorUnits(49.99, "USD"), 4999);
    assert.equal(toMinorUnits(12000, "GBP"), 1200000);
    assert.equal(toMinorUnits(500, "JPY"), 500);
    assert.equal(toMinorUnits(1.234, "KWD"), 1230);
    assert.equal(fromMinorUnits(4999, "USD"), 49.99);
    assert.equal(fromMinorUnits(500, "JPY"), 500);
  });
});
