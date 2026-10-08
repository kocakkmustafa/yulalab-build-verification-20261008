import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deliverableEventTypes,
  mailTransport,
  missingTemplates,
  sendgridTransport,
  type MailMessage,
} from "@/server/mail";
import {
  APPROVED_MAIL_IDENTITY,
  MAIL_IDENTITY_ENV,
  type MailIdentity,
} from "@/server/mail-identity";
import {
  DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV,
} from "@/server/data-request-token";

const message: MailMessage = {
  outboxId: "11111111-1111-1111-1111-111111111111",
  eventType: "lead_receipt",
  to: "ada@example.com",
  locale: "tr",
  data: { receiptId: "YL-1", locale: "tr" },
};

const IDENTITY: MailIdentity = {
  fromEmail: "hello@yulalab.com",
  fromName: "YULALAB",
  replyToEmail: "yula@yulalab.com",
};

const TEMPLATE_IDS = {
  SENDGRID_TEMPLATE_LEAD_RECEIPT_TR: "d-cef2371a06014280857d0f17e3056305",
  SENDGRID_TEMPLATE_LEAD_RECEIPT_EN: "d-d42d50b22fda48e49cfbb6ab373f420e",
  SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR: "d-2ce67d70cec249aeab61577361a50572",
  SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR: "d-934e79bac8f841dfb7066e169d8f4ffc",
  SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN: "d-e9aeeaa9dc8949679777b61eed0f41dc",
} as const;

function respondWith(status: number, body = "") {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

function configureIdentity({ internal = false }: { internal?: boolean } = {}) {
  process.env[MAIL_IDENTITY_ENV.fromEmail] = APPROVED_MAIL_IDENTITY.fromEmail;
  process.env[MAIL_IDENTITY_ENV.fromName] = APPROVED_MAIL_IDENTITY.fromName;
  process.env[MAIL_IDENTITY_ENV.replyToEmail] = APPROVED_MAIL_IDENTITY.replyToEmail;
  if (internal) {
    process.env[MAIL_IDENTITY_ENV.internalAddress] = APPROVED_MAIL_IDENTITY.internalAddress;
  }
}

function configureTemplates() {
  for (const [key, value] of Object.entries(TEMPLATE_IDS)) process.env[key] = value;
}

beforeEach(() => {
  for (const key of [
    "LEADS_ENABLED",
    "SENDGRID_API_KEY",
    "MAIL_FROM",
    "LEADS_INTERNAL_ADDRESS",
    ...Object.values(MAIL_IDENTITY_ENV),
    ...Object.keys(TEMPLATE_IDS),
    DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
    DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
    DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV,
    DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV,
  ]) {
    delete process.env[key];
  }
});

describe("the provider call", () => {
  it("throws on a rejection instead of counting as delivered", async () => {
    configureTemplates();
    const transport = sendgridTransport("SG.key", IDENTITY, respondWith(429));
    await expect(transport.send(message)).rejects.toThrow(/429/);
  });

  it("keeps provider, identity and capability values out of the error", async () => {
    configureTemplates();
    const verificationUrl = "https://yulalab.com/data-request/verify#token=capability-canary";
    const transport = sendgridTransport(
      "SG.super-secret",
      IDENTITY,
      respondWith(
        400,
        JSON.stringify({
          errors: [{ message: `bad address ada@example.com at ${verificationUrl}` }],
        }),
      ),
    );
    const error = await transport.send({
      ...message,
      eventType: "data_request_verification",
      data: { requestType: "access", verificationUrl },
    }).catch((caught: Error) => caught);
    expect(String(error)).not.toContain("SG.super-secret");
    expect(String(error)).not.toContain("ada@example.com");
    expect(String(error)).not.toContain(verificationUrl);
    expect(String(error)).not.toContain(IDENTITY.fromEmail);
    expect(String(error)).not.toContain(IDENTITY.fromName);
    expect(String(error)).not.toContain(IDENTITY.replyToEmail);
    expect(String(error)).not.toContain(
      TEMPLATE_IDS.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR,
    );
  });

  it("uses the structured identity and personalization-scoped dynamic data", async () => {
    configureTemplates();
    const fetchImpl = respondWith(202);
    await sendgridTransport("SG.key", IDENTITY, fetchImpl).send(message);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);

    expect(body.personalizations[0].to[0].email).toBe("ada@example.com");
    expect(body.from).toEqual({ email: "hello@yulalab.com", name: "YULALAB" });
    expect(body.reply_to).toEqual({ email: "yula@yulalab.com" });
    expect(body).not.toHaveProperty("reply_to_list");
    expect(body.personalizations[0].dynamic_template_data).toEqual({
      receiptId: "YL-1",
      locale: "tr",
    });
    expect(body).not.toHaveProperty("dynamic_template_data");
    expect(body.tracking_settings).toEqual({
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    });
    expect(body.personalizations[0].custom_args).toEqual({
      yulalab_outbox_id: message.outboxId,
    });
  });

  it("allowlists dynamic data and keeps recipient PII only in the to envelope", async () => {
    configureTemplates();
    const fetchImpl = respondWith(202);
    const recipient = "recipient-canary@example.net";
    await sendgridTransport("SG.key", IDENTITY, fetchImpl).send({
      ...message,
      to: recipient,
      data: {
        receiptId: "YL-ALLOW",
        locale: "tr",
        name: "name-canary",
        email: recipient,
        company: "company-canary",
        message: "message-canary",
        productSlug: "product-canary",
      },
    });

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.personalizations[0].dynamic_template_data).toEqual({
      receiptId: "YL-ALLOW",
      locale: "tr",
    });
    const withoutEnvelope = structuredClone(body);
    delete withoutEnvelope.personalizations[0].to;
    expect(JSON.stringify(withoutEnvelope)).not.toContain(recipient);
    for (const canary of [
      "name-canary",
      "company-canary",
      "message-canary",
      "product-canary",
    ]) {
      expect(JSON.stringify(body)).not.toContain(canary);
    }
  });
});

