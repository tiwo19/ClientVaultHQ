import OpenAI from "openai";
import { storage } from "../storage";
import type { 
  EnforcementCase, 
  EnforcementNotice, 
  EnforcementDocument,
  EnforcementResponse,
  EnforcementTimeline,
  FraudIndicator,
  FraudFinding
} from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CaseSnapshot {
  case: EnforcementCase;
  notices: EnforcementNotice[];
  documents: EnforcementDocument[];
  responses: EnforcementResponse[];
  timeline: EnforcementTimeline[];
  agreement?: any;
  party?: any;
}

interface SuggestedFinding {
  indicatorCode: string;
  confidence: "low" | "medium" | "high";
  summary: string;
  observedFacts: string[];
  openQuestions: string[];
  evidenceCitations: string[];
}

interface AIAnalysisResult {
  suggestedFindings: SuggestedFinding[];
  overallRiskAssessment: string;
  investigativeRecommendations: string[];
}

async function assembleCaseSnapshot(caseId: string): Promise<CaseSnapshot | null> {
  const enforcementCase = await storage.getEnforcementCase(caseId);
  if (!enforcementCase) return null;

  const [notices, documents, responses, timeline] = await Promise.all([
    storage.getEnforcementNotices(caseId),
    storage.getEnforcementDocuments(caseId),
    storage.getEnforcementResponses(caseId),
    storage.getEnforcementTimeline(caseId)
  ]);

  let agreement, party;
  if (enforcementCase.agreementId) {
    agreement = await storage.getAgreement(enforcementCase.agreementId);
  }
  if (enforcementCase.counterpartyId) {
    party = await storage.getParty(enforcementCase.counterpartyId);
  }

  return {
    case: enforcementCase,
    notices,
    documents,
    responses,
    timeline,
    agreement,
    party
  };
}

function formatSnapshotForAI(snapshot: CaseSnapshot, indicators: FraudIndicator[]): string {
  const sections: string[] = [];

  sections.push("=== ENFORCEMENT CASE RECORD ===");
  sections.push(`Case Number: ${snapshot.case.caseNumber}`);
  sections.push(`Status: ${snapshot.case.status}`);
  sections.push(`Governing Law: ${snapshot.case.governingLaw}`);
  sections.push(`Venue: ${snapshot.case.venue}`);
  sections.push(`Current Notice Tier: ${snapshot.case.currentNoticeTier || "None"}`);
  sections.push(`Evidence Locked: ${snapshot.case.evidenceLock ? "Yes" : "No"}`);

  if (snapshot.agreement) {
    sections.push("\n=== UNDERLYING AGREEMENT ===");
    sections.push(`Title: ${snapshot.agreement.title}`);
    sections.push(`Type: ${snapshot.agreement.type}`);
    sections.push(`Principal Amount: ${snapshot.agreement.principalAmount}`);
    sections.push(`Effective Date: ${snapshot.agreement.effectiveDate}`);
    sections.push(`Governing Law: ${snapshot.agreement.governingLaw}`);
  }

  if (snapshot.party) {
    sections.push("\n=== COUNTERPARTY ===");
    sections.push(`Name: ${snapshot.party.name}`);
    sections.push(`Type: ${snapshot.party.type}`);
    sections.push(`Jurisdiction: ${snapshot.party.jurisdictionOfFormation || "Unknown"}`);
  }

  if (snapshot.notices.length > 0) {
    sections.push("\n=== NOTICES SENT ===");
    snapshot.notices.forEach((n, i) => {
      sections.push(`${i + 1}. ${n.title} (${n.tier}) - Status: ${n.status}`);
      sections.push(`   Deadline: ${n.responseDeadlineDate || "N/A"}`);
      sections.push(`   Delivery: ${n.deliveryMethod} | Confirmed: ${n.deliveryConfirmedAt ? "Yes" : "No"}`);
    });
  }

  if (snapshot.responses.length > 0) {
    sections.push("\n=== COUNTERPARTY RESPONSES ===");
    snapshot.responses.forEach((r, i) => {
      sections.push(`${i + 1}. Received: ${r.receivedAt} via ${r.receivedVia}`);
      sections.push(`   Classification: ${r.classification || "Unclassified"}`);
      sections.push(`   Summary: ${r.summary || "No summary"}`);
      sections.push(`   Sufficiency: ${r.sufficiency || "Not assessed"}`);
    });
  }

  if (snapshot.documents.length > 0) {
    sections.push("\n=== EVIDENCE DOCUMENTS ===");
    snapshot.documents.forEach((d, i) => {
      sections.push(`${i + 1}. [${d.category || "uncategorized"}] ${d.name}`);
      sections.push(`   Notes: ${d.notes || "No notes"}`);
    });
  }

  if (snapshot.timeline.length > 0) {
    sections.push("\n=== TIMELINE (Last 20 Events) ===");
    snapshot.timeline.slice(0, 20).forEach(t => {
      sections.push(`- ${t.occurredAt}: [${t.eventType}] ${t.description}`);
    });
  }

  sections.push("\n=== AVAILABLE FRAUD INDICATOR CODES ===");
  indicators.forEach(ind => {
    sections.push(`${ind.code}: ${ind.description} (Severity: ${ind.severityWeight})`);
  });

  return sections.join("\n");
}

