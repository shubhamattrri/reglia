import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import jsQR from "jsqr";
import { MembershipCardBack } from "../../src/components/regalia/membership-card-back";
import type { CardBackView } from "../../src/lib/card-back";

type CardProps = Parameters<typeof MembershipCardBack>[0]["card"];

const BASE: CardProps = {
  tierName: "Regalia Imperium",
  tierCode: "IMP",
  regaliaId: "RGL · IMP · 26 · 0005",
  membershipCode: "IMP /// SÆVÉRIN /// 18 · ∞",
  status: "ACTIVE",
  validity: "VALID THRU 12/28",
  privileges: ["Private aviation desk", "Résidence — Côte d'Azur", "Œnothèque access"],
  qrPayload: "https://limasu.test/verify?token=alpha",
};

function render(card: Partial<CardBackView> = {}) {
  return renderToStaticMarkup(createElement(MembershipCardBack, { card: { ...BASE, ...card } }));
}

/** Rasterises the rendered SVG path (one square per module) and decodes it like a phone camera would. */
function decodeQr(markup: string) {
  const viewBox = markup.match(/viewBox="0 0 (\d+) \1"/);
  const d = markup.match(/<path d="([^"]+)"/);
  assert.ok(viewBox && d, "QR svg present");
  const span = Number(viewBox[1]);
  const scale = 8;
  const size = span * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (const [, x, y] of d[1].matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    for (let py = Number(y) * scale; py < (Number(y) + 1) * scale; py += 1) {
      for (let px = Number(x) * scale; px < (Number(x) + 1) * scale; px += 1) {
        const i = (py * size + px) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
    }
  }
  return jsQR(pixels, size, size)?.data ?? null;
}

describe("MembershipCardBack", () => {
  test("renders the REGALIA ID and Membership Code as separate, exact values", () => {
    const html = render();
    assert.ok(html.includes(`data-registry-value="RGL · IMP · 26 · 0005"`));
    assert.ok(html.includes(`data-registry-value="IMP /// SÆVÉRIN /// 18 · ∞"`));
    assert.ok(html.includes(">IMP /// SÆVÉRIN /// 18 · ∞<"), "code text is not split or escaped");
    assert.match(html, /Membership Code<span[^>]*> · (<!-- -->)?Imperium<\/span>/);
    assert.ok(!html.includes("RGL · IMP · 26 · 0005 IMP"), "identifiers are never merged");
  });

  test("shows admin privileges and validity exactly, in UTF-8, with no case transform on the text", () => {
    const html = render({
      validity: "EXP 12/28",
      privileges: ["Straße privée", "Ærial ∞ transfers", "Re\u0301sidence"],
    });
    assert.ok(html.includes(">EXP 12/28<"));
    for (const item of ["Straße privée", "Ærial ∞ transfers", "Re\u0301sidence"]) {
      assert.ok(html.includes(`title="${item}"`), item);
      assert.ok(html.includes(`>${item}<`), item);
    }
    const privileges = html.slice(html.indexOf("data-card-privileges"));
    assert.ok(!/class="[^"]*\buppercase\b/.test(privileges.slice(0, privileges.indexOf("</ul>"))));
    assert.ok(html.includes("Concierge Privileges &amp; Allocated Services"));
  });

  test("draws the details over the uploaded tier artwork without printing a brand name", () => {
    const visibleText = (markup: string) => markup.replace(/<[^>]*>/g, " ");
    const plain = render();
    assert.ok(!/limasu/i.test(visibleText(plain)));
    assert.ok(plain.includes(">Regalia Imperium<"), "tier name stands in for the logo when there is no artwork");

    const html = render({ artwork: "/api/uploads/card-back-imperium.jpeg" });
    assert.ok(!/limasu/i.test(visibleText(html)));
    assert.ok(html.includes(`<img src="/api/uploads/card-back-imperium.jpeg"`));
    assert.ok(html.includes("data-card-artwork"));
    assert.ok(!html.includes(">Regalia Imperium<"), "artwork carries the logo and wordmark");
    assert.ok(html.includes(`data-registry-value="RGL · IMP · 26 · 0005"`));
    assert.ok(html.includes(">VALID THRU 12/28<"));
    assert.equal(decodeQr(html), BASE.qrPayload);
  });

  test("the admin can drop the smoked-glass panel so the artwork shows through", () => {
    const artwork = "/api/uploads/card-back-imperium.jpeg";
    const glass = render({ artwork });
    assert.ok(glass.includes(`data-card-panel="GLASS"`));
    assert.ok(glass.includes("bg-[rgba(6,10,8,0.74)]"));

    const clear = render({ artwork, panelStyle: "TRANSPARENT" });
    assert.ok(clear.includes(`data-card-panel="TRANSPARENT"`));
    assert.ok(!clear.includes("bg-[rgba(6,10,8,0.74)]"), "no glass backdrop");
    assert.ok(clear.includes("drop-shadow"), "text keeps a halo for legibility");
    assert.ok(clear.includes(`data-registry-value="RGL · IMP · 26 · 0005"`));
  });

  test("places the details and QR panels where the admin set them", () => {
    const artwork = "/api/uploads/card-back-imperium.jpeg";
    const standard = render({ artwork });
    assert.ok(standard.includes("top-[27%]"));
    assert.ok(standard.includes("top-[17%]"));

    const moved = render({
      artwork,
      layout: { detailsX: 8, detailsY: 40, detailsW: 50, qrX: 12, qrY: 10, qrW: 24 },
    });
    assert.ok(moved.includes("left:8%;top:40%;width:50%;max-height:56%"));
    assert.ok(moved.includes("left:12%;top:10%;width:24cqw"));
    assert.ok(!moved.includes("top-[27%]") && !moved.includes("top-[17%]"), "standard positions are dropped");
    assert.equal(decodeQr(moved), BASE.qrPayload);
  });

  test("caps the visible privileges at six with a + N more line", () => {
    const html = render({ privileges: Array.from({ length: 9 }, (_, i) => `Privilege ${i + 1}`) });
    assert.equal((html.match(/title="Privilege \d"/g) ?? []).length, 5);
    assert.ok(html.includes("+ 4 more"));
  });

  test("reflects the card status in the badge", () => {
    assert.ok(render({ status: "SUSPENDED" }).includes(`data-card-status="SUSPENDED"`));
    assert.ok(render({ status: "INACTIVE" }).includes(">INACTIVE<"));
  });

  test("renders a scannable QR that changes with the payload", () => {
    const a = render({ qrPayload: "https://limasu.test/verify?token=alpha" });
    const b = render({ qrPayload: "https://limasu.test/verify?token=bravo-é" });
    assert.equal(decodeQr(a), "https://limasu.test/verify?token=alpha");
    assert.equal(decodeQr(b), "https://limasu.test/verify?token=bravo-é");
    assert.notEqual(a.match(/<path d="[^"]+"/)?.[0], b.match(/<path d="[^"]+"/)?.[0]);
    assert.ok(a.includes("Scan for secure credential verification"));
  });

  test("shows a placeholder instead of a QR when there is no payload", () => {
    const html = render({ qrPayload: null });
    assert.ok(!html.includes("data-qr-payload"));
    assert.ok(html.includes("Issued on approval"));
  });
});
