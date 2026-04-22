import { useMutation } from "@tanstack/react-query";
import { preSaveCheck, PreSaveCheckResult, preSaveTreeCheck, PreSaveTreeResult } from "@/lib/api/services/complianceService";

interface PreSaveCheckParams {
  tableName: string;
  payload: Record<string, unknown>;
}

export const usePreSaveCheck = () => {
  return useMutation<PreSaveCheckResult, Error, PreSaveCheckParams>({
    mutationFn: ({ tableName, payload }) => preSaveCheck(tableName, payload),
  });
};

interface PreSaveTreeCheckParams {
  parentTable: string;
  payload: Record<string, unknown>;
}

export const usePreSaveTreeCheck = () => {
  return useMutation<PreSaveTreeResult, Error, PreSaveTreeCheckParams>({
    mutationFn: ({ parentTable, payload }) => preSaveTreeCheck(parentTable, payload),
  });
};