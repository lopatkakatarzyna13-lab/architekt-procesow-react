import { describe, expect, it } from "vitest";
import { DEFAULT_WORK_MODE, normalizeWorkMode } from "./workMode";

describe("normalizeWorkMode", () => {
  it("zachowuje wartość guided", () => {
    expect(normalizeWorkMode("guided")).toBe("guided");
  });

  it("zachowuje wartość expert", () => {
    expect(normalizeWorkMode("expert")).toBe("expert");
  });

  it("zamienia nieprawidłową wartość na guided", () => {
    expect(normalizeWorkMode("invalid")).toBe(DEFAULT_WORK_MODE);
  });

  it("zamienia pusty tekst na guided", () => {
  expect(normalizeWorkMode("")).toBe(DEFAULT_WORK_MODE);
});

  it("ustawia guided, gdy wartości brakuje", () => {
    expect(normalizeWorkMode(undefined)).toBe(DEFAULT_WORK_MODE);
  });

  it("ustawia guided dla wartości null", () => {
    expect(normalizeWorkMode(null)).toBe(DEFAULT_WORK_MODE);
  });
});
