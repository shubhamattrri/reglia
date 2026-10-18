import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { matchesSearch } from "../src/lib/search";

describe("matchesSearch", () => {
  const plain = ["Priya Raman", "priya@example.com", null];
  const ids = ["RG-SIG-0042", undefined];

  test("an empty query matches everything", () => {
    assert.equal(matchesSearch("   ", plain, ids), true);
  });

  test("plain values match case-insensitively as typed", () => {
    assert.equal(matchesSearch("RAMAN", plain, ids), true);
    assert.equal(matchesSearch("example.com", plain, ids), true);
    assert.equal(matchesSearch("ramen", plain, ids), false);
  });

  test("identifiers match with separators ignored", () => {
    assert.equal(matchesSearch("sig0042", plain, ids), true);
    assert.equal(matchesSearch("RG SIG 0042", plain, ids), true);
    assert.equal(matchesSearch("PRE0042", plain, ids), false);
  });

  test("separator-insensitive matching does not apply to plain values", () => {
    assert.equal(matchesSearch("priyaraman", plain), false);
  });
});
