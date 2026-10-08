// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LeadForm, errorKey } from "@/components/contact/LeadForm";
import { CURRENT_NOTICE_VERSION } from "@/lib/consent";
import { StudioApplicationForm } from "@/components/studio/StudioApplication";
import { STUDIO_QUALIFIERS } from "@/lib/studio";

// StudioApplication uses the locale-aware Link adapter. Its Next navigation
// dependency is not part of this jsdom contract and cannot resolve outside a
// Next runtime, so keep the real form and isolate only that adapter boundary.
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));

interface Copy {
  leadForm: {
    name: string;
    email: string;
    message: string;
    submit: string;
    company: string;
    intent: string;
    intents: Record<string, string>;
    sentBody: string;
    sentBodyMailed: string;
    errors: Record<string, string>;
  };
  studio: {
    form: {
      name: string;
      email: string;
      problem: string;
      submit: string;
      errors: Record<string, string>;
    };
  };
}

const load = (locale: string) =>
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, `../messages/${locale}.json`), "utf8")) as
    Copy & Record<string, unknown>;

const messages = load("tr");
const english = load("en");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm(mailConfigured = false, locale = "tr", studioEnabled = true) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? english : messages}>
      <LeadForm
        products={[{ slug: "lifeos", name: "LifeOS" }]}
        mailConfigured={mailConfigured}
        studioEnabled={studioEnabled}
      />
    </NextIntlClientProvider>,
  );
}

function renderStudioForm(locale = "tr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? english : messages}>
      <StudioApplicationForm open />
    </NextIntlClientProvider>,
  );
}

function fill() {
  fireEvent.change(screen.getByLabelText(messages.leadForm.name), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText(messages.leadForm.email), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText(messages.leadForm.message), {
    target: { value: "merhaba" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

function fillStudio() {
  fireEvent.change(screen.getByLabelText(messages.studio.form.name), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText(messages.studio.form.email), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText(messages.studio.form.problem), {
    target: { value: "A measurable product problem." },
  });
  for (const qualifier of STUDIO_QUALIFIERS) {
    fireEvent.change(screen.getByLabelText(qualifier.labelTr), {
      target: { value: qualifier.options[0].value },
    });
  }
  fireEvent.click(screen.getByRole("checkbox"));
}

type FetchMock = ReturnType<typeof stubFetch>;

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The JSON body of the first (and only) POST the form made. */
function postedBody(fetchMock: FetchMock): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
}

describe("the consent the person is actually giving", () => {
  it("names the same notice version the server writes to lead_consents", () => {
    // The whole reason consent is a versioned row rather than a boolean is
    // to answer "to what did they agree". If this label and that column can
    // drift, the row answers wrongly and nothing catches it.
    renderForm();
    expect(screen.getByText(new RegExp(CURRENT_NOTICE_VERSION))).toBeTruthy();
  });

  it("is not posted at all when the box is left unticked", async () => {
    // `required` is not the guard: the form sets noValidate, so the browser
    // enforces nothing and the submission used to go out with consent:false
    // for the server to reject. Consent is the lawful basis for the record.
    const fetchMock = stubFetch(201, { receiptId: "YL-1" });
    renderForm();
    fireEvent.change(screen.getByLabelText(messages.leadForm.name), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(messages.leadForm.email), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(messages.leadForm.message), {
      target: { value: "merhaba" },
    });
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit }));
    await screen.findByText(messages.leadForm.errors.consent as string);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the tick as it was actually given", async () => {
    // Hardcoding true here leaves every other test green while writing a
    // lead_consents row for a notice nobody saw.
    const fetchMock = stubFetch(201, { receiptId: "YL-1" });
    renderForm();
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(postedBody(fetchMock).consent).toBe(true);
  });
});

describe("the honeypot", () => {
  it("is kept away from anyone using a keyboard or a screen reader", () => {
    renderForm();
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap).toBeTruthy();
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest("[aria-hidden='true']")).toBeTruthy();
    // display:none would be skipped by a bot that reads computed styles.
    expect(trap.closest("div")!.style.display).not.toBe("none");
  });

  it("is actually off-screen, not merely labelled as a trap", async () => {
    // Without the positioning this is a visible field labelled "Website"
    // that a real person fills in — and the route answers 201 with a
    // receipt id while discarding the message. That is the worst outcome
    // this feature can produce, and tabIndex/aria-hidden do not prevent it.
    renderForm();
    const wrapper = (document.querySelector('input[name="website"]') as HTMLInputElement)
      .closest("div")!;
    expect(wrapper.style.position).toBe("absolute");
    expect(parseInt(wrapper.style.left, 10)).toBeLessThan(-1000);
  });
});

