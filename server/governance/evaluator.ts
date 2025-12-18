import type { EvaluationContext, EvaluationResult, GovernanceReason, GovernancePolicyObject } from "./types";

export function evaluateAction(
  ctx: EvaluationContext,
  effectivePolicy: GovernancePolicyObject
): EvaluationResult {
  const reasons: GovernanceReason[] = [];
  let allow = true;
  let requiresSupervisor = false;

  if (!effectivePolicy.aiAllowed) {
    return {
      allow: false,
      reasons: [{ code: "AI_DISABLED", message: "AI is disabled at this scope" }],
      requiresSupervisor: false
    };
  }

  if (effectivePolicy.standing?.client === "TERMINATED") {
    return {
      allow: false,
      reasons: [{ code: "CLIENT_TERMINATED", message: "Client account is terminated" }],
      requiresSupervisor: false
    };
  }

  if (effectivePolicy.standing?.client === "DISPUTED") {
    const disputedBlocked = ["AI_REWRITE", "AI_EXPORT", "AI_LEGAL_DRAFT"];
    if (disputedBlocked.includes(ctx.actionType)) {
      return {
        allow: false,
        reasons: [{ 
          code: "CLIENT_DISPUTED", 
          message: `${ctx.actionType} is blocked for disputed clients` 
        }],
        requiresSupervisor: false
      };
    }
  }

  if (ctx.personaKey) {
    if (effectivePolicy.personas?.denyList?.includes(ctx.personaKey)) {
      return {
        allow: false,
        reasons: [{ 
          code: "PERSONA_DENIED", 
          message: `Persona ${ctx.personaKey} is on the deny list` 
        }],
        requiresSupervisor: false
      };
    }

    if (effectivePolicy.personas?.allowList && effectivePolicy.personas.allowList.length > 0) {
      if (!effectivePolicy.personas.allowList.includes(ctx.personaKey)) {
        return {
          allow: false,
          reasons: [{ 
            code: "PERSONA_NOT_ALLOWED", 
            message: `Persona ${ctx.personaKey} is not on the allow list` 
          }],
          requiresSupervisor: false
        };
      }
    }
  }

  if (ctx.artifactClassification) {
    const classificationRules = effectivePolicy.classificationRules?.artifactOverrides?.[ctx.artifactClassification];
    if (classificationRules) {
      const isReadAction = ["AI_SUMMARIZE", "AI_ANALYZE", "AI_ADVISOR"].includes(ctx.actionType);
      const isWriteAction = ["AI_REWRITE", "AI_LEGAL_DRAFT", "AI_EXPORT"].includes(ctx.actionType);
      
      if (isReadAction && !classificationRules.aiRead) {
        return {
          allow: false,
          reasons: [{ 
            code: "CLASSIFICATION_DENIED", 
            message: `AI read operations are blocked for ${ctx.artifactClassification} artifacts` 
          }],
          requiresSupervisor: false
        };
      }
      
      if (isWriteAction && !classificationRules.aiWrite) {
        return {
          allow: false,
          reasons: [{ 
            code: "CLASSIFICATION_DENIED", 
            message: `AI write operations are blocked for ${ctx.artifactClassification} artifacts` 
          }],
          requiresSupervisor: false
        };
      }
    }
  }

  const capability = effectivePolicy.capabilities?.[ctx.actionType];
  
  if (!capability) {
    return {
      allow: false,
      reasons: [{ 
        code: "CAPABILITY_NOT_DEFINED", 
        message: `Action ${ctx.actionType} is not defined in policy (defaults to deny)` 
      }],
      requiresSupervisor: false
    };
  }

  if (!capability.allow) {
    return {
      allow: false,
      reasons: [{ 
        code: "CAPABILITY_DENIED", 
        message: `${ctx.actionType} is disabled` 
      }],
      requiresSupervisor: capability.requiresSupervisor
    };
  }

  if (capability.requiresSupervisor || 
      effectivePolicy.escalation?.supervisorRequiredFor?.includes(ctx.actionType)) {
    requiresSupervisor = true;
  }

  return {
    allow,
    reasons,
    requiresSupervisor
  };
}
