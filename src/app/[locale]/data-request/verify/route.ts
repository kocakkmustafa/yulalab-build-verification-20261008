import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COPY = {
  tr: {
    title: "Veri talebini doğrula · YULA Lab",
    heading: "Veri talebini doğrula",
    intro: "Bu işlem, talebin e-posta adresinin size ait olduğunu doğrular.",
    button: "Talebi doğrula",
    sending: "Doğrulanıyor…",
    verified: "E-posta adresi doğrulandı. Talebiniz işleme alınabilir.",
    failed: "Bu talep doğrulanamadı. Bağlantı geçersiz, süresi dolmuş veya daha önce kullanılmış olabilir.",
    noScript: "Talebinizi doğrulamak için JavaScript'i etkinleştirip e-postanızdaki bağlantıyı yeniden açın.",
    contact: "İletişime dön",
  },
  en: {
    title: "Verify data request · YULA Lab",
    heading: "Verify your data request",
    intro: "This action confirms that the request email address belongs to you.",
    button: "Verify request",
    sending: "Verifying…",
    verified: "The email address was verified. Your request can now be processed.",
    failed: "This request could not be verified. The link may be invalid, expired, or already used.",
    noScript: "To verify your request, enable JavaScript and reopen the link in your email.",
    contact: "Back to contact",
  },
} as const;

// Keep this capability page independent of the main layout's analytics and
// remote assets. Its per-response nonce authorizes both the script and CSS.
const STYLES = `
  :root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px; background: #09060e; color: #f7f4ff; }
  main { width: 100%; max-width: 560px; padding: clamp(24px, 5vw, 48px); border: 1px solid #403749; border-radius: 24px; background: #15101d; overflow-wrap: anywhere; }
  .brand { margin: 0 0 28px; color: #c2b8d0; font-size: .75rem; letter-spacing: .18em; }
  h1 { margin: 0; font-size: clamp(1.75rem, 6vw, 2.5rem); line-height: 1.15; letter-spacing: -.035em; }
  p { line-height: 1.65; color: #d1c9dc; }
  button { min-height: 48px; max-width: 100%; margin-top: 12px; padding: 12px 24px; border: 1px solid transparent; border-radius: 999px; background: #f7f4ff; color: #15101d; font: inherit; font-weight: 650; cursor: pointer; }
  button:disabled { cursor: wait; opacity: .75; }
  button:focus-visible, a:focus-visible { outline: 3px solid #c4b5fd; outline-offset: 5px; }
  #status { margin: 0; }
  #status:not(:empty), noscript p { margin-top: 24px; padding: 16px; border: 1px solid #625370; border-radius: 12px; }
  a { display: inline-flex; align-items: center; min-height: 44px; margin-top: 20px; color: #e3d9ff; text-underline-offset: 4px; }
  [hidden] { display: none !important; }
`;

function script(copy: (typeof COPY)[keyof typeof COPY]): string {
  return `(() => {
  const raw = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  history.replaceState(null, "", location.pathname + location.search);
  const token = new URLSearchParams(raw).get("token") || "";
  const valid = /^[0-9a-f]{64}$/.test(token);
  const button = document.getElementById("verify");
  const status = document.getElementById("status");
  if (!valid) {
    button.hidden = true;
    status.textContent = ${JSON.stringify(copy.failed)};
    status.setAttribute("role", "alert");
    return;
  }
  button.hidden = false;
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = ${JSON.stringify(copy.sending)};
    try {
      const response = await fetch("/api/data-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const body = await response.json();
      const verified = response.ok && body && body.verified === true;
      status.textContent = verified ? ${JSON.stringify(copy.verified)} : ${JSON.stringify(copy.failed)};
      status.setAttribute("role", verified ? "status" : "alert");
    } catch {
      status.textContent = ${JSON.stringify(copy.failed)};
      status.setAttribute("role", "alert");
    } finally {
      button.hidden = true;
    }
  }, { once: true });
})();`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale: requestedLocale } = await params;
  // Route handlers do not inherit the layout's locale guard. In particular,
  // dotted locale aliases skip middleware and must not render this document
  // under the general config CSP.
  if (requestedLocale !== "tr" && requestedLocale !== "en") {
    return new Response(null, { status: 404 });
  }
  const locale = requestedLocale;
  const copy = COPY[locale];
  const contactPath = locale === "en" ? "/en/contact" : "/contact";
  const nonce = randomBytes(18).toString("base64");
  const body = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${copy.title}</title>
  <style nonce="${nonce}">${STYLES}</style>
</head>
<body>
  <main>
    <p class="brand">YULA LAB</p>
    <h1>${copy.heading}</h1>
    <p>${copy.intro}</p>
    <button id="verify" type="button" hidden>${copy.button}</button>
    <p id="status" role="status" aria-live="polite" aria-atomic="true"></p>
    <noscript><p>${copy.noScript}</p></noscript>
    <a href="${contactPath}">${copy.contact}</a>
  </main>
  <script nonce="${nonce}">${script(copy)}</script>
</body>
</html>`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
      "content-security-policy": [
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        `style-src 'nonce-${nonce}'`,
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ].join("; "),
    },
  });
}
