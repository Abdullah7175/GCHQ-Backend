const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export const RESOURCE_LABELS: Record<string, string> = {
  providers: 'Fleet Provider',
  cities: 'City',
  sectors: 'Sector',
  hospitals: 'Hospital',
  'emergency-types': 'Emergency Type',
  'triage-codes': 'Triage Code',
  users: 'User',
  ambulances: 'Ambulance',
  transits: 'Transit',
  'audit-logs': 'Audit Log',
  auth: 'Authentication',
};

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'secret',
  'refresh_token',
]);

export function normalizeAuditPath(path: string): string {
  const raw = (path || '').split('?')[0] || '/';
  return raw.startsWith('/api') ? raw.slice(4) || '/' : raw;
}

/** Skip routine reads so create/update/delete entries stay visible. */
export function shouldAuditRequest(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return false;

  const normalized = normalizeAuditPath(path);
  if (normalized.endsWith('/audit-events')) return false;
  if (/\/ambulances\/[^/]+\/gps$/.test(normalized)) return false;

  return true;
}

export function resolveAuditAction(
  method: string,
  path: string,
  success: boolean,
): string {
  const normalized = normalizeAuditPath(path);
  const verb = method.toUpperCase();

  if (normalized.endsWith('/auth/login')) {
    return success ? 'auth.login.success' : 'auth.login.failed';
  }
  if (normalized.endsWith('/auth/logout')) return 'auth.logout';

  const transitWorkflow = normalized.match(
    new RegExp(`^/transits/(${UUID})/(claim|release|start|complete|arrived|eta|prep-ready)$`, 'i'),
  );
  if (transitWorkflow) {
    return `transits.${transitWorkflow[2].replace(/-/g, '_')}`;
  }

  if (/\/sectors\/[^/]+\/toggle-override$/i.test(normalized)) {
    return 'sectors.toggle_override';
  }

  if (/\/ambulances\/[^/]+\/gps$/i.test(normalized)) {
    return 'ambulances.gps_update';
  }

  const crud = normalized.match(
    new RegExp(`^/([\\w-]+)(?:/(${UUID}))?(?:/([\\w-]+))?$`, 'i'),
  );
  if (crud) {
    const [, resource, , subAction] = crud;
    if (subAction) return `${resource}.${subAction}`;
    const op =
      verb === 'POST'
        ? 'create'
        : verb === 'PUT' || verb === 'PATCH'
          ? 'update'
          : verb === 'DELETE'
            ? 'delete'
            : verb.toLowerCase();
    return `${resource}.${op}`;
  }

  return `http.${verb.toLowerCase()} ${normalized}`;
}

export function sanitizeAuditBody(
  body: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[redacted]';
      continue;
    }
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      clean[key] = value.slice(0, 20);
      continue;
    }
    if (typeof value === 'object') {
      clean[key] = sanitizeAuditBody(value as Record<string, unknown>) ?? '[object]';
    }
  }
  return Object.keys(clean).length ? clean : null;
}

export function buildAuditMetadata(input: {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}): Record<string, unknown> {
  const normalized = normalizeAuditPath(input.path);
  const resourceMatch = normalized.match(/^\/([\w-]+)/);
  const resource = resourceMatch?.[1] ?? null;
  const entityId = (input.params?.id as string | undefined) ?? null;
  const body = sanitizeAuditBody(input.body);
  const resourceLabel = resource ? RESOURCE_LABELS[resource] ?? resource : null;

  return {
    resource,
    resourceLabel,
    entityId,
    summary: summarizeAuditChange(input.method, resource, resourceLabel, entityId, body),
    params: input.params ?? {},
    query: input.query ?? {},
    body,
  };
}

function summarizeAuditChange(
  method: string,
  resource: string | null,
  resourceLabel: string | null,
  entityId: string | null,
  body: Record<string, unknown> | null,
): string {
  const label = resourceLabel ?? resource ?? 'Record';
  const verb = method.toUpperCase();
  const shortId = entityId ? `${entityId.slice(0, 8)}…` : '';

  if (verb === 'DELETE') {
    return `Deleted ${label}${shortId ? ` (${shortId})` : ''}`;
  }
  if (verb === 'POST') {
    const name = body?.name ?? body?.unitNumber ?? body?.email;
    const sectorHint = body?.sectorId ? ` (sector ${String(body.sectorId).slice(0, 8)}…)` : '';
    return `Created ${label}${name ? `: ${name}` : ''}${sectorHint}`;
  }
  if (verb === 'PUT' || verb === 'PATCH') {
    const changed = body ? Object.keys(body).join(', ') : 'fields';
    const name = body?.name ?? body?.unitNumber ?? body?.email;
    const sectorHint = body?.sectorId ? ` [sector ${String(body.sectorId).slice(0, 8)}…]` : '';
    const who = name ? ` "${name}"` : shortId ? ` (${shortId})` : '';
    return `Updated ${label}${who}${sectorHint} — ${changed}`;
  }
  return `${label} ${verb}${shortId ? ` (${shortId})` : ''}`;
}