const SYSTEM_PROMPT = `You are an internal fraud analysis assistant for a legal/financial back-office system. Your role is to identify potential fraud and criminal indicators based ONLY on the documented evidence provided.

CRITICAL RULES:
1. NEVER accuse anyone of fraud or criminal conduct - only identify "indicators" or "observations"
2. NEVER invent or speculate about facts not in the record
3. Every observation MUST be tied to specific evidence in the case file
4. Use neutral, analytical language (e.g., "The record indicates..." or "Evidence suggests...")
5. Identify what additional evidence would strengthen or clarify each finding
6. This analysis is INTERNAL ONLY and not for external distribution

When analyzing, consider:
- Misrepresentations that induced the agreement
- Unusual fund flows or payment redirections
- Identity discrepancies or authority questions
- Communication patterns suggesting intent
- Regulatory compliance issues
- Patterns suggesting multiple victims

Your output must be valid JSON matching the following structure:
{
  "suggestedFindings": [
    {
      "indicatorCode": "CODE_FROM_LIST",
      "confidence": "low" | "medium" | "high",
      "summary": "Brief neutral description of the indicator",
      "observedFacts": ["Fact 1 from record", "Fact 2 from record"],
      "openQuestions": ["Question about missing evidence"],
      "evidenceCitations": ["Reference to document/notice/response"]
    }
  ],
  "overallRiskAssessment": "Brief neutral assessment of the overall pattern",
  "investigativeRecommendations": ["Recommendation 1", "Recommendation 2"]
}

If no indicators are present based on the evidence, return an empty suggestedFindings array.`;

