const MAILHOG_BASE = 'http://localhost:8025';

interface MailHogAddress {
  Mailbox: string;
  Domain: string;
}

interface MailHogMessage {
  ID: string;
  To: MailHogAddress[];
  Content: {
    Body: string;
  };
  Created: string;
}

interface MailHogMessagesResponse {
  items: MailHogMessage[];
}

async function fetchMessages(recipientEmail: string): Promise<MailHogMessage[]> {
  const res = await fetch(`${MAILHOG_BASE}/api/v2/messages`);
  if (!res.ok) throw new Error(`MailHog API unreachable: ${res.status}`);
  const data: MailHogMessagesResponse = await res.json();

  const [mailbox, domain] = recipientEmail.toLowerCase().split('@');
  return (data.items ?? [])
    .filter((msg) =>
      msg.To.some(
        (addr) =>
          addr.Mailbox.toLowerCase() === mailbox &&
          addr.Domain.toLowerCase() === domain,
      ),
    )
    .sort(
      (a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime(),
    );
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function extractCode(body: string): string | null {
  const decoded = decodeQuotedPrintable(body);
  // Prefer visible HTML text nodes (e.g. >123456<) to avoid matching CSS colors like #444444.
  const htmlTextMatch = decoded.match(/>\s*(\d{6})\s*</);
  if (htmlTextMatch) return htmlTextMatch[1];

  const fallbackMatch = decoded.match(/\b(\d{6})\b/);
  return fallbackMatch ? fallbackMatch[1] : null;
}

interface PollOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export async function getLatestMagicLinkCode(
  recipientEmail: string,
  { timeoutMs = 15_000, pollIntervalMs = 500 }: PollOptions = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await fetchMessages(recipientEmail);
    for (const msg of messages) {
      const code = extractCode(msg.Content.Body);
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out waiting for magic link email to ${recipientEmail} after ${timeoutMs}ms`,
  );
}

export async function clearMailHog(): Promise<void> {
  const res = await fetch(`${MAILHOG_BASE}/api/v1/messages`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to clear MailHog: ${res.status}`);
}
