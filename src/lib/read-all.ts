// Read every page explicitly; PostgREST otherwise truncates management lists.
// Callers must provide deterministic ordering and an already authorized client.
export async function readAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const data: T[] = [];
  for (;;) {
    const result = await page(data.length, data.length + 499);
    if (result.error) return { data: [], error: result.error };
    if (!result.data?.length) return { data, error: null };
    data.push(...result.data);
  }
}
