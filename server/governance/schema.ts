import { z } from "zod";

export const CapabilityRuleSchema = z.object({
  allow: z.boolean(),
  requiresSupervisor: z.boolean()
});

export const ClassificationRuleSchema = z.object({
  aiRead: z.boolean(),
  aiWrite: z.boolean()
});

export const GovernancePolicySchema = z.object({
  policyVersion: z.string().default("1.0"),
  aiAllowed: z.boolean().default(true),
  standing: z.object({
    client: z.enum(["ACTIVE", "RESTRICTED", "TERMINATED", "DISPUTED"]).optional()
  }).optional(),
  classificationRules: z.object({
    defaultClassification: z.string().optional(),
    artifactOverrides: z.record(ClassificationRuleSchema).optional()
  }).optional(),
  personas: z.object({
    allowList: z.array(z.string()).optional(),
    denyList: z.array(z.string()).optional()
  }).optional(),
  capabilities: z.record(CapabilityRuleSchema).optional(),
  scopeGuards: z.object({
    crossClientAccess: z.boolean().optional(),
    crossProjectAccess: z.boolean().optional()
  }).optional(),
  escalation: z.object({
    supervisorRequiredFor: z.array(z.string()).optional(),
    supervisorRoles: z.array(z.string()).optional()
  }).optional()
});

export type GovernancePolicyInput = z.infer<typeof GovernancePolicySchema>;

export function validatePolicy(input: unknown): GovernancePolicyInput {
  return GovernancePolicySchema.parse(input);
}

export function canonicalizeJSON(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

export function parsePolicy(policyJson: string): GovernancePolicyInput {
  try {
    const parsed = JSON.parse(policyJson);
    return validatePolicy(parsed);
  } catch (error) {
    throw new Error(`Invalid policy JSON: ${error}`);
  }
}
