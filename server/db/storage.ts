// Storage helpers backed by UploadThing.
// storagePut uploads a file and returns its permanent public URL.

import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const fileName = relKey.split("/").pop() ?? relKey;
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const file = new File([blob], fileName, { type: contentType });
  const res = await utapi.uploadFiles(file);

  if (res.error || !res.data) {
    throw new Error(`UploadThing upload failed: ${res.error?.message ?? "unknown"}`);
  }
  return { key: res.data.key, url: res.data.ufsUrl };
}
