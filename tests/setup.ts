import { beforeAll, afterAll, vi } from "vitest";

// Set test environment
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret";

// Mock S3
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://mock-s3-url.com/test-file"),
}));

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "Test summary",
                    keyFindings: ["Finding 1", "Finding 2"],
                    recommendations: ["Recommendation 1"],
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

// Mock Stripe
vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: "cs_test_123",
            url: "https://checkout.stripe.com/test",
          }),
          retrieve: vi.fn().mockResolvedValue({
            id: "cs_test_123",
            payment_status: "paid",
            metadata: { userId: "test-user", credits: "100" },
          }),
        },
      },
      webhooks: {
        constructEvent: vi.fn().mockImplementation((payload, sig, secret) => ({
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123",
              payment_status: "paid",
              metadata: { userId: "test-user", credits: "100" },
            },
          },
        })),
      },
    })),
  };
});

beforeAll(() => {
  console.log("Test suite starting...");
});

afterAll(() => {
  console.log("Test suite completed.");
});
