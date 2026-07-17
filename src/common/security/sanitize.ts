/** Strip secrets before any user object leaves the API. */
export function sanitizeUser<T extends Record<string, unknown>>(user: T): Omit<T, 'password' | 'apiKey'> {
  const {
    password: _password,
    apiKey: _apiKey,
    ...safe
  } = user;
  return safe as Omit<T, 'password' | 'apiKey'>;
}
