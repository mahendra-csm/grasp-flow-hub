import { describe, expect, it } from "vitest";
import { webhookLeadPayloadSchema } from "@/lib/webhook-leads";

describe("webhookLeadPayloadSchema", () => {
  it("accepts valid webhook lead payload", () => {
    const value = webhookLeadPayloadSchema.parse({
      full_name: "Mahendra Kumar",
      email: "mahendra@example.com",
      source: "Website",
      external_id: "lead-001",
      custom_data: { form_name: "Contact" },
    });

    expect(value.full_name).toBe("Mahendra Kumar");
  });

  it("rejects missing full_name", () => {
    const result = webhookLeadPayloadSchema.safeParse({ email: "a@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = webhookLeadPayloadSchema.safeParse({
      full_name: "Test User",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
