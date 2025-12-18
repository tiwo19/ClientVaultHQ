import { Request, Response, NextFunction } from "express";
import { getPublishedPolicy, getPersonaByKey, logAIAction } from "../governance/registry";
import { mergePolicies, buildCapabilityMatrix } from "../governance/merge";
import { evaluateAction } from "../governance/evaluator";
import type { EvaluationContext, GovernancePolicyObject, EvaluationResult } from "../governance/types";

interface GovernanceOptions {
  actionType: string;
  extractClientId?: (req: Request) => string | undefined;
  extractProjectId?: (req: Request) => string | undefined;
  extractArtifactId?: (req: Request) => string | undefined;
  extractClassification?: (req: Request) => string | undefined;
}

export function enforceGovernance(options: GovernanceOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = options.extractClientId?.(req) || 
        req.params.clientId || 
        req.body?.clientId ||
        req.query?.clientId as string;
        
      const projectId = options.extractProjectId?.(req) || 
        req.params.projectId || 
        req.params.engagementId ||
        req.body?.projectId ||
        req.body?.engagementId ||
        req.query?.projectId as string ||
        req.query?.engagementId as string;
        
      const artifactId = options.extractArtifactId?.(req) || 
        req.params.artifactId || 
        req.params.documentId ||
        req.body?.artifactId ||
        req.body?.documentId ||
        req.query?.artifactId as string;

      const actorId = req.session?.userId;
      const actorType = req.headers["x-actor-type"] as string || "HUMAN";
      const personaKey = req.headers["x-persona-key"] as string || req.body?.personaKey;
      const artifactClassification = options.extractClassification?.(req) || 
        req.body?.classification ||
        req.query?.classification as string;

      const [globalPolicy, clientPolicy, projectPolicy, artifactPolicy] = await Promise.all([
        getPublishedPolicy("GLOBAL", null),
        clientId ? getPublishedPolicy("CLIENT", clientId) : Promise.resolve(null),
        projectId ? getPublishedPolicy("PROJECT", projectId) : Promise.resolve(null),
        artifactId ? getPublishedPolicy("ARTIFACT", artifactId) : Promise.resolve(null)
      ]);

      const effectivePolicy = mergePolicies(
        globalPolicy,
        clientPolicy,
        projectPolicy,
        artifactPolicy
      );

      const ctx: EvaluationContext = {
        clientId,
        projectId,
        artifactId,
        actorId,
        actorType: actorType as "HUMAN" | "AI" | "HYBRID",
        personaKey,
        actionType: options.actionType,
        artifactClassification,
        route: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("user-agent")
      };

      const result = evaluateAction(ctx, effectivePolicy);

      let personaId: string | undefined;
      if (personaKey) {
        const persona = await getPersonaByKey(personaKey);
        personaId = persona?.id;
      }

      const logEntry = await logAIAction(ctx, result, personaId);

      if (!result.allow) {
        return res.status(403).json({
          error: "GOVERNANCE_DENIED",
          actionType: options.actionType,
          requiresSupervisor: result.requiresSupervisor,
          reasons: result.reasons,
          nextSteps: result.requiresSupervisor 
            ? ["REQUEST_SUPERVISOR_APPROVAL"] 
            : ["CONTACT_ADMIN"],
          logId: logEntry.id
        });
      }

      if (result.requiresSupervisor) {
        const approvalToken = req.headers["x-supervisor-approval"] as string;
        
        if (!approvalToken) {
          return res.status(403).json({
            error: "GOVERNANCE_DENIED",
            actionType: options.actionType,
            requiresSupervisor: true,
            reasons: [{ 
              code: "SUPERVISOR_REQUIRED", 
              message: `${options.actionType} requires supervisor approval` 
            }],
            nextSteps: ["REQUEST_SUPERVISOR_APPROVAL"],
            logId: logEntry.id
          });
        }
      }

      (req as any).governanceContext = {
        effectivePolicy,
        capabilityMatrix: buildCapabilityMatrix(effectivePolicy),
        logEntry
      };

      next();
    } catch (error: any) {
      console.error("Governance middleware error:", error);
      return res.status(500).json({ 
        error: "GOVERNANCE_ERROR", 
        message: "Failed to evaluate governance policy" 
      });
    }
  };
}

export async function getEffectivePolicy(
  clientId?: string,
  projectId?: string,
  artifactId?: string
): Promise<{ effectivePolicy: GovernancePolicyObject; capabilityMatrix: Record<string, any> }> {
  const [globalPolicy, clientPolicy, projectPolicy, artifactPolicy] = await Promise.all([
    getPublishedPolicy("GLOBAL", null),
    clientId ? getPublishedPolicy("CLIENT", clientId) : Promise.resolve(null),
    projectId ? getPublishedPolicy("PROJECT", projectId) : Promise.resolve(null),
    artifactId ? getPublishedPolicy("ARTIFACT", artifactId) : Promise.resolve(null)
  ]);

  const effectivePolicy = mergePolicies(
    globalPolicy,
    clientPolicy,
    projectPolicy,
    artifactPolicy
  );

  return {
    effectivePolicy,
    capabilityMatrix: buildCapabilityMatrix(effectivePolicy)
  };
}

export async function previewDecision(
  clientId: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
  personaKey: string | undefined,
  actionType: string,
  actorId?: string
): Promise<EvaluationResult & { effectivePolicy: GovernancePolicyObject }> {
  const { effectivePolicy } = await getEffectivePolicy(clientId, projectId, artifactId);
  
  const ctx: EvaluationContext = {
    clientId,
    projectId,
    artifactId,
    actorId,
    actorType: "HUMAN",
    personaKey,
    actionType
  };

  const result = evaluateAction(ctx, effectivePolicy);
  
  return {
    ...result,
    effectivePolicy
  };
}
