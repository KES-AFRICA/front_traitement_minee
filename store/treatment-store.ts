// store/treatment-store.ts (Zustand)
import { create } from 'zustand';

interface TreatmentStore {
  treatedFeeders: Set<string>;
  markFeederTreated: (id: string) => void;
}

export const useTreatmentStore = create<TreatmentStore>((set) => ({
  treatedFeeders: new Set(),
  markFeederTreated: (id) =>
    set((s) => ({ treatedFeeders: new Set(s.treatedFeeders).add(id) })),
}));