export interface PreSaveCheckResult {
  status: "OK" | "ANOMALIE";
  table: string;
  m_rid: string | null;
  anomalies_count: number;
  errors: string[];
  can_save: boolean;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL_COMPLIANCE ?? "http://localhost:8080/compliance";

export async function preSaveCheck(
  tableName: string,
  payload: Record<string, unknown>
): Promise<PreSaveCheckResult> {
  const response = await fetch(`${BASE_URL}/pre-save-check/${encodeURIComponent(tableName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Erreur de validation pré-enregistrement");
  }

  return response.json();
}