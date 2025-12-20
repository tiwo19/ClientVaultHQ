import { vi } from "vitest";

export const mockOpenAIResponses = {
  documentAnalysis: {
    summary: "Test document analysis summary",
    keyFindings: ["Finding 1: Important clause", "Finding 2: Risk identified"],
    recommendations: ["Review clause 3.2", "Consider amendment"],
    extractedData: {
      parties: ["Party A", "Party B"],
      dates: ["2024-01-01", "2025-01-01"],
      amounts: ["$100,000"],
    },
  },
  
  noticeGeneration: {
    subject: "Notice of Default",
    body: "Dear Counterparty,\n\nThis notice is to inform you...",
    legalCitations: ["UCC 9-601", "State Contract Law"],
  },
  
  fraudAnalysis: {
    indicators: [
      {
        code: "FI-001",
        confidence: "medium",
        summary: "Potential identity discrepancy detected",
        observedFacts: ["Name variation in documents"],
        openQuestions: ["Verify identity documents"],
      },
    ],
    riskScore: 25,
    recommendation: "Further investigation recommended",
  },
  
  aiAdvisor: {
    response: "Based on my analysis of the engagement...",
    suggestions: ["Consider reviewing document X", "Schedule follow-up"],
    confidence: 0.85,
  },
};

export const createMockOpenAI = () => ({
  chat: {
    completions: {
      create: vi.fn().mockImplementation(async ({ messages }) => {
        const lastMessage = messages[messages.length - 1]?.content || "";
        
        // Determine response based on context
        let response = mockOpenAIResponses.aiAdvisor;
        
        if (lastMessage.includes("analyze") || lastMessage.includes("document")) {
          response = mockOpenAIResponses.documentAnalysis;
        } else if (lastMessage.includes("notice") || lastMessage.includes("default")) {
          response = mockOpenAIResponses.noticeGeneration;
        } else if (lastMessage.includes("fraud") || lastMessage.includes("indicator")) {
          response = mockOpenAIResponses.fraudAnalysis;
        }
        
        return {
          choices: [
            {
              message: {
                content: JSON.stringify(response),
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        };
      }),
    },
  },
});
