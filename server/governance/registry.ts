import { db } from "../db";
import { governancePolicies, aiPersonas, aiActionsLog, governanceApprovals } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { hashPolicy, hashLogRow } from "./hash";
import { parsePolicy, canonicalizeJSON } from "./schema";
import type { GovernancePolicyObject, EvaluationContext, EvaluationResult } from "./types";

export async function getPublishedPolicy(
  scopeType: string,
  scopeId: string | null
): Promise<GovernancePolicyObject | null> {
  const conditions = [
    eq(governancePolicies.scopeType, scopeType),
    eq(governancePolicies.status, "PUBLISHED")
  ];

  if (scopeId) {
    conditions.push(eq(governancePolicies.scopeId, scopeId));
  }

  const [policy] = await db
    .select()
    .from(governancePolicies)
    .where(and(...conditions))
    .orderBy(desc(governancePolicies.version))
    .limit(1);

  if (!policy) return null;

  return parsePolicy(policy.policyJson);
}

export async function publishPolicy(
  scopeType: string,
  scopeId: string | null,
  policyJson: GovernancePolicyObject,
  actorId: string
): Promise<{ id: string; version: number }> {
  await db
    .update(governancePolicies)
    .set({ status: "ARCHIVED" })
    .where(
      and(
        eq(governancePolicies.scopeType, scopeType),
        scopeId ? eq(governancePolicies.scopeId, scopeId) : undefined,
        eq(governancePolicies.status, "PUBLISHED")
      )
    );

  const [existing] = await db
    .select()
    .from(governancePolicies)
    .where(
      and(
        eq(governancePolicies.scopeType, scopeType),
        scopeId ? eq(governancePolicies.scopeId, scopeId) : undefined
      )
    )
    .orderBy(desc(governancePolicies.version))
    .limit(1);

  const newVersion = existing ? existing.version + 1 : 1;
  const policyString = JSON.stringify(policyJson);
  const hash = hashPolicy(policyString);

  const [inserted] = await db
    .insert(governancePolicies)
    .values({
      scopeType,
      scopeId,
      version: newVersion,
      status: "PUBLISHED",
      policyJson: policyString,
      createdBy: actorId,
      publishedAt: new Date(),
      hash
    })
    .returning({ id: governancePolicies.id, version: governancePolicies.version });

  return inserted;
}

export async function listPolicyVersions(
  scopeType: string,
  scopeId: string | null
) {
  const conditions = [eq(governancePolicies.scopeType, scopeType)];
  if (scopeId) {
    conditions.push(eq(governancePolicies.scopeId, scopeId));
  }

  return db
    .select()
    .from(governancePolicies)
    .where(and(...conditions))
    .orderBy(desc(governancePolicies.version));
}

export async function getPersonaByKey(key: string) {
  const [persona] = await db
    .select()
    .from(aiPersonas)
    .where(eq(aiPersonas.key, key))
    .limit(1);
  return persona;
}

export async function createPersona(data: {
  key: string;
  name: string;
  description?: string;
  capabilities?: string;
}) {
  const [persona] = await db
    .insert(aiPersonas)
    .values(data)
    .returning();
  return persona;
}

export async function getAllPersonas() {
  return db.select().from(aiPersonas);
}

export async function logAIAction(
  ctx: EvaluationContext,
  result: EvaluationResult,
  personaId?: string
) {
  const row = {
    clientId: ctx.clientId,
    projectId: ctx.projectId,
    artifactId: ctx.artifactId,
    actorType: ctx.actorType,
    actorId: ctx.actorId,
    personaId,
    actionType: ctx.actionType,
    requestContext: JSON.stringify({
      route: ctx.route,
      ip: ctx.ip,
      userAgent: ctx.userAgent
    }),
    decision: result.allow ? "ALLOW" : "DENY",
    reasons: JSON.stringify(result.reasons),
    requiresSupervisor: result.requiresSupervisor,
    hash: ""
  };

  row.hash = hashLogRow(row);

  const [logged] = await db
    .insert(aiActionsLog)
    .values(row)
    .returning();

  return logged;
}

export async function getAIActionsForContext(
  clientId?: string,
  projectId?: string,
  artifactId?: string
) {
  const conditions = [];
  if (clientId) conditions.push(eq(aiActionsLog.clientId, clientId));
  if (projectId) conditions.push(eq(aiActionsLog.projectId, projectId));
  if (artifactId) conditions.push(eq(aiActionsLog.artifactId, artifactId));

  return db
    .select()
    .from(aiActionsLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiActionsLog.createdAt))
    .limit(100);
}

export async function createApprovalRequest(
  aiActionsLogId: string,
  requestedBy: string
) {
  const [approval] = await db
    .insert(governanceApprovals)
    .values({
      aiActionsLogId,
      requestedBy,
      status: "PENDING"
    })
    .returning();
  return approval;
}

export async function reviewApproval(
  approvalId: string,
  reviewedBy: string,
  status: "APPROVED" | "REJECTED",
  notes?: string
) {
  const [updated] = await db
    .update(governanceApprovals)
    .set({
      reviewedBy,
      status,
      notes,
      reviewedAt: new Date()
    })
    .where(eq(governanceApprovals.id, approvalId))
    .returning();
  return updated;
}

export async function getPendingApproval(aiActionsLogId: string) {
  const [approval] = await db
    .select()
    .from(governanceApprovals)
    .where(
      and(
        eq(governanceApprovals.aiActionsLogId, aiActionsLogId),
        eq(governanceApprovals.status, "PENDING")
      )
    )
    .limit(1);
  return approval;
}
