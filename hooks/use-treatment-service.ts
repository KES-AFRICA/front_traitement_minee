// hooks/use-treatment-service.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AssignTreatmentRequest,
  StartTreatmentRequest,
  CompleteTreatmentRequest,
  ValidateTreatmentRequest,
  RejectTreatmentRequest,
  AttributeUpdateRequest,
  SetCollectingRequest,
  SetPendingRequest,
  SetPendingValidationRequest,
} from '@/lib/types/treatment-service';
import { treatmentApi } from '@/lib/api/services/treatment-service';
import { useAuth } from '@/lib/auth/context';
import { userService } from '@/lib/api/services/users';

export const treatmentKeys = {
  all: ['treatments'] as const,
  feedersWithSource: (filterByAgent?: boolean) => 
    [...treatmentKeys.all, 'feeders-source', { filterByAgent }] as const,
  status: (feederId: string) => [...treatmentKeys.all, 'status', feederId] as const,
  agentTreatments: (agentId: string) => [...treatmentKeys.all, 'agent', agentId] as const,
  attributeHistory: (feederId: string) => [...treatmentKeys.all, 'history', feederId] as const,
  recordHistory: (tableName: string, recordId: string) => [...treatmentKeys.all, 'record-history', tableName, recordId] as const,
  tables: () => [...treatmentKeys.all, 'tables'] as const,
  dashboardStats: () => [...treatmentKeys.all, 'dashboard-stats'] as const,
  allUsers: () => [...treatmentKeys.all, 'users'] as const,
};

export const useFeedersWithSource = (filterByAgent: boolean = false) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: treatmentKeys.feedersWithSource(filterByAgent),
    queryFn: async () => {
      const data = await treatmentApi.getFeedersWithSource();
      
      if (filterByAgent && user && user.role !== 'Admin' && user.role !== 'Chef équipe') {
        return {
          ...data,
          feeders: data.feeders.filter(
            feeder => feeder.assigned_agent_id === user.id
          )
        };
      }
      
      return data;
    },
  });
};

export const useAllUsers = () => {
  return useQuery({
    queryKey: treatmentKeys.allUsers(),
    queryFn: async () => {
      const response = await userService.getUsers();
      if (response.error) throw new Error(response.error);
      return response.data;
    },
  });
};

export const useTreatmentStatus = (feederId: string) => {
  return useQuery({
    queryKey: treatmentKeys.status(feederId),
    queryFn: () => treatmentApi.getTreatmentStatus(feederId),
    enabled: !!feederId,
  });
};

export const useAgentTreatments = (agentId: string) => {
  return useQuery({
    queryKey: treatmentKeys.agentTreatments(agentId),
    queryFn: () => treatmentApi.getAgentTreatments(agentId),
    enabled: !!agentId,
  });
};

export const useAttributeHistory = (feederId: string, limit?: number) => {
  return useQuery({
    queryKey: treatmentKeys.attributeHistory(feederId),
    queryFn: () => treatmentApi.getAttributeHistory(feederId, limit),
    enabled: !!feederId,
  });
};

export const useRecordHistory = (tableName: string, recordId: string, limit?: number) => {
  return useQuery({
    queryKey: treatmentKeys.recordHistory(tableName, recordId),
    queryFn: () => treatmentApi.getRecordHistory(tableName, recordId, limit),
    enabled: !!tableName && !!recordId,
  });
};

export const useTables = () => {
  return useQuery({
    queryKey: treatmentKeys.tables(),
    queryFn: () => treatmentApi.getTables(),
  });
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: treatmentKeys.dashboardStats(),
    queryFn: () => treatmentApi.getDashboardStats(),
    refetchInterval: 30000,
  });
};

export const useAssignTreatment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: AssignTreatmentRequest) => treatmentApi.assignTreatment(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.allUsers() });
    },
  });
};

export const useStartTreatment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: StartTreatmentRequest) => treatmentApi.startTreatment(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboardStats() });
    },
  });
};

export const useCompleteTreatment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: CompleteTreatmentRequest) => treatmentApi.completeTreatment(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboardStats() });
    },
  });
};

// NOUVEAU HOOK : Mettre en attente de validation
export const useSetPendingValidation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SetPendingValidationRequest) => treatmentApi.setPendingValidation(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboardStats() });
    },
  });
};

export const useValidateTreatment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: ValidateTreatmentRequest) => treatmentApi.validateTreatment(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboardStats() });
    },
  });
};

export const useRejectTreatment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: RejectTreatmentRequest) => treatmentApi.rejectTreatment(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboardStats() });
    },
  });
};

// NOUVEAU HOOK : Mettre en attente de traitement (après collecte)
export const useSetPending = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SetPendingRequest) => treatmentApi.setPending(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboardStats() });
    },
  });
};

// NOUVEAU HOOK : Mettre en cours de collecte (état initial)
export const useSetCollecting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SetCollectingRequest) => treatmentApi.setCollecting(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboardStats() });
    },
  });
};

export const useUpdateAttribute = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: AttributeUpdateRequest) => treatmentApi.updateAttribute(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.attributeHistory(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};