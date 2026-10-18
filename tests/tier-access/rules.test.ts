import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canComplete,
  canIssueSlip,
  canSetPayment,
  parseSlip,
  isServiceLocked,
  nextServiceRequestStatus,
  nextUpgradeStatus,
  quoteUpgrade,
} from "../../src/lib/tier-access/rules";

test("services above the member's tier rank are locked", () => {
  assert.equal(isServiceLocked(2, 1), false);
  assert.equal(isServiceLocked(2, 2), false);
  assert.equal(isServiceLocked(2, 3), true);
  assert.equal(isServiceLocked(0, 1), true, "no live membership locks everything");
  assert.equal(isServiceLocked(1, 0), false, "a missing minimum counts as rank 1");
});

test("within 3 days the member pays only the price difference", () => {
  const quote = quoteUpgrade({ daysSinceStart: 3, oldPrice: 28000, oldCurrency: "GBP", newPrice: 65000, newCurrency: "gbp" });
  assert.deepEqual(quote, { isWithin3Days: true, daysSinceStart: 3, prorated: true, amountDue: 37000, currency: "GBP" });
});

test("after 3 days the full new price is due", () => {
  const quote = quoteUpgrade({ daysSinceStart: 4, oldPrice: 28000, oldCurrency: "GBP", newPrice: 65000, newCurrency: "GBP" });
  assert.equal(quote.isWithin3Days, false);
  assert.equal(quote.prorated, false);
  assert.equal(quote.amountDue, 65000);
});

test("prices in different currencies are never netted", () => {
  const quote = quoteUpgrade({ daysSinceStart: 1, oldPrice: 65000, oldCurrency: "GBP", newPrice: 150000, newCurrency: "USD" });
  assert.equal(quote.isWithin3Days, true);
  assert.equal(quote.prorated, false);
  assert.equal(quote.amountDue, 150000);
  assert.equal(quote.currency, "USD");
});

test("staff approve first, then admin approves once payment is verified", () => {
  assert.deepEqual(nextServiceRequestStatus("PENDING_STAFF", "staff-approve", "staff", false), { ok: true, next: "PENDING_ADMIN" });
  assert.equal(nextServiceRequestStatus("PENDING_STAFF", "admin-approve", "admin", true).ok, false, "admin cannot skip staff");
  assert.equal(nextServiceRequestStatus("PENDING_STAFF", "staff-approve", "admin", true).ok, false, "admin cannot act as staff");
  assert.equal(nextServiceRequestStatus("PENDING_ADMIN", "admin-approve", "staff", true).ok, false, "staff cannot give the final approval");
  assert.equal(nextServiceRequestStatus("PENDING_ADMIN", "admin-approve", "admin", false).ok, false, "payment must be verified");
  assert.deepEqual(nextServiceRequestStatus("PENDING_ADMIN", "admin-approve", "admin", true), {
    ok: true,
    next: "APPROVED_IN_PROGRESS",
  });
  assert.equal(nextServiceRequestStatus("APPROVED_IN_PROGRESS", "reject", "admin", true).ok, false, "approved work cannot be rejected");
  assert.equal(nextServiceRequestStatus("COMPLETED", "reject", "admin", true).ok, false);
});

test("slips are issued only while in progress, and completion needs a slip", () => {
  assert.equal(canIssueSlip("APPROVED_IN_PROGRESS"), true);
  assert.equal(canIssueSlip("PENDING_ADMIN"), false);
  assert.equal(canIssueSlip("COMPLETED"), false);
  assert.equal(canComplete("APPROVED_IN_PROGRESS", false), false);
  assert.equal(canComplete("APPROVED_IN_PROGRESS", true), true);
});

test("slip details are validated and trimmed", () => {
  assert.equal(parseSlip({ roomNumber: "1" }).ok, false, "hotel name is required");
  assert.equal(parseSlip({ hotelName: "Ritz", checkIn: "20/10/2026" }).ok, false, "ISO dates only");
  assert.equal(parseSlip({ hotelName: "Ritz", checkIn: "2026-10-22", checkOut: "2026-10-20" }).ok, false, "check-out after check-in");
  assert.deepEqual(parseSlip({ hotelName: "  The Ritz ", roomNumber: "", notes: " VIP " }), {
    ok: true,
    value: { hotelName: "The Ritz", roomNumber: null, confirmationCode: null, checkIn: null, checkOut: null, notes: "VIP" },
  });
});

test("upgrades need both approval stages in order", () => {
  assert.deepEqual(nextUpgradeStatus("PENDING", "staff-approve", "staff", false), { ok: true, next: "STAFF_APPROVED" });
  assert.equal(nextUpgradeStatus("PENDING", "admin-approve", "admin", true).ok, false);
  assert.equal(nextUpgradeStatus("STAFF_APPROVED", "staff-approve", "staff", true).ok, false, "no double staff approval");
  assert.deepEqual(nextUpgradeStatus("STAFF_APPROVED", "admin-approve", "admin", true), { ok: true, next: "ADMIN_APPROVED" });
});

test("rejection rules", () => {
  assert.deepEqual(nextUpgradeStatus("PENDING", "reject", "staff", false), { ok: true, next: "REJECTED" });
  assert.equal(nextUpgradeStatus("STAFF_APPROVED", "reject", "staff", false).ok, false, "only admin rejects after staff approval");
  assert.deepEqual(nextUpgradeStatus("STAFF_APPROVED", "reject", "admin", false), { ok: true, next: "REJECTED" });
  assert.equal(nextUpgradeStatus("ADMIN_APPROVED", "reject", "admin", false).ok, false);
  assert.equal(nextServiceRequestStatus("REJECTED", "reject", "admin", false).ok, false);
  assert.deepEqual(nextServiceRequestStatus("PENDING_STAFF", "reject", "staff", false), { ok: true, next: "REJECTED" });
  assert.equal(nextServiceRequestStatus("PENDING_ADMIN", "reject", "staff", false).ok, false);
  assert.equal(canSetPayment("ADMIN_APPROVED"), false);
  assert.equal(canSetPayment("STAFF_APPROVED"), true);
  assert.equal(canSetPayment("PENDING_ADMIN"), true);
  assert.equal(canSetPayment("APPROVED_IN_PROGRESS"), false);
});
