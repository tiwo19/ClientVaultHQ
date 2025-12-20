import { vi } from "vitest";

export const mockS3Client = {
  send: vi.fn().mockResolvedValue({}),
};

export const mockGetSignedUrl = vi.fn().mockResolvedValue(
  "https://mock-s3-presigned-url.com/document.pdf"
);

export function isS3Configured(): boolean {
  return false; // Always use local storage in tests
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  return `s3://test-bucket/${key}`;
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  return `https://mock-s3-presigned-url.com/${key}?expires=${expiresIn}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  // No-op in tests
}

export function generateS3Key(originalName: string): string {
  return `test-documents/${Date.now()}-${originalName}`;
}
