import OpenAI from "openai";
import { storage } from "../storage";
import type { 
  EnforcementCase, 
  EnforcementNotice, 
  EnforcementResponse,
  EnforcementTimeline,
  Agreement,
  Party,
  Person
} from "@shared/schema";

const AI_PROMPT_VERSION = "1.0.0";

export type AINoticeType = 
  | "notice_record" 
  | "notice_cure" 
  | "notice_default" 
  | "notice_estoppel" 
  | "affidavit_silence";

export interface RecordSnapshot {
  caseNumber: string;
  governingLaw: string;
  venue: string;
  counterparty: {
    name: string;
    type: string;
    address?: string;
    email?: string;
  } | null;
  counterpartyContacts: Array<{
    name: string;
    role: string;
    email?: string;
    phone?: string;
  }>;
  agreement: {
    title: string;
    type: string;
    status: string;
    effectiveDate?: string;
    maturityDate?: string;
    principalAmount?: string;
    currency?: string;
    notes?: string;
  } | null;
  noticeHistory: Array<{
    tier: string;
    title: string;
    status: string;
    createdAt: string;
    deliverySentAt?: string;
    deliveryConfirmedAt?: string;
    responseDeadlineDate?: string;
  }>;
  responses: Array<{
    receivedAt: string;
    receivedVia: string;
    classification?: string;
    sufficiency?: string;
    summary?: string;
  }>;
  timeline: Array<{
    eventType: string;
    occurredAt: string;
    description: string;
  }>;
  currentDate: string;
  responseDeadlineDays: number;
}

