import fs from "fs";
import path from "path";

export interface PreparedArtifact {
  fileType: "image" | "pdf" | "docx";
  mimeType: string;
  displayName: string;
  extractedText: string | null;
  imageDataUrl: string | null;
  originalPath: string;
}

export interface PreprocessingError {
  code: "UNSUPPORTED_TYPE" | "PASSWORD_PROTECTED" | "CORRUPTED" | "EXTRACTION_FAILED";
  message: string;
}

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const SUPPORTED_DOC_EXTENSIONS = [".pdf", ".docx"];
const MAX_TEXT_LENGTH = 15000;

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function truncateText(text: string, maxLength: number = MAX_TEXT_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "\n...[text truncated]...";
}

async function processImage(filePath: string, ext: string): Promise<PreparedArtifact> {
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString("base64");
  const mimeType = getMimeType(ext);
  
  return {
    fileType: "image",
    mimeType,
    displayName: path.basename(filePath),
    extractedText: null,
    imageDataUrl: `data:${mimeType};base64,${base64}`,
    originalPath: filePath
  };
}

async function processPdf(filePath: string): Promise<PreparedArtifact> {
  const fileBuffer = fs.readFileSync(filePath);
  
  try {
    const pdfParseModule = await import("pdf-parse") as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const pdfData = await pdfParse(fileBuffer);
    const extractedText = pdfData.text?.trim() || "";
    
    if (extractedText.length < 50) {
      const base64 = fileBuffer.toString("base64");
      return {
        fileType: "pdf",
        mimeType: "application/pdf",
        displayName: path.basename(filePath),
        extractedText: extractedText.length > 0 ? extractedText : "Unable to extract text from PDF - may be scanned or image-based.",
        imageDataUrl: `data:application/pdf;base64,${base64}`,
        originalPath: filePath
      };
    }
    
    return {
      fileType: "pdf",
      mimeType: "application/pdf",
      displayName: path.basename(filePath),
      extractedText: truncateText(extractedText),
      imageDataUrl: null,
      originalPath: filePath
    };
  } catch (error: any) {
    if (error.message?.includes("password") || error.message?.includes("encrypted")) {
      throw { code: "PASSWORD_PROTECTED", message: "This PDF is password-protected and cannot be processed." } as PreprocessingError;
    }
    throw { code: "CORRUPTED", message: "Could not read PDF file. It may be corrupted." } as PreprocessingError;
  }
}

async function processDocx(filePath: string): Promise<PreparedArtifact> {
  try {
    const mammothModule = await import("mammoth");
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ path: filePath });
    const extractedText = result.value?.trim() || "";
    
    if (extractedText.length === 0) {
      throw { code: "EXTRACTION_FAILED", message: "Could not extract text from DOCX file." } as PreprocessingError;
    }
    
    return {
      fileType: "docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      displayName: path.basename(filePath),
      extractedText: truncateText(extractedText),
      imageDataUrl: null,
      originalPath: filePath
    };
  } catch (error: any) {
    if ((error as PreprocessingError).code) {
      throw error;
    }
    throw { code: "CORRUPTED", message: "Could not read DOCX file. It may be corrupted." } as PreprocessingError;
  }
}

export async function prepareForAnalysis(
  filePath: string,
  originalName: string
): Promise<PreparedArtifact> {
  const ext = path.extname(originalName).toLowerCase();
  
  if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    return processImage(filePath, ext);
  }
  
  if (ext === ".pdf") {
    return processPdf(filePath);
  }
  
  if (ext === ".docx") {
    return processDocx(filePath);
  }
  
  throw {
    code: "UNSUPPORTED_TYPE",
    message: `File type ${ext} is not supported. Please upload an image (PNG, JPG, GIF, WebP), PDF, or DOCX file.`
  } as PreprocessingError;
}

export function isPreprocessingError(error: any): error is PreprocessingError {
  return error && typeof error.code === "string" && typeof error.message === "string";
}