describe("what is posted", () => {
  it("sends exactly the fields the route allows, and no more", async () => {
    // noticeVersion is deliberately NOT in the route's ALLOWED_FIELDS: the
    // server decides it, and sending it is a loud 400. A form that posted it
    // would be rejected on every submission.
    const fetchMock = stubFetch(201, { receiptId: "YL-00000001" });
    renderForm();
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit}));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = postedBody(fetchMock);
    expect(Object.keys(body).sort()).toEqual(
      ["consent", "email", "intent", "locale", "message", "name", "website"].sort(),
    );
    expect(body.consent).toBe(true);
    expect(body.website).toBe("");
  });

  it("puts each answer in the field it belongs to", async () => {
    // The key SET was asserted and the values were not, so swapping name and
    // message — storing someone's message as their name in a table whose
    // migration header calls both out as personal data — was invisible.
    const fetchMock = stubFetch(201, { receiptId: "YL-1" });
    renderForm();
    fill();
    fireEvent.change(screen.getByLabelText(messages.leadForm.company), {
      target: { value: "Yula" },
    });
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(postedBody(fetchMock)).toMatchObject({
      name: "Ada",
      email: "ada@example.com",
      message: "merhaba",
      company: "Yula",
      // Hardcoding this records an English visitor's lead as Turkish, and
      // later mails them the Turkish template.
      locale: "tr",
    });
  });

  it("records the language the person actually wrote in", async () => {
    // Every other test renders Turkish, so hardcoding "tr" was invisible —
    // and an English visitor's lead would be stored as Turkish and later
    // mailed the Turkish template.
    const fetchMock = stubFetch(201, { receiptId: "YL-1" });
    renderForm(false, "en");
    fireEvent.change(screen.getByLabelText(english.leadForm.name), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText(english.leadForm.email), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(english.leadForm.message), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: english.leadForm.submit }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(postedBody(fetchMock).locale).toBe("en");
  });

  it("omits productSlug unless the subject is a product", async () => {
    // leads has a CHECK that rejects the pair, so a slug attached to a
    // studio enquiry fails the insert — and a routing rule must never read
    // a product nobody asked about.
    const fetchMock = stubFetch(201, { receiptId: "YL-00000001" });
    renderForm();
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit}));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = postedBody(fetchMock);
    expect("productSlug" in body).toBe(false);
  });
});

describe("Studio rollback inside the general contact form", () => {
  it("removes the Studio option, defaults to product, and submits successfully", async () => {
    const fetchMock = stubFetch(201, { receiptId: "YL-ROLLBACK" });
    renderForm(false, "tr", false);

    const subject = screen.getByLabelText(messages.leadForm.intent) as HTMLSelectElement;
    expect(Array.from(subject.options, (option) => option.value)).not.toContain("studio");
    expect(subject.value).toBe("product");

    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit }));
    await screen.findByText(/YL-ROLLBACK/);
    expect(postedBody(fetchMock).intent).toBe("product");
  });

  it("keeps Studio available and selected only while the server enables it", () => {
    renderForm(false, "tr", true);
    const subject = screen.getByLabelText(messages.leadForm.intent) as HTMLSelectElement;
    expect(Array.from(subject.options, (option) => option.value)).toContain("studio");
    expect(subject.value).toBe("studio");
  });
});

describe("the Studio API error envelope", () => {
  it("renders a known API {error} code with localized copy", async () => {
    stubFetch(400, { error: "email" });
    renderStudioForm();
    fillStudio();
    fireEvent.submit(screen.getByRole("button", { name: messages.studio.form.submit }));
    await screen.findByText(messages.studio.form.errors.email);
  });

  it("fails safe for an unknown API {error} code without exposing it", async () => {
    stubFetch(400, { error: "opaque_backend_detail" });
    renderStudioForm();
    fillStudio();
    fireEvent.submit(screen.getByRole("button", { name: messages.studio.form.submit }));
    await screen.findByText(messages.studio.form.errors.server);
    expect(screen.queryByText("opaque_backend_detail")).toBeNull();
  });
});

describe("when it does not go through", () => {
  it("points a person at email when the form is closed", async () => {
    stubFetch(503, { error: "not_accepting_submissions" });
    renderForm();
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit}));
    await screen.findByText(messages.leadForm.errors.closed);
  });

  it("does not put a raw server string on the screen", () => {
    // The 400 bodies name the field that failed — useful to a developer,
    // meaningless to a person, and echoing an unknown one into the page is
    // how server detail reaches a screen it was never written for.
    expect(errorKey("some_new_backend_code")).toBe("generic");
    expect(errorKey("not_accepting_submissions")).toBe("closed");
  });

  it("says the server was unreachable rather than blaming the message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("network");
    }));
    renderForm();
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit}));
    await screen.findByText(messages.leadForm.errors.offline);
  });
});

describe("after it goes through", () => {
  it("does not claim an email was sent when nothing can send one", async () => {
    stubFetch(201, { receiptId: "YL-0000ABCD" });
    renderForm(false);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit }));
    await screen.findByText(messages.leadForm.sentBody as string);
  });

  it("says a copy was emailed once the provider is actually configured", async () => {
    // The sentence is chosen from the same value that decides whether a
    // receipt is sent, so it cannot outlive its truth.
    stubFetch(201, { receiptId: "YL-0000ABCD" });
    renderForm(true);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit }));
    await screen.findByText(messages.leadForm.sentBodyMailed as string);
  });

  it("shows the reference, because it is the only copy the person gets", async () => {
    // The outbox consumer exists but its provider is a founder gate, so the
    // reference on screen is the ONLY copy the person gets.
    stubFetch(201, { receiptId: "YL-0000ABCD" });
    renderForm();
    fill();
    fireEvent.submit(screen.getByRole("button", { name: messages.leadForm.submit}));
    await screen.findByText(/YL-0000ABCD/);
  });
});

describe("the collection switch", () => {
  it("refuses to load in a browser, where it could only answer wrongly", async () => {
    // LEADS_ENABLED is not NEXT_PUBLIC. A client component importing this
    // would read `undefined` and quietly mean "closed" while the server
    // meant "open" — one surface collecting personal data and the other
    // saying it does not.
    await expect(import("@/server/lead-surface")).rejects.toThrow(/server-only/);
  });
});
