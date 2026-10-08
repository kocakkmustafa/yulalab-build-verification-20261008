/**
 * Reads a request body, stopping the moment it exceeds the cap.
 *
 * Extracted from the events route because the leads route re-made the bug it
 * was written for: checking `content-length` first only helps when the header
 * exists — `Number(null)` is 0 and `Number("abc")` is NaN, so a chunked or
 * header-less POST skips the check and the whole body is drained. Measured on
 * /api/leads before this: 8 MB pulled for a 16 KB cap.
 *
 * Reading incrementally and cancelling makes the bound true regardless of
 * what the client declares. Byte length, not string length: the cap is in
 * bytes and 2 000 multi-byte characters are ~4 KB.
 */
export async function readBounded(request: Request, maxBytes: number): Promise<string | null> {
  const body = request.body;
  if (!body) {
    const text = await request.text();
    return Buffer.byteLength(text, "utf8") > maxBytes ? null : text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
