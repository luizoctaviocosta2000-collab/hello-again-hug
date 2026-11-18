/** Collect a stable, owner-filtered query without silently accepting PostgREST's
 * row cap. Callers must order by a unique key and request count: "exact".
 * A changing count, duplicate row or failed page invalidates the entire result.
 * This detects common concurrent changes, but does not replace a DB snapshot.
 */
export async function completeQuery<T extends { id: string }>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
): Promise<{ data: T[] | null; error: unknown }> {
  try {
    const rows: T[] = [];
    const seen = new Set<string>();
    let total: number | null = null;
    for (;;) {
      const response = await page(rows.length, rows.length + 499);
      if (response.error) throw response.error;
      if (
        !Array.isArray(response.data) ||
        response.count === null ||
        !Number.isSafeInteger(response.count) ||
        response.count < 0
      )
        throw new Error("Não foi possível confirmar a quantidade de registros.");
      if (total !== null && total !== response.count)
        throw new Error("Os dados mudaram durante o carregamento. Tente novamente.");
      total = response.count;
      if (total > 100000)
        throw new Error("Volume de dados exige uma consulta agregada no servidor.");
      for (const row of response.data) {
        if (!row.id || seen.has(row.id))
          throw new Error("Os dados mudaram durante o carregamento. Tente novamente.");
        seen.add(row.id);
        rows.push(row);
      }
      if (rows.length === total) return { data: rows, error: null };
      if (rows.length > total || response.data.length === 0)
        throw new Error("A consulta retornou dados incompletos. Tente novamente.");
    }
  } catch (error) {
    return { data: null, error };
  }
}
