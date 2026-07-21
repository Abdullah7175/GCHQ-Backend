import { BadRequestException } from '@nestjs/common';

const PHONE_PATTERN = /^\+?\d+$/;

/** Validates user input: only + and digits allowed. */
export function assertValidPhoneInput(input: string): void {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BadRequestException('Phone number is required');
  }
  if (!PHONE_PATTERN.test(trimmed)) {
    throw new BadRequestException('Phone may only contain + and digits (e.g. +923001234567 or 03331234567)');
  }
}

/** Normalize to E.164-style +92… for storage and display. */
export function normalizePakistanPhone(input: string): string {
  assertValidPhoneInput(input);
  const trimmed = input.trim();
  if (trimmed.startsWith('+92')) return trimmed;
  if (trimmed.startsWith('92')) return `+${trimmed}`;
  if (trimmed.startsWith('0')) return `+92${trimmed.slice(1)}`;
  if (trimmed.startsWith('+')) return trimmed;
  return `+92${trimmed}`;
}

/** Provider payload often expects digits without + (923…). */
export function phoneForProviderApi(input: string): string {
  const normalized = normalizePakistanPhone(input);
  return normalized.replace(/^\+/, '');
}
