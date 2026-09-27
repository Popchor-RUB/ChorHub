import type { Response } from 'express';

export interface EmailAttachmentDownload {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

export function sendEmailAttachmentResponse(
  attachment: EmailAttachmentDownload,
  response: Response,
): void {
  response
    .attachment(attachment.filename)
    .type(attachment.contentType)
    .send(Buffer.from(attachment.content));
}
