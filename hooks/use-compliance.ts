import { useMutation } from "@tanstack/react-query";
import { preSaveCheck, PreSaveCheckResult } from "@/lib/api/services/complianceService";

interface PreSaveCheckParams {
  tableName: string;
  payload: Record<string, unknown>;
}

export const usePreSaveCheck = () => {
  return useMutation<PreSaveCheckResult, Error, PreSaveCheckParams>({
    mutationFn: ({ tableName, payload }) => preSaveCheck(tableName, payload),
  });
};