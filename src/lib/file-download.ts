import { saveAs } from "file-saver";

async function fetchFileBlob(url: string): Promise<Blob> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao buscar arquivo: ${response.status}`);
  }

  return response.blob();
}

export async function downloadFileFromUrl(url: string, filename: string) {
  const blob = await fetchFileBlob(url);
  saveAs(blob, filename);
}

export async function openFileFromUrl(url: string) {
  const blob = await fetchFileBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  const openedWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    window.location.href = blobUrl;
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}