describe("which transport this deployment gets", () => {
  it("is unconfigured with no credentials", () => {
    expect(mailTransport().configured).toBe(false);
  });

  it("stays configured for accepted work when new intake is closed", () => {
    process.env.SENDGRID_API_KEY = "SG.key";
    configureIdentity();
    expect(mailTransport().configured).toBe(true);
  });

  it("is unconfigured with a key but no canonical identity", () => {
    process.env.LEADS_ENABLED = "1";
    process.env.SENDGRID_API_KEY = "SG.key";
    expect(mailTransport().configured).toBe(false);
  });

  it("does not accept the two legacy identity keys as fallback", () => {
    process.env.SENDGRID_API_KEY = "SG.key";
    process.env.MAIL_FROM = "hello@yulalab.com";
    process.env.LEADS_INTERNAL_ADDRESS = "yula@yulalab.com";
    expect(mailTransport().configured).toBe(false);
  });

  it("is configured once the base identity is, and names missing templates", () => {
    process.env.LEADS_ENABLED = "1";
    process.env.SENDGRID_API_KEY = "SG.key";
    configureIdentity();
    expect(mailTransport().configured).toBe(true);
    expect(missingTemplates()).toEqual([
      "SENDGRID_TEMPLATE_LEAD_RECEIPT_TR",
      "SENDGRID_TEMPLATE_LEAD_RECEIPT_EN",
      DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
      DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
    ]);
  });

  it("does not let an internal-route address stop customer receipts", () => {
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR;
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN = TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN;
    expect(deliverableEventTypes()).toEqual(["lead_receipt"]);

    process.env[MAIL_IDENTITY_ENV.internalAddress] = APPROVED_MAIL_IDENTITY.internalAddress;
    expect(missingTemplates()).toEqual([
      "SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR",
      DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
      DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
    ]);
    expect(deliverableEventTypes()).toEqual(["lead_receipt"]);

    process.env.SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR =
      TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR;
    expect(missingTemplates()).toEqual([
      DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
      DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
    ]);
    expect(deliverableEventTypes()).toEqual(["lead_receipt", "lead_internal_route"]);
  });

  it("keeps receipts and verification deliverable when the internal address is invalid", () => {
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR;
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN = TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN;
    process.env.SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR =
      TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR;
    process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR =
      TEMPLATE_IDS.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR;
    process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN =
      TEMPLATE_IDS.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN;
    process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "2026-08-current";
    process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] =
      "test-only-current-data-request-secret-32-bytes";
    process.env[MAIL_IDENTITY_ENV.internalAddress] = "other@yulalab.com";

    expect(deliverableEventTypes()).toEqual(["lead_receipt", "data_request_verification"]);
  });

  it("requires the server-only token secret and both verification templates", () => {
    process.env.LEADS_ENABLED = "1";
    process.env.SENDGRID_API_KEY = "SG.key";
    configureIdentity();
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR;
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN = TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN;
    expect(deliverableEventTypes()).not.toContain("data_request_verification");
    process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "2026-08-current";
    process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] = "test-only-current-data-request-secret-32-bytes";
    process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR =
      TEMPLATE_IDS.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR;
    process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN =
      TEMPLATE_IDS.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN;
    expect(deliverableEventTypes()).toContain("data_request_verification");
  });

  it("reports a non-canonical template id as invalid configuration", () => {
    configureTemplates();
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = "d-other";

    expect(deliverableEventTypes()).not.toContain("lead_receipt");
    expect(missingTemplates()).toContain("INVALID_SENDGRID_TEMPLATE_LEAD_RECEIPT_TR");
  });

  it("reports a structurally invalid token key id in drain diagnostics", () => {
    configureTemplates();
    process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "invalid key id";
    process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] =
      "test-only-current-data-request-secret-32-bytes";

    expect(missingTemplates()).toEqual(["DATA_REQUEST_TOKEN_KEYRING"]);
  });

  it("reports colliding current and previous token key ids in drain diagnostics", () => {
    configureTemplates();
    process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "2026-08-current";
    process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] =
      "test-only-current-data-request-secret-32-bytes";
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV] = "2026-08-current";
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV] =
      "test-only-previous-data-request-secret-32-bytes";

    expect(missingTemplates()).toEqual(["DATA_REQUEST_TOKEN_KEYRING"]);
  });
});

