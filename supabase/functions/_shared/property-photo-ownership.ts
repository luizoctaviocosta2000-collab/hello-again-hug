// SECURITY: A signed Storage URL is privileged. Never trust a photo row's
// storage_path merely because its property_id matches a public share link.
// The uploader writes: user UUID / property UUID / random UUID.extension.
const photoFilename = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|avif)$/i;

export function isOwnedPhotoPath(
  path: unknown,
  userId: string,
  propertyId: string,
): path is string {
  if (typeof path !== "string" || !userId || !propertyId) return false;
  const segments = path.split("/");
  return (
    segments.length === 3 &&
    segments[0] === userId &&
    segments[1] === propertyId &&
    photoFilename.test(segments[2] || "")
  );
}

type PhotoRow = { user_id: string; property_id: string; storage_path: string };

export function isOwnedPhotoRow<T extends PhotoRow>(
  row: T,
  userId: string,
  propertyId: string,
): boolean {
  return (
    row.user_id === userId &&
    row.property_id === propertyId &&
    isOwnedPhotoPath(row.storage_path, userId, propertyId)
  );
}