export interface AIGenerationResult {
  success: boolean;
  noticeType: AINoticeType;
  content: string;
  inputSnapshot: RecordSnapshot;
  model: string;
  promptVersion: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an Administrative Record Authoring AI for a legal/financial management system. You write neutral, jurisdiction-safe administrative instruments based strictly on supplied records.

MANDATORY RULES:
1. You do NOT invent facts. Only state what is explicitly provided in the input record.
2. You do NOT speculate about intentions, motives, or future events.
3. You do NOT threaten or use inflammatory language.
4. You do NOT provide legal advice or cite statutes unless explicitly provided.
5. You use a neutral, professional administrative tone suitable for court review.
6. You provide clear response/cure deadlines when applicable.
7. You include a "reservation of rights" clause (neutral).
8. You include a notarization block placeholder where appropriate.
9. Your output must be formatted for readability by a judge or court clerk.

Your role is to restate record facts in a formal administrative tone. You are a record compiler, not an advocate.`;

function getNoticePrompt(noticeType: AINoticeType, snapshot: RecordSnapshot, deadlineDays: number): string {
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);
  const deadlineDateStr = deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const baseContext = `
RECORD SNAPSHOT:
${JSON.stringify(snapshot, null, 2)}

RESPONSE DEADLINE: ${deadlineDateStr} (${deadlineDays} days from date of notice)
`;

  switch (noticeType) {
    case "notice_record":
      return `Generate an ADMINISTRATIVE NOTICE OF RECORD.

${baseContext}

REQUIREMENTS:
1. Title: "ADMINISTRATIVE NOTICE OF RECORD"
2. State the parties involved (creditor/administrator and counterparty)
3. Reference the agreement by title, date, and type
4. State the governing law and venue
5. Summarize the key obligations from the agreement if available
6. State that this notice establishes administrative record of the matter
7. Include response deadline and instructions for responding
8. Include reservation of rights clause
9. Include notarization block placeholder at the end

FORMAT:
- Use formal letter format
- Include date, reference number, and parties
- Use clear paragraph structure
- End with signature block and notary placeholder`;

    case "notice_cure":
      return `Generate an OPPORTUNITY TO CURE NOTICE.

${baseContext}

REQUIREMENTS:
1. Title: "NOTICE OF OPPORTUNITY TO CURE"
2. Reference any prior notices sent (from notice history)
3. State clearly what cure/performance is being requested
4. Provide specific deadline for cure (use the response deadline above)
5. State consequences of failure to cure (in neutral terms: "may result in declaration of default")
6. Explain how to communicate cure or respond
7. Include reservation of rights clause
8. Include notarization block placeholder

FORMAT:
- Use formal letter format
- Reference case number and prior notices
- Clear statement of what is required to cure
- Specific deadline`;

    case "notice_default":
      return `Generate a NOTICE OF DEFAULT AND DEMAND.

${baseContext}

REQUIREMENTS:
1. Title: "NOTICE OF DEFAULT AND DEMAND"
2. Reference the chronology of prior notices and deadlines (from notice history)
3. State facts only: what notices were sent, when, what deadlines passed
4. If no response was received, state "No written response was received as of [date]"
5. If responses were received but insufficient, reference them factually
6. Declare default based on record facts
7. State any demand for performance or remedy
8. Include response deadline for any final opportunity
9. Include reservation of rights clause
10. Include notarization block placeholder

FORMAT:
- Formal letter format
- Chronological fact recitation
- Clear declaration of default
- Demand statement`;

    case "notice_estoppel":
      return `Generate a NOTICE OF ESTOPPEL AND ADMINISTRATIVE DETERMINATION.

${baseContext}

REQUIREMENTS:
1. Title: "NOTICE OF ESTOPPEL AND ADMINISTRATIVE DETERMINATION"
2. Provide complete chronology of all notices and deadlines from notice history
3. State the doctrine of estoppel by silence/acquiescence in neutral terms
4. Reference each notice sent, method of delivery, and any proof of delivery
5. State factually: "No rebuttal or performance was received as of [date]" (only if true per record)
6. State that counterparty is estopped from denying the matters set forth
7. Reference governing law and venue
8. Include reservation of rights regarding further proceedings
9. Include notarization block placeholder

FORMAT:
- Formal letter format
- Numbered chronology of events
- Clear estoppel statement
- Legal venue reference`;

    case "affidavit_silence":
      return `Generate an AFFIDAVIT OF ADMINISTRATIVE NOTICE, NON-RESPONSE, AND ESTOPPEL BY SILENCE.

${baseContext}

REQUIREMENTS:
1. Title: "AFFIDAVIT OF ADMINISTRATIVE NOTICE, NON-RESPONSE, AND ESTOPPEL BY SILENCE"
2. First-person sworn statements by the affiant
3. Affiant role: "As record custodian/administrator for this matter"
4. Numbered paragraphs throughout
5. Chronology of each notice with dates, delivery method, and proof references
6. Explicit statement: "No written rebuttal or performance was received as of [DATE]" (only if true)
7. Statement that counterparty had full opportunity to respond
8. Statement regarding estoppel by silence
9. Jurat block: "Subscribed and sworn to before me this ___ day of _______, 20___"
10. Notary signature block with commission expiration placeholder

FORMAT:
- Affidavit format with numbered paragraphs
- First person: "I, the undersigned, being duly sworn, state:"
- Each fact as a separate numbered paragraph
- Jurat and notary block at end`;

    default:
      throw new Error(`Unknown notice type: ${noticeType}`);
  }
}

export async function assembleRecordSnapshot(
  enforcementCase: EnforcementCase,
  deadlineDays: number = 15
): Promise<RecordSnapshot> {
  let counterparty: RecordSnapshot["counterparty"] = null;
  let counterpartyContacts: RecordSnapshot["counterpartyContacts"] = [];
  let agreement: RecordSnapshot["agreement"] = null;

  if (enforcementCase.counterpartyId) {
    const party = await storage.getParty(enforcementCase.counterpartyId);
    if (party) {
      counterparty = {
        name: party.name,
        type: party.type,
        address: party.address || undefined,
        email: party.email || undefined
      };
      const persons = await storage.getPersonsByParty(party.id);
      counterpartyContacts = persons.map(p => ({
        name: p.name,
        role: p.role || "Contact",
        email: p.email || undefined,
        phone: p.phone || undefined
      }));
    }
  }

  if (enforcementCase.agreementId) {
    const agr = await storage.getAgreement(enforcementCase.agreementId);
    if (agr) {
      agreement = {
        title: agr.title,
        type: agr.type,
        status: agr.performanceStatus,
        effectiveDate: agr.effectiveDate || undefined,
        maturityDate: agr.maturityDate || undefined,
        principalAmount: agr.principalAmount ? String(agr.principalAmount) : undefined,
        currency: "USD",
        notes: agr.notes || undefined
      };
    }
  }

  const notices = await storage.getEnforcementNotices(enforcementCase.id);
  const noticeHistory = notices.map(n => ({
    tier: n.tier,
    title: n.title,
    status: n.status,
    createdAt: n.createdAt.toISOString(),
    deliverySentAt: n.deliverySentAt?.toISOString(),
    deliveryConfirmedAt: n.deliveryConfirmedAt?.toISOString(),
    responseDeadlineDate: n.responseDeadlineDate || undefined
  }));

  const responses = await storage.getEnforcementResponses(enforcementCase.id);
  const responseData = responses.map(r => ({
    receivedAt: r.receivedAt.toISOString(),
    receivedVia: r.receivedVia,
    classification: r.classification || undefined,
    sufficiency: r.sufficiency || undefined,
    summary: r.summary || undefined
  }));

  const timelineEvents = await storage.getEnforcementTimeline(enforcementCase.id);
  const timeline = timelineEvents.slice(0, 50).map(t => ({
    eventType: t.eventType,
    occurredAt: t.occurredAt.toISOString(),
    description: t.description
  }));

  return {
    caseNumber: enforcementCase.caseNumber,
    governingLaw: enforcementCase.governingLaw,
    venue: enforcementCase.venue,
    counterparty,
    counterpartyContacts,
    agreement,
    noticeHistory,
    responses: responseData,
    timeline,
    currentDate: new Date().toISOString(),
    responseDeadlineDays: deadlineDays
  };
}

export async function generateNoticeContent(
  noticeType: AINoticeType,
  caseId: string,
  deadlineDays: number = 15
): Promise<AIGenerationResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const enforcementCase = await storage.getEnforcementCase(caseId);
  if (!enforcementCase) {
    return {
      success: false,
      noticeType,
      content: "",
      inputSnapshot: {} as RecordSnapshot,
      model: "gpt-4o",
      promptVersion: AI_PROMPT_VERSION,
      error: "Enforcement case not found"
    };
  }

  const snapshot = await assembleRecordSnapshot(enforcementCase, deadlineDays);
  const userPrompt = getNoticePrompt(noticeType, snapshot, deadlineDays);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const content = completion.choices[0]?.message?.content || "";

    return {
      success: true,
      noticeType,
      content,
      inputSnapshot: snapshot,
      model: "gpt-4o",
      promptVersion: AI_PROMPT_VERSION
    };
  } catch (error: any) {
    return {
      success: false,
      noticeType,
      content: "",
      inputSnapshot: snapshot,
      model: "gpt-4o",
      promptVersion: AI_PROMPT_VERSION,
      error: error.message || "AI generation failed"
    };
  }
}

export function mapNoticeTypeToTier(noticeType: AINoticeType): string {
  switch (noticeType) {
    case "notice_record":
      return "tier1_administrative";
    case "notice_cure":
      return "tier2_opportunity";
    case "notice_default":
      return "tier3_default";
    case "notice_estoppel":
      return "tier4_estoppel";
    case "affidavit_silence":
      return "affidavit";
    default:
      return "unknown";
  }
}

export function getNoticeTitleFromType(noticeType: AINoticeType): string {
  switch (noticeType) {
    case "notice_record":
      return "Administrative Notice of Record";
    case "notice_cure":
      return "Notice of Opportunity to Cure";
    case "notice_default":
      return "Notice of Default and Demand";
    case "notice_estoppel":
      return "Notice of Estoppel and Administrative Determination";
    case "affidavit_silence":
      return "Affidavit of Administrative Notice, Non-Response, and Estoppel by Silence";
    default:
      return "Notice";
  }
}

export function validateNoticePrerequisites(
  noticeType: AINoticeType,
  existingNotices: EnforcementNotice[]
): { valid: boolean; error?: string } {
  const tierOrder = ["tier1_administrative", "tier2_opportunity", "tier3_default", "tier4_estoppel"];
  const targetTier = mapNoticeTypeToTier(noticeType);

  if (noticeType === "affidavit_silence") {
    const hasEstoppel = existingNotices.some(n => n.tier === "tier4_estoppel" && n.status === "sent");
    if (!hasEstoppel) {
      return { 
        valid: false, 
        error: "Affidavit requires an estoppel notice to have been sent first" 
      };
    }
    return { valid: true };
  }

  const targetIndex = tierOrder.indexOf(targetTier);
  if (targetIndex === -1) {
    return { valid: false, error: "Unknown notice tier" };
  }

  if (targetIndex === 0) {
    return { valid: true };
  }

  const previousTier = tierOrder[targetIndex - 1];
  const hasPreviousTier = existingNotices.some(n => 
    n.tier === previousTier && (n.status === "sent" || n.status === "notarized")
  );

  if (!hasPreviousTier) {
    return { 
      valid: false, 
      error: `Cannot generate ${noticeType}. Requires ${previousTier} to be sent or notarized first.` 
    };
  }

  return { valid: true };
}
