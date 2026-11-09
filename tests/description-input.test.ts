import { describe, expect, test } from "bun:test";
import { descriptionInput, preserveDescriptionLocation } from "../supabase/functions/_shared/description-input";

describe("description inputs", () => {
  test("keeps supplied facts and excludes contacts, IDs and unknown fields", () => {
    expect(descriptionInput({ title: " Apartamento ", bedrooms: "2", parking_spaces: 0, asking_price: "500000", city: "Belo Horizonte", owner_phone: "private", user_id: "private", extra: "private" })).toEqual({ title: "Apartamento", city: "Belo Horizonte", bedrooms: 2, parking_spaces: 0, asking_price: 500000 });
  });
  test("does not turn absent numbers into invented zero values", () => {
    expect(descriptionInput({ title: "Casa", bedrooms: "", asking_price: null, area_m2: "  " })).toEqual({ title: "Casa" });
  });
  test("rejects empty, oversized and invalid property data before using quota", () => {
    for (const value of [null, [], {}, { bedrooms: true }, { area_m2: -1 }, { asking_price: "NaN" }, { title: "x".repeat(301) }]) expect(() => descriptionInput(value)).toThrow();
  });
  test("preserves the supplied city when the model mentions only the neighborhood", () => {
    const property = { neighborhood: "Castelo", city: "Belo Horizonte" };
    expect(preserveDescriptionLocation("Apartamento de 2 quartos no Castelo", property)).toContain("Localização: Castelo, Belo Horizonte.");
    const full = "Apartamento no Castelo, em Belo Horizonte.";
    expect(preserveDescriptionLocation(full, property)).toBe(full);
    expect(preserveDescriptionLocation("Apartamento", {})).toBe("Apartamento");
  });
  test("the response length limit does not cut off the supplied location", () => {
    const text = preserveDescriptionLocation("x".repeat(4000), { city: "Belo Horizonte" });
    expect(text.length).toBeLessThanOrEqual(3000);
    expect(text).toEndWith("Localização: Belo Horizonte.");
  });
});
