import { z } from "zod";

export const GovernanceScopeType = z.enum(["GLOBAL", "CLIENT", "PROJECT", "ARTIFACT"]);
export type GovernanceScopeType = z.infer<typeof GovernanceScopeType>;

export const GovernancePolicyStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type GovernancePolicyStatus = z.infer<typeof GovernancePolicyStatus>;

export const ActorType = z.enum(["HUMAN", "AI", "HYBRID"]);
export type ActorType = z.infer<typeof ActorType>;

export const AIDecision = z.enum(["ALLOW", "DENY"]);
export type AIDecision = z.infer<typeof AIDecision>;

export const AIActionType = z.enum([
  "AI_SUMMARIZE",
  "AI_REWRITE",
  "AI_LEGAL_DRAFT",
  "AI_EXPORT",
  "AI_ANALYZE",
  "AI_ADVISOR"
]);
export type AIActionType = z.infer<typeof AIActionType>;

export const ClientStanding = z.enum(["ACTIVE", "RESTRICTED", "TERMINATED", "DISPUTED"]);
export type ClientStanding = z.infer<typeof ClientStanding>;

export const ArtifactClassification = z.enum([
  "PUBLIC",
  "CLIENT_PRIVATE",
  "CONFIDENTIAL",
  "ATTORNEY_PRIVILEGED",
  "RESTRICTED"
]);
export type ArtifactClassification = z.infer<typeof ArtifactClassification>;

export interface CapabilityRule {
  allow: boolean;
  requiresSupervisor: boolean;
}

export interface ClassificationRule {
  aiRead: boolean;
  aiWrite: boolean;
}

export interface GovernancePolicyObject {
  policyVersion: string;
  aiAllowed: boolean;
  standing?: {
    client?: string;
  };
  classificationRules?: {
    defaultClassification?: string;
    artifactOverrides?: Record<string, ClassificationRule>;
  };
  personas?: {
    allowList?: string[];
    denyList?: string[];
  };
  capabilities?: Record<string, CapabilityRule>;
  scopeGuards?: {
    crossClientAccess?: boolean;
    crossProjectAccess?: boolean;
  };
  escalation?: {
    supervisorRequiredFor?: string[];
    supervisorRoles?: string[];
  };
}

export interface EvaluationContext {
  clientId?: string;
  projectId?: string;
  artifactId?: string;
  actorId?: string;
  actorType: ActorType;
  personaKey?: string;
  actionType: string;
  artifactClassification?: string;
  route?: string;
  ip?: string;
  userAgent?: string;
}

export interface EvaluationResult {
  allow: boolean;
  reasons: GovernanceReason[];
  requiresSupervisor: boolean;
}

export interface GovernanceReason {
  code: string;
  message: string;
  scope?: string;
}

export interface EffectivePolicy {
  effectivePolicy: GovernancePolicyObject;
  capabilityMatrix: Record<string, CapabilityRule>;
}
