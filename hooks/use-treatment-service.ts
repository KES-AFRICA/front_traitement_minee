// hooks/use-treatment-service.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
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
  // Types pour l'insertion
  FeederCreate,
  SubstationCreate,
  WireCreate,
  BayCreate,
  PowerTransformerCreate,
  SwitchCreate,
  BusbarCreate,
} from '@/lib/types/treatment-service';
import { treatmentApi, DashboardStats, WeeklyTrend, ActivityItem, AgentStat, TaskDistribution, DashboardAllData } from '@/lib/api/services/treatment-service';
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
  
  // Dashboard keys - CORRIGÉ
  dashboard: {
    all: ['dashboard'] as const,
    stats: (startDate?: Date, endDate?: Date) => [...treatmentKeys.dashboard.all, 'stats', { startDate, endDate }] as const,
    weeklyTrend: (startDate?: Date, endDate?: Date) => [...treatmentKeys.dashboard.all, 'weekly-trend', { startDate, endDate }] as const,
    recentActivity: (limit?: number, startDate?: Date, endDate?: Date) => [...treatmentKeys.dashboard.all, 'recent-activity', { limit, startDate, endDate }] as const,
    agentStats: (startDate?: Date, endDate?: Date) => [...treatmentKeys.dashboard.all, 'agent-stats', { startDate, endDate }] as const,
    taskDistribution: () => [...treatmentKeys.dashboard.all, 'task-distribution'] as const,
    allData: (startDate?: Date, endDate?: Date) => [...treatmentKeys.dashboard.all, 'all-data', { startDate, endDate }] as const,
  },
  
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

// ============================================================
// MUTATIONS POUR LA GESTION DES TRAITEMENTS
// ============================================================

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
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.all });
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
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.all });
    },
  });
};

export const useSetPendingValidation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SetPendingValidationRequest) => treatmentApi.setPendingValidation(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.all });
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
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.all });
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
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.all });
    },
  });
};

export const useSetPending = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SetPendingRequest) => treatmentApi.setPending(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.all });
    },
  });
};

export const useSetCollecting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SetCollectingRequest) => treatmentApi.setCollecting(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.feeder_id) });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.all });
    },
  });
};

export const useHideRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tableName, recordId }: { tableName: string; recordId: string }) => 
      treatmentApi.hideRecord(tableName, recordId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
      queryClient.invalidateQueries({ queryKey: treatmentKeys.status(variables.recordId) });
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

// ============================================================
// HOOKS D'INSERTION
// ============================================================

export const useInsertFeeder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: FeederCreate) => treatmentApi.insertFeeder(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};

export const useInsertSubstation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SubstationCreate) => treatmentApi.insertSubstation(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};

export const useInsertWire = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: WireCreate) => treatmentApi.insertWire(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};

export const useInsertBay = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: BayCreate) => treatmentApi.insertBay(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};

export const useInsertPowerTransformer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: PowerTransformerCreate) => treatmentApi.insertPowerTransformer(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};

export const useInsertSwitch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: SwitchCreate) => treatmentApi.insertSwitch(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};

export const useInsertBusbar = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: BusbarCreate) => treatmentApi.insertBusbar(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentKeys.feedersWithSource() });
    },
  });
};

// ============================================================
// HOOKS DASHBOARD AVEC CACHE D'UNE JOURNÉE
// ============================================================

// Cache de 24 heures (86400000 ms)
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export const useDashboardStats = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: treatmentKeys.dashboard.stats(startDate, endDate),
    queryFn: () => treatmentApi.getDashboardStats(startDate, endDate),
    staleTime: ONE_DAY_IN_MS,
    gcTime: ONE_DAY_IN_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};

export const useWeeklyTrend = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: treatmentKeys.dashboard.weeklyTrend(startDate, endDate),
    queryFn: () => treatmentApi.getWeeklyTrend(startDate, endDate),
    staleTime: ONE_DAY_IN_MS,
    gcTime: ONE_DAY_IN_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};

export const useRecentActivity = (limit: number = 10, startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: treatmentKeys.dashboard.recentActivity(limit, startDate, endDate),
    queryFn: () => treatmentApi.getRecentActivity(limit, startDate, endDate),
    staleTime: ONE_DAY_IN_MS,
    gcTime: ONE_DAY_IN_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};

