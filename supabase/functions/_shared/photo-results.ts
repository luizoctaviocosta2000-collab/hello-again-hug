const categories = new Set(["fachada", "sala", "cozinha", "area_servico", "quarto", "banheiro", "varanda", "area_externa", "garagem", "condominio", "planta", "outros"]);

export function validatePhotoResults(value: unknown, count: number) {
  const photos = value && typeof value === "object" && "photos" in value ? value.photos : null;
  if (!Array.isArray(photos) || photos.length !== count) throw new Error("Classificação incompleta");
  const indices = new Set<number>();
  return photos.map((photo: unknown) => {
    if (!photo || typeof photo !== "object") throw new Error("Classificação inválida");
    const item = photo as { index?: unknown; category?: unknown; order?: unknown };
    if (typeof item.index !== "number" || !Number.isInteger(item.index) || item.index < 0 || item.index >= count || indices.has(item.index)) {
      throw new Error("A classificação deve incluir cada foto exatamente uma vez");
    }
    indices.add(item.index);
    const order = Number(item.order);
    return {
      index: item.index,
      category: typeof item.category === "string" && categories.has(item.category) ? item.category : "outros",
      order: Number.isFinite(order) && order > 0 ? order : item.index + 1,
    };
  });
}
