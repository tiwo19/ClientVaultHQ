// API client functions for backend integration

const API_URL = "/api";

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP error ${response.status}`);
  }
  return response.json();
}

// ==================== AUTH ====================

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include"
  });
  return handleResponse(response);
}

export async function logoutUser() {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  return handleResponse(response);
}

export async function getCurrentUser() {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: "include"
  });
  return handleResponse(response);
}

// ==================== USERS ====================

export async function fetchUsers() {
  const response = await fetch(`${API_URL}/users`, { credentials: "include" });
  return handleResponse(response);
}

export async function createUser(userData: { email: string; name: string; password: string; role: string }) {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
    credentials: "include"
  });
  return handleResponse(response);
}

export async function deleteUser(id: string) {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return handleResponse(response);
}

// ==================== PARTIES ====================

export async function fetchParties() {
  const response = await fetch(`${API_URL}/parties`, { credentials: "include" });
  return handleResponse(response);
}

export async function createParty(partyData: any) {
  const response = await fetch(`${API_URL}/parties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partyData),
    credentials: "include"
  });
  return handleResponse(response);
}

export async function deleteParty(id: string) {
  const response = await fetch(`${API_URL}/parties/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return handleResponse(response);
}

// ==================== PERSONS ====================

export async function fetchPersons() {
  const response = await fetch(`${API_URL}/persons`, { credentials: "include" });
  return handleResponse(response);
}

export async function createPerson(personData: { partyId: string; name: string; role: string; email: string; phone: string }) {
  const response = await fetch(`${API_URL}/persons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(personData),
    credentials: "include"
  });
  return handleResponse(response);
}

export async function deletePerson(id: string) {
  const response = await fetch(`${API_URL}/persons/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return handleResponse(response);
}

// ==================== AGREEMENTS ====================

export async function fetchAgreements() {
  const response = await fetch(`${API_URL}/agreements`, { credentials: "include" });
  return handleResponse(response);
}

export async function fetchAgreement(id: string) {
  const response = await fetch(`${API_URL}/agreements/${id}`, { credentials: "include" });
  return handleResponse(response);
}

export async function createAgreement(agreementData: any) {
  const response = await fetch(`${API_URL}/agreements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agreementData),
    credentials: "include"
  });
  return handleResponse(response);
}

export async function deleteAgreement(id: string) {
  const response = await fetch(`${API_URL}/agreements/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return handleResponse(response);
}

// ==================== ACTIVITIES ====================

export async function fetchActivities() {
  const response = await fetch(`${API_URL}/activities`, { credentials: "include" });
  return handleResponse(response);
}

// ==================== DOCUMENTS ====================

export async function fetchDocuments() {
  const response = await fetch(`${API_URL}/documents`, { credentials: "include" });
  return handleResponse(response);
}

export interface DocumentUploadOptions {
  file: File;
  agreementId?: string;
  partyId?: string;
  type?: string;
  category?: string;
  expirationDate?: string;
  notes?: string;
}

export async function uploadDocument(options: DocumentUploadOptions) {
  const { file, agreementId, partyId, type = "PDF", category = "Other", expirationDate, notes } = options;
  
  const formData = new FormData();
  formData.append("file", file);
  if (agreementId) formData.append("agreementId", agreementId);
  if (partyId) formData.append("partyId", partyId);
  formData.append("type", type);
  formData.append("category", category);
  if (expirationDate) formData.append("expirationDate", expirationDate);
  if (notes) formData.append("notes", notes);

  const response = await fetch(`${API_URL}/documents/upload`, {
    method: "POST",
    body: formData,
    credentials: "include"
  });
  return handleResponse(response);
}

export async function deleteDocument(id: string) {
  const response = await fetch(`${API_URL}/documents/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return handleResponse(response);
}

export function getDocumentDownloadUrl(id: string) {
  return `${API_URL}/documents/${id}/download`;
}
