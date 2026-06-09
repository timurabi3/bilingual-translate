// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { injectTranslation, removeAllTranslations, setDisplayMode } from "../../src/content/inject.js";

function root(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}

describe("injectTranslation", () => {
  it("inserts a sibling [data-xlate] node after the original", () => {
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
    const xlates = r.querySelectorAll("[data-xlate]");
    expect(xlates).toHaveLength(1);
  });

  it("removeAllTranslations strips injected nodes only", () => {
    const r = root(`<p id="o">x</p>`);
    injectTranslation(r.querySelector("#o"), "X");
    removeAllTranslations(r);
    expect(r.querySelectorAll("[data-xlate]")).toHaveLength(0);
    expect(r.querySelector("#o")).not.toBeNull();
  });

  it("setDisplayMode toggles visibility classes", () => {
    const r = root(`<p id="o">x</p>`);
    injectTranslation(r.querySelector("#o"), "X");
    setDisplayMode(r, "translation");
    expect(r.querySelector("#o").classList.contains("xlate-hidden-original")).toBe(true);
    setDisplayMode(r, "bilingual");
    expect(r.querySelector("#o").classList.contains("xlate-hidden-original")).toBe(false);
  });
});