describe("a provider that stops responding", () => {
  it("gives up instead of holding the row's transaction open", async () => {
    configureTemplates();
    const hangs = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    const transport = sendgridTransport("SG.key", IDENTITY, hangs, 20);
    await expect(transport.send(message)).rejects.toThrow();
  });
});

describe("the request itself", () => {
  it("authenticates, because an unauthenticated send burns every retry", async () => {
    configureTemplates();
    const fetchImpl = respondWith(202);
    await sendgridTransport("SG.key", IDENTITY, fetchImpl).send(message);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer SG.key");
  });

  it.each([
    ["lead_receipt", "tr", TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR],
    ["lead_receipt", "en", TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN],
    ["lead_internal_route", "tr", TEMPLATE_IDS.SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR],
    [
      "data_request_verification",
      "tr",
      TEMPLATE_IDS.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR,
    ],
    [
      "data_request_verification",
      "en",
      TEMPLATE_IDS.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN,
    ],
  ] as const)("uses the exact %s/%s template", async (eventType, locale, expected) => {
    configureTemplates();
    const fetchImpl = respondWith(202);
    const data = eventType === "lead_internal_route"
      ? { receiptId: "YL-1", route: "studio", intent: "studio" }
      : eventType === "data_request_verification"
        ? {
            requestType: "access",
            verificationUrl: "https://yulalab.com/data-request/verify#token=test",
          }
        : { receiptId: "YL-1", locale };
    await sendgridTransport("SG.key", IDENTITY, fetchImpl).send({
      ...message,
      eventType,
      locale,
      data,
    });
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.template_id).toBe(expected);
    expect(body.tracking_settings).toEqual({
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    });
  });
});
