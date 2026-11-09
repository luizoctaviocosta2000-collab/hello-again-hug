import { expect, test } from "bun:test";
import { mergePhotoClassification } from "../src/lib/photo-order";

test("photo results keep new selections and do not restore a removed image", () => {
  const a = { id: "a", category: "outros" };
  const b = { id: "b", category: "outros" };
  const added = { id: "new", category: "outros" };
  expect(mergePhotoClassification([b, added], [a, b], [
    { index: 0, category: "fachada", order: 1 },
    { index: 1, category: "sala", order: 2 },
  ])).toEqual([{ ...b, category: "sala" }, added]);
});

test("an old request cannot replace another property's current gallery", () => {
  const current = [{ id: "other-property", category: "cozinha" }];
  expect(mergePhotoClassification(current, [{ id: "old-property", category: "outros" }], [
    { index: 0, category: "sala", order: 1 },
  ])).toEqual(current);
});

test("duplicate classification indices cannot duplicate or discard photos", () => {
  const selected = [{ id: "a", category: "outros" }, { id: "b", category: "outros" }];
  expect(mergePhotoClassification(selected, selected, [
    { index: 0, category: "sala", order: 1 },
    { index: 0, category: "sala", order: 2 },
  ])).toEqual([{ ...selected[0], category: "sala" }, selected[1]]);
});
