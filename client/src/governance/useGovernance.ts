import { useQuery, useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

interface CapabilityRule {
  allow: boolean;
  requiresSupervisor: boolean;
}

interface GovernancePolicy {
  policyVersion: string;
  aiAllowed: boolean;
  capabilities?: Record<string, CapabilityRule>;
  [key: string]: unknown;
}

interface EffectivePolicyResponse {
  effectivePolicy: GovernancePolicy;
  capabilityMatrix: Record<string, CapabilityRule>;
}

interface PreviewResponse {
  allow: boolean;
  requiresSupervisor: boolean;
  reasons: Array<{ code: string; message: string; scope?: string }>;
}

interface CanResult {
  allow: boolean;
  requiresSupervisor: boolean;
  tooltip: string;
}

interface UseGovernanceOptions {
  clientId?: string;
  projectId?: string;
  artifactId?: string;
  personaKey?: string;
  enabled?: boolean;
}

export function useGovernance(options: UseGovernanceOptions = {}) {
  const { clientId, projectId, artifactId, personaKey, enabled = true } = options;

  const queryKey = useMemo(() => 
    ["governance", "effective", clientId, projectId, artifactId, personaKey],
    [clientId, projectId, artifactId, personaKey]
  );

  const { data, isLoading, error, refetch } = useQuery<EffectivePolicyResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clientId) params.append("clientId", clientId);
      if (projectId) params.append("projectId", projectId);
      if (artifactId) params.append("artifactId", artifactId);
      if (personaKey) params.append("personaKey", personaKey);

      const response = await fetch(`/api/governance/effective?${params}`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to fetch governance policy");
      }

      return response.json();
    },
    enabled: enabled,
    staleTime: 30000,
    gcTime: 60000
  });

  const previewMutation = useMutation<PreviewResponse, Error, { actionType: string }>({
    mutationFn: async ({ actionType }) => {
      const response = await fetch("/api/governance/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId,
          projectId,
          artifactId,
          personaKey,
          actionType
        })
      });

      if (!response.ok) {
        throw new Error("Failed to preview governance decision");
      }

      return response.json();
    }
  });

  const can = useCallback((actionType: string): CanResult => {
    if (isLoading || !data) {
      return { allow: false, requiresSupervisor: false, tooltip: "Loading..." };
    }

    const capability = data.capabilityMatrix[actionType];
    
    if (!capability) {
      return { 
        allow: false, 
        requiresSupervisor: false, 
        tooltip: `${actionType} is not defined in policy` 
      };
    }

    if (!data.effectivePolicy.aiAllowed) {
      return { 
        allow: false, 
        requiresSupervisor: false, 
        tooltip: "AI features are disabled" 
      };
    }

    if (!capability.allow) {
      return { 
        allow: false, 
        requiresSupervisor: capability.requiresSupervisor, 
        tooltip: `${actionType} is disabled by governance policy` 
      };
    }

    if (capability.requiresSupervisor) {
      return { 
        allow: true, 
        requiresSupervisor: true, 
        tooltip: `${actionType} requires supervisor approval` 
      };
    }

    return { 
      allow: true, 
      requiresSupervisor: false, 
      tooltip: "" 
    };
  }, [data, isLoading]);

  return {
    policy: data?.effectivePolicy,
    capabilityMatrix: data?.capabilityMatrix,
    loading: isLoading,
    error,
    can,
    preview: previewMutation.mutateAsync,
    refetch
  };
}

export function useGovernanceApproval() {
  const requestApprovalMutation = useMutation<
    { id: string },
    Error,
    { aiActionsLogId: string }
  >({
    mutationFn: async ({ aiActionsLogId }) => {
      const response = await fetch("/api/governance/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ aiActionsLogId })
      });

      if (!response.ok) {
        throw new Error("Failed to request approval");
      }

      return response.json();
    }
  });

  return {
    requestApproval: requestApprovalMutation.mutateAsync,
    isRequesting: requestApprovalMutation.isPending
  };
}
