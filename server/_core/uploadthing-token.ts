// Normalize the UploadThing V7 token copied from its dashboard. Quick Copy
// emits an env assignment; accept the complete line or the bare value.
export function uploadThingToken(): string | undefined {
  let token = process.env.UPLOADTHING_TOKEN?.trim();
  if (!token) return undefined;

  token = token.replace(/^(?:export\s+)?UPLOADTHING_TOKEN\s*=\s*/i, "").trim();

  if (
    token.length >= 2 &&
    ((token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('"') && token.endsWith('"')))
  ) {
    token = token.slice(1, -1).trim();
  }

  return token || undefined;
}

/** Validate token shape without ever logging or returning its contents. */
export function uploadThingTokenHasV7Shape(token: string | undefined): boolean {
  if (!token) return false;

  try {
    const payload: unknown = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    if (payload === null || typeof payload !== "object") return false;

    const value = payload as Record<string, unknown>;
    return (
      typeof value.apiKey === "string" &&
      value.apiKey.startsWith("sk_") &&
      typeof value.appId === "string" &&
      value.appId.length > 0 &&
      Array.isArray(value.regions) &&
      value.regions.length > 0 &&
      value.regions.every(region => typeof region === "string" && region.length > 0)
    );
  } catch {
    return false;
  }
}