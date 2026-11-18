import { expect, test } from "bun:test";
import { createReleaseMarker } from "../build/release-marker";
const sha = "a".repeat(40);
test("clean build identifies exact source commit", () => {
  expect(createReleaseMarker(sha, false).commit_sha).toBe(sha);
});
test("dirty, missing and conflicting source identities fail closed", () => {
  for (const marker of [
    createReleaseMarker(sha, true),
    createReleaseMarker(null, false),
    createReleaseMarker(sha, false, "b".repeat(40)),
  ]) {
    expect(marker.commit_sha).toBeNull();
    expect(marker.verification).toBe("unverifiable");
  }
});
test("archive builds accept an explicit valid pipeline SHA only", () => {
  expect(createReleaseMarker(null, false, sha).commit_sha).toBe(sha);
  expect(createReleaseMarker(null, false, "main").commit_sha).toBeNull();
});
