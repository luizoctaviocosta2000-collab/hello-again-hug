import { describe, expect, test } from "bun:test";
import { parseMoneyCents } from "../src/lib/money-input";

describe("receipt entry amount parser", () => {
  test("parses Brazilian decimal and grouped values", () => {
    expect(parseMoneyCents("1.234,56")).toBe(123456);
    expect(parseMoneyCents("1234,56")).toBe(123456);
    expect(parseMoneyCents("R$ 1.234,56")).toBe(123456);
    expect(parseMoneyCents("1.234")).toBe(123400);
  });

  test("does not multiply decimal-point input by 100", () => {
    expect(parseMoneyCents("1234.56")).toBe(123456);
    expect(parseMoneyCents("1234.5")).toBe(123450);
  });

  test("rejects ambiguous, negative, empty and excessive precision", () => {
    for (const input of ["", " ", "0", "-1", "1.2.34", "1,234.56", "1,234", "0.0001", "1,001", "1.234,567", "R$ -12,00", "abc"]) {
      expect(parseMoneyCents(input)).toBeNull();
    }
  });

  test("refuses amounts whose centavos exceed safe integer precision", () => {
    expect(parseMoneyCents("9999999999999999999999,99")).toBeNull();
  });
});
