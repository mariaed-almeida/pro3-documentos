import { Submission, StatusDocumento } from "./types";

const STORAGE_KEY = "pro3_submissions";

export function getSubmissions(): Submission[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function addSubmission(submission: Submission): void {
  const submissions = getSubmissions();
  submissions.push(submission);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

export function updateSubmissionStatus(id: string, status: StatusDocumento): void {
  const submissions = getSubmissions();
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx !== -1) {
    submissions[idx].status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  }
}

export function getSubmissionsByCliente(cliente: string): Submission[] {
  return getSubmissions().filter((s) => s.cliente === cliente);
}

export function getSubmissionById(id: string): Submission | undefined {
  return getSubmissions().find((s) => s.id === id);
}

// File storage simulation - in production use Supabase Storage
const FILE_STORAGE_KEY = "pro3_files";

export function storeFileReference(submissionId: string, docType: string, fileName: string): void {
  const files = JSON.parse(localStorage.getItem(FILE_STORAGE_KEY) || "{}");
  if (!files[submissionId]) files[submissionId] = {};
  files[submissionId][docType] = fileName;
  localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(files));
}

export function getFileReferences(submissionId: string): Record<string, string> {
  const files = JSON.parse(localStorage.getItem(FILE_STORAGE_KEY) || "{}");
  return files[submissionId] || {};
}
