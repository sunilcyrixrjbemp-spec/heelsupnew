// ============================================================
// HeelsUp — Standard JSON Response Helpers
// ============================================================

export const ok = (data = {}, status = 200) =>
  Response.json({ success: true, ...data }, { status });

export const err = (message, status = 400) =>
  Response.json({ success: false, error: message }, { status });