export const useAgentStats = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: treatmentKeys.dashboard.agentStats(startDate, endDate),
    queryFn: () => treatmentApi.getAgentStats(startDate, endDate),
    staleTime: ONE_DAY_IN_MS,
    gcTime: ONE_DAY_IN_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};

export const useTaskDistribution = () => {
  return useQuery({
    queryKey: treatmentKeys.dashboard.taskDistribution(),
    queryFn: () => treatmentApi.getTaskDistribution(),
    staleTime: ONE_DAY_IN_MS,
    gcTime: ONE_DAY_IN_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};

// Hook principal qui regroupe toutes les données du dashboard - CORRIGÉ
export const useAllDashboardData = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: treatmentKeys.dashboard.allData(startDate, endDate),
    queryFn: () => treatmentApi.getAllDashboardData(startDate, endDate),
    staleTime: ONE_DAY_IN_MS,
    gcTime: ONE_DAY_IN_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};

// ============================================================
// HOOK POUR FORCER LE REFRESH (URGENCE)
// ============================================================

export const useRefreshDashboard = () => {
  const queryClient = useQueryClient();

  const refreshAllDashboardData = async () => {
    // Récupérer toutes les clés de cache dashboard
    const dashboardKeys = queryClient.getQueryCache().getAll()
      .filter(cache => {
        const key = cache.queryKey;
        return key[0] === 'dashboard' || (key[0] === 'treatments' && key[1] === 'dashboard');
      })
      .map(cache => cache.queryKey);

    // Forcer le refetch de chaque clé
    await Promise.all(
      dashboardKeys.map(key => 
        queryClient.refetchQueries({ queryKey: key, type: 'active' })
      )
    );
  };

  const refreshSpecificDashboardData = async (options?: {
    stats?: boolean;
    weeklyTrend?: boolean;
    recentActivity?: boolean;
    agentStats?: boolean;
    taskDistribution?: boolean;
    all?: boolean;
  }) => {
    const refreshPromises = [];

    if (options?.all || options?.stats) {
      refreshPromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.stats() }));
    }
    if (options?.all || options?.weeklyTrend) {
      refreshPromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.weeklyTrend() }));
    }
    if (options?.all || options?.recentActivity) {
      refreshPromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.recentActivity() }));
    }
    if (options?.all || options?.agentStats) {
      refreshPromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.agentStats() }));
    }
    if (options?.all || options?.taskDistribution) {
      refreshPromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.taskDistribution() }));
    }

    await Promise.all(refreshPromises);
  };

  return {
    refreshAllDashboardData,
    refreshSpecificDashboardData,
  };
};

// Hook utilitaire pour le refresh manuel (bouton d'urgence)
export const useManualRefresh = () => {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const manualRefresh = useCallback(async (options?: {
    force?: boolean;
    specific?: ('stats' | 'weeklyTrend' | 'recentActivity' | 'agentStats' | 'taskDistribution')[];
  }) => {
    setIsRefreshing(true);
    try {
      if (options?.force) {
        // Force refresh: supprimer le cache et refetch
        await queryClient.resetQueries({ queryKey: treatmentKeys.dashboard.all });
      }
      
      // Invalider les requêtes spécifiques
      const invalidatePromises = [];
      
      if (!options?.specific || options.specific.includes('stats')) {
        invalidatePromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.stats() }));
      }
      if (!options?.specific || options.specific.includes('weeklyTrend')) {
        invalidatePromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.weeklyTrend() }));
      }
      if (!options?.specific || options.specific.includes('recentActivity')) {
        invalidatePromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.recentActivity() }));
      }
      if (!options?.specific || options.specific.includes('agentStats')) {
        invalidatePromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.agentStats() }));
      }
      if (!options?.specific || options.specific.includes('taskDistribution')) {
        invalidatePromises.push(queryClient.invalidateQueries({ queryKey: treatmentKeys.dashboard.taskDistribution() }));
      }
      
      await Promise.all(invalidatePromises);
      
      // Optionnel: faire un refetch immédiat
      if (options?.force) {
        await queryClient.refetchQueries({ queryKey: treatmentKeys.dashboard.all });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return { manualRefresh, isRefreshing };
};