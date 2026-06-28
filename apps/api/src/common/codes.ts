import { randomBytes } from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(length = 8): string {
  return Array.from(randomBytes(length))
    .map((b) => CHARSET[b % CHARSET.length])
    .join('');
}
