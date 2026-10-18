import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIER_SIGNIFIER,
  WORD_POOLS,
  canonicalIdentifier,
  identifierKey,
  isApprovedWord,
  registryYear,
  renderMembershipCode,
  renderRegaliaId,
  type PooledTierCode,
} from "../../src/lib/registry/format";

test("pool sizes and spellings match the approved library", () => {
  assert.equal(WORD_POOLS.SIG.length, 10);
  assert.equal(WORD_POOLS.PRE.length, 10);
  assert.equal(WORD_POOLS.SOV.length, 10);
  assert.equal(WORD_POOLS.IMP.length, 40);
  for (const tier of Object.keys(WORD_POOLS) as PooledTierCode[]) {
    assert.equal(new Set(WORD_POOLS[tier]).size, WORD_POOLS[tier].length, `${tier} has duplicates`);
    for (const word of WORD_POOLS[tier]) assert.equal(word, word.normalize("NFC"));
  }
  assert.ok(WORD_POOLS.SIG.includes("ÉVÆR"));
  assert.ok(WORD_POOLS.IMP.includes("AURÉVORIAN"));
});

test("no two words in a tier collide once accents are folded (the DB collation is accent-insensitive)", () => {
  const fold = (w: string) =>
    w.normalize("NFD").replace(/\p{M}/gu, "").replace(/Æ/g, "AE").replace(/Ø/g, "O");
  for (const tier of Object.keys(WORD_POOLS) as PooledTierCode[]) {
    const folded = WORD_POOLS[tier].map(fold);
    assert.equal(new Set(folded).size, folded.length, `${tier} has accent-folded collisions`);
  }
});

test("REGALIA ID uses the exact RGL · TIER · YY · NNNN formula", () => {
  assert.equal(renderRegaliaId({ tierCode: "IMP", issueYear: 2026, registrySequence: 5 }), "RGL · IMP · 26 · 0005");
  assert.equal(renderRegaliaId({ tierCode: "PRV", issueYear: 2027, registrySequence: 1 }), "RGL · PRV · 27 · 0001");
  assert.throws(() => renderRegaliaId({ tierCode: "SIG", issueYear: 2026, registrySequence: 10000 }));
});

test("each tier renders its own Membership Code language", () => {
  assert.equal(renderMembershipCode({ tierCode: "PRV", word: null, key: "99", serial: "0001" }), "LMR / PRV-99 · 0001");
  assert.equal(renderMembershipCode({ tierCode: "SIG", word: "ÉVÆR", key: "28", serial: "0002" }), "SIG — ÉVÆR · 28 / S");
  assert.equal(renderMembershipCode({ tierCode: "PRE", word: "ORLÉAN", key: "46", serial: "0003" }), "PRE // ORLÉAN // 46 · P");
  assert.equal(renderMembershipCode({ tierCode: "SOV", word: "RÉGÆN", key: "71", serial: "0004" }), "SOV · RÉGÆN · 71 — S");
  assert.equal(renderMembershipCode({ tierCode: "IMP", word: "SÆVORÉN", key: "18", serial: "0005" }), "IMP /// SÆVORÉN /// 18 · ∞");
  assert.equal(TIER_SIGNIFIER.IMP, "∞");
  assert.throws(() => renderMembershipCode({ tierCode: "SIG", word: null, key: "28", serial: "0001" }));
  assert.throws(() => renderMembershipCode({ tierCode: "SIG", word: "ÉVÆR", key: "7", serial: "0001" }));
});

test("word validation is exact: no accent stripping, no case folding", () => {
  assert.ok(isApprovedWord("SIG", "VËRIN"));
  assert.ok(!isApprovedWord("SIG", "VERIN"));
  assert.ok(!isApprovedWord("SIG", "vërin"));
  assert.ok(isApprovedWord("SIG", "VËRIN".normalize("NFD")), "decomposed input is the same word");
});

test("lookup keys ignore separators but keep diacritics", () => {
  const id = "RGL · SIG · 26 · 0012";
  assert.equal(identifierKey("rgl-sig-26-0012"), identifierKey(id));
  const code = "SIG — VËRIN · 28 / S";
  assert.equal(canonicalIdentifier(code), "SIGVËRIN28S");
  assert.equal(identifierKey("SIG VËRIN 28 S"), identifierKey(code));
  assert.notEqual(identifierKey("SIG VERIN 28 S"), identifierKey(code));
});

test("registry year follows the registry time zone across New Year", () => {
  assert.equal(registryYear(new Date("2026-12-31T23:59:00Z")), 2026);
  assert.equal(registryYear(new Date("2027-01-01T00:00:30Z")), 2027);
  assert.equal(registryYear(new Date("2026-12-31T20:00:00Z"), "Asia/Kolkata"), 2027);
});
