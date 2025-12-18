import type { GovernancePolicyObject, CapabilityRule } from "./types";

export function mergePolicies(
  global: GovernancePolicyObject | null,
  client: GovernancePolicyObject | null,
  project: GovernancePolicyObject | null,
  artifact: GovernancePolicyObject | null
): GovernancePolicyObject {
  const policies = [global, client, project, artifact].filter(Boolean) as GovernancePolicyObject[];
  
  if (policies.length === 0) {
    return getDefaultPolicy();
  }

  const effective: GovernancePolicyObject = {
    policyVersion: "1.0",
    aiAllowed: true,
    standing: {},
    classificationRules: {
      defaultClassification: "CLIENT_PRIVATE",
      artifactOverrides: {}
    },
    personas: {
      allowList: [],
      denyList: []
    },
    capabilities: {},
    scopeGuards: {
      crossClientAccess: false,
      crossProjectAccess: false
    },
    escalation: {
      supervisorRequiredFor: [],
      supervisorRoles: ["ADMIN", "SUPERVISOR"]
    }
  };

  for (const policy of policies) {
    if (policy.aiAllowed === false) {
      effective.aiAllowed = false;
    }

    if (policy.standing?.client) {
      effective.standing!.client = policy.standing.client;
    }

    if (policy.classificationRules?.defaultClassification) {
      effective.classificationRules!.defaultClassification = policy.classificationRules.defaultClassification;
    }

    if (policy.classificationRules?.artifactOverrides) {
      Object.assign(effective.classificationRules!.artifactOverrides!, policy.classificationRules.artifactOverrides);
    }

    if (policy.personas?.allowList) {
      const currentAllowList = effective.personas!.allowList || [];
      if (currentAllowList.length === 0) {
        effective.personas!.allowList = [...policy.personas.allowList];
      } else {
        effective.personas!.allowList = currentAllowList.filter(p => 
          policy.personas!.allowList!.includes(p)
        );
      }
    }

    if (policy.personas?.denyList) {
      const combined = [...(effective.personas!.denyList || []), ...policy.personas.denyList];
      effective.personas!.denyList = Array.from(new Set(combined));
    }

    if (policy.capabilities) {
      for (const [action, rule] of Object.entries(policy.capabilities)) {
        const existing = effective.capabilities![action];
        if (!existing) {
          effective.capabilities![action] = { ...rule };
        } else {
          effective.capabilities![action] = mergeCapability(existing, rule);
        }
      }
    }

    if (policy.scopeGuards) {
      if (policy.scopeGuards.crossClientAccess === false) {
        effective.scopeGuards!.crossClientAccess = false;
      }
      if (policy.scopeGuards.crossProjectAccess === false) {
        effective.scopeGuards!.crossProjectAccess = false;
      }
    }

    if (policy.escalation?.supervisorRequiredFor) {
      const combined = [
        ...(effective.escalation!.supervisorRequiredFor || []),
        ...policy.escalation.supervisorRequiredFor
      ];
      effective.escalation!.supervisorRequiredFor = Array.from(new Set(combined));
    }

    if (policy.escalation?.supervisorRoles) {
      effective.escalation!.supervisorRoles = policy.escalation.supervisorRoles;
    }
  }

  return effective;
}

function mergeCapability(existing: CapabilityRule, incoming: CapabilityRule): CapabilityRule {
  return {
    allow: existing.allow && incoming.allow,
    requiresSupervisor: existing.requiresSupervisor || incoming.requiresSupervisor
  };
}

function getDefaultPolicy(): GovernancePolicyObject {
  return {
    policyVersion: "1.0",
    aiAllowed: false,
    standing: { client: "ACTIVE" },
    classificationRules: {
      defaultClassification: "CLIENT_PRIVATE",
      artifactOverrides: {
        ATTORNEY_PRIVILEGED: { aiRead: false, aiWrite: false },
        RESTRICTED: { aiRead: false, aiWrite: false }
      }
    },
    personas: {
      allowList: [],
      denyList: []
    },
    capabilities: {},
    scopeGuards: {
      crossClientAccess: false,
      crossProjectAccess: false
    },
    escalation: {
      supervisorRequiredFor: [],
      supervisorRoles: ["ADMIN", "SUPERVISOR"]
    }
  };
}

export function buildCapabilityMatrix(
  policy: GovernancePolicyObject
): Record<string, CapabilityRule> {
  const defaultActions = [
    "AI_SUMMARIZE",
    "AI_REWRITE",
    "AI_LEGAL_DRAFT",
    "AI_EXPORT",
    "AI_ANALYZE",
    "AI_ADVISOR"
  ];

  const matrix: Record<string, CapabilityRule> = {};

  for (const action of defaultActions) {
    const cap = policy.capabilities?.[action];
    if (cap) {
      matrix[action] = {
        allow: policy.aiAllowed && cap.allow,
        requiresSupervisor: cap.requiresSupervisor || 
          (policy.escalation?.supervisorRequiredFor?.includes(action) || false)
      };
    } else {
      matrix[action] = {
        allow: false,
        requiresSupervisor: policy.escalation?.supervisorRequiredFor?.includes(action) || false
      };
    }
  }

  return matrix;
}
