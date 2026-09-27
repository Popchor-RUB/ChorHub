import axios from 'axios';

export function getDisabledAccountContact(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const payload: unknown = error.response?.data;
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return null;
  }
  const details = payload.error;
  if (typeof details !== 'object' || details === null || !('code' in details) || !('contactEmail' in details)) {
    return null;
  }
  const code = details.code;
  const contactEmail = details.contactEmail;
  return code === 'MEMBER_DISABLED' && typeof contactEmail === 'string' ? contactEmail : null;
}
