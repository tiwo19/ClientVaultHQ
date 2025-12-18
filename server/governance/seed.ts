import { db } from "../db";
import { governancePolicies, aiPersonas } from "@shared/schema";
import { hashPolicy } from "./hash";

export async function seedGovernanceData() {
  console.log("Seeding governance data...");

  const existingPersonas = await db.select().from(aiPersonas);
  if (existingPersonas.length === 0) {
    await db.insert(aiPersonas).values([
      {
        key: "DDIE",
        name: "Document Intelligence Engine",
        description: "AI persona for document analysis, summarization, and insights extraction",
        capabilities: JSON.stringify(["AI_SUMMARIZE", "AI_ANALYZE", "AI_ADVISOR"])
      },
      {
        key: "VAULT_SUMMARIZER",
        name: "Vault Summarizer",
        description: "AI persona for generating summaries of engagement content and activities",
        capabilities: JSON.stringify(["AI_SUMMARIZE", "AI_ADVISOR"])
      },
      {
        key: "LEGAL_DRAFTER",
        name: "Legal Document Drafter",
        description: "AI persona for drafting legal documents and letters",
        capabilities: JSON.stringify(["AI_LEGAL_DRAFT", "AI_REWRITE"])
      }
    ]);
    console.log("Created AI personas: DDIE, VAULT_SUMMARIZER, LEGAL_DRAFTER");
  }

  const existingPolicies = await db.select().from(governancePolicies);
  if (existingPolicies.length === 0) {
    const globalPolicy = {
      policyVersion: "1.0",
      aiAllowed: true,
      standing: { client: "ACTIVE" },
      classificationRules: {
        defaultClassification: "CLIENT_PRIVATE",
        artifactOverrides: {
          ATTORNEY_PRIVILEGED: { aiRead: false, aiWrite: false },
          RESTRICTED: { aiRead: false, aiWrite: false }
        }
      },
      personas: {
        allowList: ["DDIE", "VAULT_SUMMARIZER", "LEGAL_DRAFTER"],
        denyList: []
      },
      capabilities: {
        AI_SUMMARIZE: { allow: true, requiresSupervisor: false },
        AI_ANALYZE: { allow: true, requiresSupervisor: false },
        AI_ADVISOR: { allow: true, requiresSupervisor: false },
        AI_REWRITE: { allow: true, requiresSupervisor: true },
        AI_LEGAL_DRAFT: { allow: false, requiresSupervisor: true },
        AI_EXPORT: { allow: false, requiresSupervisor: true }
      },
      scopeGuards: {
        crossClientAccess: false,
        crossProjectAccess: false
      },
      escalation: {
        supervisorRequiredFor: ["AI_REWRITE", "AI_EXPORT", "AI_LEGAL_DRAFT"],
        supervisorRoles: ["ADMIN", "SUPERVISOR"]
      }
    };

    const policyString = JSON.stringify(globalPolicy);
    const hash = hashPolicy(policyString);

    await db.insert(governancePolicies).values({
      scopeType: "GLOBAL",
      scopeId: null,
      version: 1,
      status: "PUBLISHED",
      policyJson: policyString,
      publishedAt: new Date(),
      hash
    });

    console.log("Created GLOBAL governance policy");
  }

  console.log("Governance seed data complete");
}
