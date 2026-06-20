// =============================================
// Email body formatting (plain text + HTML parts)
// =============================================
// Emails are stored as plain text. At send time we build a multipart/alternative
// message: a plain-text part (the stored body, with the unsubscribe URL visible as
// a fallback) and an HTML part where the unsubscribe URL is rendered as a clickable
// "Unsubscribe" word (the URL hidden behind it). Kept intentionally minimal — no
// marketing styling — so the email still reads like a personal message.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

// Build the plain-text and HTML versions of an email body.
// If unsubscribeUrl is given and appears in the body, it becomes a clickable
// "Unsubscribe" link in the HTML version (it stays a visible URL in plain text).
export function buildEmailParts(body: string, unsubscribeUrl?: string): { text: string; html: string } {
  const text = body.trimEnd();

  let inner = escapeHtml(text);
  if (unsubscribeUrl) {
    const safeHref = unsubscribeUrl.replace(/[\r\n"<>]/g, "");
    // The plain body contains the raw URL (with no HTML-special chars to escape),
    // so swap that exact substring for a clickable "Unsubscribe" word.
    inner = inner
      .split(escapeHtml(unsubscribeUrl))
      .join(`<a href="${safeHref}" style="color:#6962c4;text-decoration:underline;">Unsubscribe</a>`);
  }
  inner = inner.replace(/\n/g, "<br>\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;">${inner}</div>`;
  return { text, html };
}
