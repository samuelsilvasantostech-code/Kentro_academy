/**
 * Envio de e-mail pelo Resend (API HTTP, sem dependência).
 * Variáveis no Doca: RESEND_API_KEY e EMAIL_FROM (ex.: "Kentro Academy <academy@kentro.com.br>").
 */
export type SendResult = "sent" | "not_configured" | "error";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendEmail(to: string, subject: string, text: string, link: { label: string; url: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.error(JSON.stringify({ level: "error", scope: "email", msg: "RESEND_API_KEY/EMAIL_FROM não configurados" }));
    return "not_configured";
  }
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p>${esc(text).replace(/\n/g, "<br>")}</p>
<p><a href="${esc(link.url)}" style="display:inline-block;background:#2CF8B0;color:#04120d;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(link.label)}</a></p>
<p style="color:#666;font-size:13px">Se o botão não abrir, copie este endereço no navegador:<br>${esc(link.url)}</p>
<p style="color:#666;font-size:13px">Kentro Academy</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text: `${text}\n\n${link.label}: ${link.url}\n\nKentro Academy` }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "sent";
    console.error(JSON.stringify({ level: "error", scope: "email", status: res.status, body: (await res.text()).slice(0, 300) }));
    return "error";
  } catch (err) {
    console.error(JSON.stringify({ level: "error", scope: "email", msg: err instanceof Error ? err.message : String(err) }));
    return "error";
  }
}
