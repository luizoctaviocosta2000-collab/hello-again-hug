import { describe, expect, test } from "bun:test";
import { validatePhotoResults } from "../supabase/functions/_shared/photo-results";

describe("photo classification preserves the selected images", () => {
  test("rejects duplicate indices instead of silently dropping a selected image", () => {
    expect(() => validatePhotoResults({ photos: [{ index: 0, category: "sala" }, { index: 0, category: "quarto" }] }, 2)).toThrow();
  });
  test("rejects incomplete or out-of-range results", () => {
    expect(() => validatePhotoResults({ photos: [{ index: 0 }] }, 2)).toThrow();
    expect(() => validatePhotoResults({ photos: [{ index: 3 }] }, 1)).toThrow();
  });
  test("preserves valid indices and supplies safe categories and ordering", () => {
    expect(validatePhotoResults({ photos: [{ index: 1, category: "unknown", order: "invalid" }, { index: 0, category: "sala", order: 1 }] }, 2)).toEqual([
      { index: 1, category: "outros", order: 2 }, { index: 0, category: "sala", order: 1 },
    ]);
  });
});
