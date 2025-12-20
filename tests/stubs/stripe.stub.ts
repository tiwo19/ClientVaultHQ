import { vi } from "vitest";

export const STRIPE_TEST_WEBHOOK_SECRET = "whsec_test_secret_123";

export const mockStripeCheckoutSession = {
  id: "cs_test_123456789",
  url: "https://checkout.stripe.com/pay/cs_test_123456789",
  payment_status: "paid",
  metadata: {
    userId: "test-user-id",
    credits: "100",
  },
};

export const mockStripeWebhookEvent = {
  id: "evt_test_123",
  type: "checkout.session.completed",
  data: {
    object: mockStripeCheckoutSession,
  },
};

export const createMockStripe = () => ({
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({
        id: mockStripeCheckoutSession.id,
        url: mockStripeCheckoutSession.url,
      }),
      retrieve: vi.fn().mockResolvedValue(mockStripeCheckoutSession),
    },
  },
  webhooks: {
    constructEvent: vi.fn().mockImplementation((payload, signature, secret) => {
      if (signature !== "valid_signature") {
        throw new Error("Invalid signature");
      }
      return mockStripeWebhookEvent;
    }),
  },
  customers: {
    create: vi.fn().mockResolvedValue({
      id: "cus_test_123",
      email: "test@example.com",
    }),
  },
});
