import { BadRequestException } from '@nestjs/common';

const HTTP_URL = /^https?:\/\/.+/i;

export function assertValidMessagingApiUrl(apiUrl: string): void {
  const trimmed = apiUrl.trim();
  if (!HTTP_URL.test(trimmed)) {
    throw new BadRequestException(
      'API URL must start with http:// or https:// (not an email address). Example: http://erp.bizintel.co:8005/api/send-json',
    );
  }
  try {
    new URL(trimmed);
  } catch {
    throw new BadRequestException('API URL is not a valid URL');
  }
}

export function buildMessagingPayload(
  authFieldName: string,
  authValue: string,
  phone: string,
  message: string,
): Record<string, string> {
  const field = authFieldName.trim() || 'token';
  return {
    [field]: authValue,
    phone,
    message,
  };
}
