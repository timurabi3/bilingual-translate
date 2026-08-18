import { describe, it, expect } from "vitest";
import { domainMatches, hostnameMatches } from "../../src/common/domains.js";

describe("domainMatches", () => {
  it("matches the exact host", () => {
    expect(domainMatches("taobao.com", "taobao.com")).toBe(true);
  });

  it("matches subdomains", () => {
    expect(domainMatches("world.taobao.com", "taobao.com")).toBe(true);
    expect(domainMatches("a.b.taobao.com", "taobao.com")).toBe(true);
  });

  it("does not match lookalike suffixes", () => {
    expect(domainMatches("nottaobao.com", "taobao.com")).toBe(false);
    expect(domainMatches("taobao.com.evil.io", "taobao.com")).toBe(false);
  });

  it("is case-insensitive and tolerates whitespace or a leading dot", () => {
    expect(domainMatches("TAOBAO.COM", "taobao.com")).toBe(true);
    expect(domainMatches("taobao.com", ".taobao.com")).toBe(true);
    expect(domainMatches("taobao.com", " taobao.com ")).toBe(true);
  });

  it("rejects empty domains", () => {
    expect(domainMatches("taobao.com", "")).toBe(false);
    expect(domainMatches("taobao.com", null)).toBe(false);
  });
});

describe("hostnameMatches", () => {
  it("matches a hostname against a domain list", () => {
    expect(hostnameMatches("world.taobao.com", ["example.com", "taobao.com"])).toBe(true);
    expect(hostnameMatches("example.org", ["example.com", "taobao.com"])).toBe(false);
    expect(hostnameMatches("example.org", null)).toBe(false);
    expect(hostnameMatches("example.org", [])).toBe(false);
  });
});
