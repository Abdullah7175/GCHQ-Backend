import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/**
 * Rate-limit buckets keyed by authenticated identity instead of raw IP.
 *
 * Why: all web traffic arrives via the Next.js same-origin proxy (one IP),
 * and mobile fleets sit behind carrier-grade NAT (thousands of devices per IP).
 * Keying by IP alone would rate-limit the whole system as one client.
 *
 * Priority: bearer token → API key → forwarded client IP → socket IP.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const auth = req.headers?.['authorization'];
    if (typeof auth === 'string' && auth.length > 16) {
      return `tok:${this.hash(auth)}`;
    }

    const cookieToken = req.cookies?.['gchq_token'];
    if (typeof cookieToken === 'string' && cookieToken.length > 16) {
      return `tok:${this.hash(cookieToken)}`;
    }

    const apiKey = req.headers?.['x-api-key'];
    if (typeof apiKey === 'string' && apiKey.length >= 16) {
      return `key:${this.hash(apiKey)}`;
    }

    // Unauthenticated (e.g. login): use the real client IP. `trust proxy` is
    // enabled for loopback, so req.ip already resolves X-Forwarded-For set by
    // the Next.js proxy; fall back to the raw header just in case.
    const xff = req.headers?.['x-forwarded-for'];
    const forwarded = typeof xff === 'string' && xff.length ? xff.split(',')[0].trim() : null;
    return `ip:${forwarded || req.ip || 'unknown'}`;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 32);
  }
}
