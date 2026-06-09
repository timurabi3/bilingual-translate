// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { shouldSkip, isPriceOrSymbolOnly } from "../../src/segment/skipRules.js";

function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstElementChild;
}

describe("shouldSkip", () => {
  it("skips script/style/code/pre", () => {
    for (const tag of ["script", "style", "code", "pre"]) {
      expect(shouldSkip(el(`<${tag}>x</${tag}>`))).toBe(true);
    }
  });
  it("skips contenteditable and inputs", () => {
    expect(shouldSkip(el(`<div contenteditable="true">x</div>`))).toBe(true);
    expect(shouldSkip(el(`<textarea>x</textarea>`))).toBe(true);
  });
  it("skips already-translated nodes", () => {
    expect(shouldSkip(el(`<p data-xlate="1">x</p>`))).toBe(true);
  });
  it("does NOT skip a normal paragraph", () => {
    expect(shouldSkip(el(`<p>Hello world</p>`))).toBe(false);
  });
});

describe("isPriceOrSymbolOnly", () => {
  it("treats prices/numbers/symbols as non-translatable", () => {
    expect(isPriceOrSymbolOnly("¥209.9")).toBe(true);
    expect(isPriceOrSymbolOnly("  123  ")).toBe(true);
    expect(isPriceOrSymbolOnly("→ ★")).toBe(true);
  });
  it("treats real text as translatable", () => {
    expect(isPriceOrSymbolOnly("淘宝企业购")).toBe(false);
    expect(isPriceOrSymbolOnly("Hello")).toBe(false);
  });
});
