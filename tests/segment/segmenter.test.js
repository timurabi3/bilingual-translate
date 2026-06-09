// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { collectBlocks } from "../../src/segment/segmenter.js";

function root(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

describe("collectBlocks", () => {
  it("collects block-level text containers", () => {
    const r = root(`<p>Hello</p><h1>Title</h1><li>Item</li>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["Hello", "Title", "Item"]);
  });

  it("keeps inline markup as a single block's text", () => {
    const r = root(`<p>Click <a href="#">here</a> now</p>`);
    const blocks = collectBlocks(r);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("Click here now");
  });

  it("skips scripts, prices, and empty nodes", () => {
    const r = root(`<p>淘宝企业购</p><span>¥209.9</span><script>var x=1</script><p>   </p>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["淘宝企业购"]);
  });

  it("does not double-collect nested block containers", () => {
    // Outer div has a child <p>; we collect the <p>, not the div text twice.
    const r = root(`<div><p>Inner paragraph</p></div>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["Inner paragraph"]);
  });

  it("returns a live element reference for injection", () => {
    const r = root(`<p>Hello</p>`);
    const blocks = collectBlocks(r);
    expect(blocks[0].el.tagName).toBe("P");
  });
});