export async function analyzeCase(caseId: string): Promise<AIAnalysisResult | null> {
  const snapshot = await assembleCaseSnapshot(caseId);
  if (!snapshot) {
    throw new Error("Enforcement case not found");
  }

  const indicators = await storage.getAllFraudIndicators();
  if (indicators.length === 0) {
    throw new Error("No fraud indicators configured - run seed first");
  }

  const recordText = formatSnapshotForAI(snapshot, indicators);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { 
        role: "user", 
        content: `Analyze the following enforcement case record for potential fraud and criminal indicators. Only identify indicators supported by the documented evidence.\n\n${recordText}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI analyst");
  }

  try {
    const result = JSON.parse(content) as AIAnalysisResult;
    return result;
  } catch (error) {
    console.error("Failed to parse AI analyst response:", content);
    throw new Error("Invalid response format from AI analyst");
  }
}

export async function initializeAssessment(
  caseId: string, 
  userId: string
): Promise<{ assessmentId: string; findings: FraudFinding[] }> {
  const existingAssessment = await storage.getFraudAssessmentByCase(caseId);
  if (existingAssessment && existingAssessment.status !== "closed") {
    throw new Error("Active assessment already exists for this case");
  }

  const analysis = await analyzeCase(caseId);
  if (!analysis) {
    throw new Error("Failed to analyze case");
  }

  const indicators = await storage.getAllFraudIndicators();
  const indicatorMap = new Map(indicators.map(i => [i.code, i]));

  const version = existingAssessment ? existingAssessment.version + 1 : 1;
  const assessment = await storage.createFraudAssessment({
    enforcementCaseId: caseId,
    version,
    status: "draft",
    scoreTotal: 0,
    thresholdLevel: "none",
    createdByUserId: userId
  });

  const createdFindings: FraudFinding[] = [];

  for (const suggested of analysis.suggestedFindings) {
    const indicator = indicatorMap.get(suggested.indicatorCode);
    if (!indicator) {
      console.warn(`Unknown indicator code: ${suggested.indicatorCode}`);
      continue;
    }

    const finding = await storage.createFraudFinding({
      fraudAssessmentId: assessment.id,
      fraudIndicatorId: indicator.id,
      confidence: suggested.confidence,
      summary: suggested.summary,
      observedFacts: JSON.stringify(suggested.observedFacts),
      openQuestions: JSON.stringify(suggested.openQuestions),
      evidenceLinks: JSON.stringify([]),
      active: false,
      createdByUserId: userId
    });

    createdFindings.push(finding);
  }

  await storage.createEnforcementTimelineEvent({
    caseId,
    eventType: "FraudAssessmentInitiated",
    description: `Fraud assessment v${version} initialized with ${createdFindings.length} suggested indicators`,
    createdById: userId,
    occurredAt: new Date()
  });

  return { assessmentId: assessment.id, findings: createdFindings };
}

const CONFIDENCE_MULTIPLIERS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3
};

const THRESHOLD_CONFIG = {
  watch: 10,
  elevated: 25,
  referral_ready: 45
};

export async function recalculateScore(assessmentId: string): Promise<{
  scoreTotal: number;
  thresholdLevel: string;
}> {
  const activeFindings = await storage.getActiveFraudFindings(assessmentId);
  const indicators = await storage.getAllFraudIndicators();
  const indicatorMap = new Map(indicators.map(i => [i.id, i]));

  let scoreTotal = 0;
  for (const finding of activeFindings) {
    const indicator = indicatorMap.get(finding.fraudIndicatorId);
    if (!indicator) continue;

    const multiplier = CONFIDENCE_MULTIPLIERS[finding.confidence] || 1;
    scoreTotal += indicator.severityWeight * multiplier;
  }

  let thresholdLevel = "none";
  if (scoreTotal >= THRESHOLD_CONFIG.referral_ready) {
    thresholdLevel = "referral_ready";
  } else if (scoreTotal >= THRESHOLD_CONFIG.elevated) {
    thresholdLevel = "elevated";
  } else if (scoreTotal >= THRESHOLD_CONFIG.watch) {
    thresholdLevel = "watch";
  }

  await storage.updateFraudAssessment(assessmentId, {
    scoreTotal,
    thresholdLevel
  });

  return { scoreTotal, thresholdLevel };
}

export function validateEvidenceForActivation(
  finding: FraudFinding,
  indicator: FraudIndicator
): { valid: boolean; missingTypes: string[] } {
  const requiredTypes: string[] = indicator.requiredEvidenceTypes 
    ? JSON.parse(indicator.requiredEvidenceTypes) 
    : [];

  if (requiredTypes.length === 0) {
    return { valid: true, missingTypes: [] };
  }

  const evidenceLinks: Array<{ type: string; id: string }> = finding.evidenceLinks 
    ? JSON.parse(finding.evidenceLinks) 
    : [];

  const providedTypes = new Set(evidenceLinks.map(e => e.type));
  const missingTypes = requiredTypes.filter(t => !providedTypes.has(t));

  return {
    valid: missingTypes.length === 0 || evidenceLinks.length > 0,
    missingTypes
  };
}
