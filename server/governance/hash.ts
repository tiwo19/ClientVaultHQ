import { createHash } from "crypto";
import { canonicalizeJSON } from "./schema";

export function hashPolicy(policyJson: string): string {
  const canonical = canonicalizeJSON(JSON.parse(policyJson));
  return createHash("sha256").update(canonical).digest("hex");
}

export function hashLogRow(row: Record<string, unknown>): string {
  const rowWithoutHash = { ...row };
  delete rowWithoutHash.hash;
  delete rowWithoutHash.id;
  delete rowWithoutHash.createdAt;
  
  const canonical = canonicalizeJSON(rowWithoutHash);
  return createHash("sha256").update(canonical).digest("hex");
}
