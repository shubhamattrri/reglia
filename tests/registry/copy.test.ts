import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MembershipCodeDisplay, RegaliaIdDisplay } from "../../src/components/registry/credential-display";
import { copyExact } from "../../src/components/registry/copy-exact";
import {
  TIER_CODES,
  WORD_POOLS,
  identifierKey,
  renderMembershipCode,
  renderRegaliaId,
  usesWordPool,
} from "../../src/lib/registry/format";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function mockClipboard() {
  const writes: string[] = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (v: string) => void writes.push(v) } },
  });
  return writes;
}

afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
});

const decode = (html: string) =>
  html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function attr(html: string, name: string) {
  return [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => decode(m[1]));
}

/** Every Membership Code the registry can render, including every diacritic word. */
function allCodes() {
  const codes: { tier: (typeof TIER_CODES)[number]; code: string }[] = [];
  for (const tier of TIER_CODES) {
    const words = usesWordPool(tier) ? WORD_POOLS[tier] : [null];
    for (const word of words) {
      codes.push({ tier, code: renderMembershipCode({ tierCode: tier, word, key: "07", serial: "0420" }) });
    }
  }
  return codes;
}

test("Membership Code display renders and copies every pool word byte-for-byte", async () => {
  const codes = allCodes();
  assert.equal(codes.length, 1 + 10 + 10 + 10 + 40);

  for (const { tier, code } of codes) {
    const html = renderToStaticMarkup(createElement(MembershipCodeDisplay, { value: code, tierCode: tier }));

    assert.deepEqual(attr(html, "data-registry-value"), [code], `${code}: visible value`);
    assert.deepEqual(attr(html, "data-copy-value"), [code], `${code}: copy payload`);
    assert.ok(decode(html).includes(`>${code}</span>`), `${code}: rendered as one intact text node`);
    assert.ok(html.includes('translate="no"'), "browser translation must not touch the code");
    assert.ok(!/uppercase|lowercase|capitalize/.test(html.match(/<span[^>]*data-registry-value[^>]*>/)![0]));

    const writes = mockClipboard();
    assert.equal(await copyExact(attr(html, "data-copy-value")[0]), true);
    assert.equal(writes.length, 1);
    const pasted = writes[0];
    assert.ok(Buffer.from(pasted, "utf8").equals(Buffer.from(code, "utf8")), `${code}: clipboard bytes differ`);
    assert.equal(pasted, pasted.normalize("NFC"));
    assert.equal(identifierKey(pasted), identifierKey(code), `${code}: pasted value must resolve at login`);
  }
});

test("diacritics survive in every word-bearing code", () => {
  for (const tier of TIER_CODES) {
    if (!usesWordPool(tier)) continue;
    for (const word of WORD_POOLS[tier]) {
      assert.match(word, /[^\x00-\x7F]/, `${word} should carry a diacritic`);
      const code = renderMembershipCode({ tierCode: tier, word, key: "07", serial: "0420" });
      assert.ok(code.includes(word), `${code} lost "${word}"`);
    }
  }
  assert.ok(allCodes().some((c) => c.code.includes("∞")));
});

test("REGALIA ID display copies the exact registry string", async () => {
  for (const tier of TIER_CODES) {
    const id = renderRegaliaId({ tierCode: tier, issueYear: 2026, registrySequence: 37 });
    const html = renderToStaticMarkup(createElement(RegaliaIdDisplay, { value: id, tone: "admin" }));
    assert.deepEqual(attr(html, "data-copy-value"), [id]);
    assert.ok(decode(html).includes(`>${id}</span>`));

    const writes = mockClipboard();
    await copyExact(id);
    assert.equal(writes[0], id);
    assert.ok(writes[0].includes(" · "), "middle dots and spaces are preserved");
  }
});

test("pending credentials render the application-portal notice instead of a value", () => {
  const html = renderToStaticMarkup(
    createElement(MembershipCodeDisplay, { value: null, pendingText: "Issued after approval — not entered by applicant" }),
  );
  assert.ok(decode(html).includes("Issued after approval — not entered by applicant"));
  assert.deepEqual(attr(html, "data-copy-value"), []);
});
