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
    const r = root(`<div><p>Inner paragraph</p></div>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["Inner paragraph"]);
  });

  it("returns a live element reference for injection", () => {
    const r = root(`<p>Hello</p>`);
    const blocks = collectBlocks(r);
    expect(blocks[0].el.tagName).toBe("P");
  });

  // --- Hard-site cases (Taobao / Weidian style) ---

  it("captures text inside an <a> wrapper (link soup)", () => {
    // Taobao: product titles live directly inside anchors, no <p>.
    const r = root(`<a href="#">天猫超市 Tmall Supermarket</a>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["天猫超市 Tmall Supermarket"]);
  });

  it("captures text inside a bare <span> when it is the leaf text element", () => {
    const r = root(`<span>国家补贴 State subsidy</span>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["国家补贴 State subsidy"]);
  });

  it("handles a Taobao-style product card: title collected, price skipped", () => {
    const r = root(`
      <div class="card">
        <a href="#item">
          <div class="title">夏季新款连衣裙女</div>
          <div class="price">¥125</div>
        </a>
      </div>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["夏季新款连衣裙女"]);
  });

  it("collects each leaf in a nav row separately, not the wrapper twice", () => {
    const r = root(`
      <div class="nav">
        <a href="#1"><span>电脑</span></a>
        <a href="#2"><span>手机</span></a>
        <a href="#3"><span>家电</span></a>
      </div>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["电脑", "手机", "家电"]);
  });

  it("merges inline children inside an anchor into one block", () => {
    // <a> with mixed text + inline <b>, no block child -> one unit.
    const r = root(`<a>立即 <b>购买</b> 商品</a>`);
    const blocks = collectBlocks(r);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("立即 购买 商品");
  });

  it("collects the root element itself when it is a leaf block", () => {
    // The mutation observer passes freshly-added nodes as roots; a bare <p>
    // added to the DOM must be collected, not just its children.
    const p = document.createElement("p");
    p.textContent = "动态加载的内容";
    const blocks = collectBlocks(p);
    expect(blocks.map((b) => b.text)).toEqual(["动态加载的内容"]);
  });

  it("skips elements whose text exceeds the max block length", () => {
    const long = "字".repeat(6000);
    const r = root(`<p>${long}</p>`);
    const blocks = collectBlocks(r);
    expect(blocks).toHaveLength(0);
  });

  it("does not collect a wrapper that contains block-level text children", () => {
    // section wraps two paragraphs -> collect the paragraphs, not the section.
    const r = root(`<section><p>第一段</p><p>第二段</p></section>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["第一段", "第二段"]);
  });

  it("ignores hidden ancestors via skip rules", () => {
    const r = root(`<div style="display:none"><p>hidden</p></div><p>visible</p>`);
    const blocks = collectBlocks(r);
    expect(blocks.map((b) => b.text)).toEqual(["visible"]);
  });
});
