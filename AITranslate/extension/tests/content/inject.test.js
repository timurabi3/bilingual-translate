// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { injectTranslation, removeAllTranslations, setDisplayMode } from "../../src/content/inject.js";

function root(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}

describe("injectTranslation — block context", () => {
  it("inserts a sibling [data-xlate] node after a paragraph", () => {
    const r = root(`<p id="o">淘宝企业购</p>`);
    const orig = r.querySelector("#o");
    injectTranslation(orig, "Taobao-Unternehmenskäufe");
    const next = orig.nextElementSibling;
    expect(next.getAttribute("data-xlate")).toBe("1");
    expect(next.textContent).toBe("Taobao-Unternehmenskäufe");
    expect(orig.textContent).toBe("淘宝企业购"); // original untouched
  });

  it("does not inject twice for the same original", () => {
    const r = root(`<p id="o">x</p>`);
    const orig = r.querySelector("#o");
    injectTranslation(orig, "X1");
    injectTranslation(orig, "X2");
    expect(r.querySelectorAll("[data-xlate]")).toHaveLength(1);
  });
});

describe("injectTranslation — inline / layout-sensitive contexts", () => {
  it("appends an inline span inside flex-row items (no new sibling)", () => {
    const r = root(`<div style="display:flex"><div id="o">电脑</div></div>`);
    const orig = r.querySelector("#o");
    injectTranslation(orig, "Computer");
    expect(orig.nextElementSibling).toBeNull();
    const inner = orig.querySelector("[data-xlate]");
    expect(inner.tagName).toBe("SPAN");
    expect(inner.textContent).toBe("Computer");
  });

  it("appends an inline span inside anchors", () => {
    const r = root(`<a id="o" href="#">手机</a>`);
    const orig = r.querySelector("#o");
    injectTranslation(orig, "Phone");
    expect(orig.nextElementSibling).toBeNull();
    expect(orig.querySelector("[data-xlate]").tagName).toBe("SPAN");
  });

  it("appends inside table cells so the row stays valid", () => {
    const r = root(`<table><tbody><tr><td id="o">名称</td></tr></tbody></table>`);
    const orig = r.querySelector("#o");
    injectTranslation(orig, "Name");
    expect(orig.querySelector("[data-xlate]")).not.toBeNull();
    expect(orig.parentElement.children).toHaveLength(1); // tr has only the td
  });

  it("appends inside list items so the list stays valid", () => {
    const r = root(`<ul><li id="o">项目</li></ul>`);
    const orig = r.querySelector("#o");
    injectTranslation(orig, "Item");
    expect(orig.querySelector("[data-xlate]")).not.toBeNull();
    expect(orig.parentElement.children).toHaveLength(1); // ul has only the li
  });
});

describe("removal + display modes", () => {
  it("removeAllTranslations strips injected nodes only (block + inline)", () => {
    const r = root(`<p id="a">x</p><div style="display:flex"><div id="b">y</div></div>`);
    injectTranslation(r.querySelector("#a"), "X");
    injectTranslation(r.querySelector("#b"), "Y");
    removeAllTranslations(r);
    expect(r.querySelectorAll("[data-xlate]")).toHaveLength(0);
    expect(r.querySelector("#a")).not.toBeNull();
    expect(r.querySelector("#b").textContent).toBe("y");
  });

  it("setDisplayMode 'translation' hides only originals with a sibling translation", () => {
    const r = root(`<p id="a">x</p><div style="display:flex"><div id="b">y</div></div>`);
    injectTranslation(r.querySelector("#a"), "X");
    injectTranslation(r.querySelector("#b"), "Y");
    setDisplayMode(r, "translation");
    expect(r.querySelector("#a").classList.contains("xlate-hidden-original")).toBe(true);
    // inline-injected element keeps showing (hiding it would hide the translation too)
    expect(r.querySelector("#b").classList.contains("xlate-hidden-original")).toBe(false);
    setDisplayMode(r, "bilingual");
    expect(r.querySelector("#a").classList.contains("xlate-hidden-original")).toBe(false);
  });
});
