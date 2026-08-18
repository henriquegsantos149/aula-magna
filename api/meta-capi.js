import { createHash } from 'node:crypto';

export const GRAPH_API_VERSION = 'v21.0';

export const ALLOWED_EVENTS = ['Lead', 'lead_qualificado', 'ViewContent'];

export function isAllowedEvent(value) {
  return typeof value === 'string' && ALLOWED_EVENTS.includes(value);
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizePhoneBR(value) {
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  if (digits.length > 11 && digits.startsWith('55')) return digits;
  return `55${digits}`;
}

export function normalizeName(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

export function splitName(value) {
  const normalized = normalizeName(value);
  if (!normalized) return {};
  const parts = normalized.split(' ');
  const lastName = parts.slice(1).join(' ');
  return { firstName: parts[0], lastName: lastName.length > 0 ? lastName : undefined };
}

export function parseCookies(header) {
  if (typeof header !== 'string' || header.length === 0) return {};
  const cookies = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name.length === 0) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

export function clientIpFromHeader(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

const ALLOWED_CUSTOM_DATA_KEYS = ['content_name', 'content_category'];

export function filterCustomData(value) {
  if (value === null || typeof value !== 'object') return undefined;
  const filtered = {};
  for (const key of ALLOWED_CUSTOM_DATA_KEYS) {
    const candidate = value[key];
    if (typeof candidate === 'string') filtered[key] = candidate;
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

export function filterEventSourceUrl(value) {
  if (typeof value !== 'string') return undefined;
  return value.length > 0 ? value : undefined;
}

export function buildUserData(input) {
  const userData = {};

  const email = normalizeEmail(input.email);
  if (email) {
    const hashedEmail = sha256(email);
    userData.em = [hashedEmail];
    userData.external_id = [hashedEmail];
  }

  const phone = normalizePhoneBR(input.telefone);
  if (phone) userData.ph = [sha256(phone)];

  const { firstName, lastName } = splitName(input.nome);
  if (firstName) userData.fn = [sha256(firstName)];
  if (lastName) userData.ln = [sha256(lastName)];

  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  return userData;
}

export function buildEventPayload(input) {
  const event = {
    event_name: input.eventName,
    event_time: input.eventTime,
    event_id: input.eventId,
    action_source: 'website',
    user_data: input.userData,
  };
  if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;
  if (input.customData) event.custom_data = input.customData;

  const payload = {
    data: [event],
    access_token: input.accessToken,
  };
  if (input.testEventCode) payload.test_event_code = input.testEventCode;
  return payload;
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pixelId = process.env.META_PIXEL_ID || '1373287802810243';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.error('Meta CAPI: integration not configured (missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN)');
    return res.status(500).json({ error: 'Not configured' });
  }

  let body = {};
  try {
    body = req.body || {};
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
  } catch {
    console.error('Meta CAPI: malformed request body');
    return res.status(400).json({ error: 'Malformed request body' });
  }

  const eventName = body.event_name;
  if (!isAllowedEvent(eventName)) {
    console.error('Meta CAPI: rejected event outside the allowlist:', eventName);
    return res.status(400).json({ error: 'Unsupported event' });
  }

  const eventId = typeof body.event_id === 'string' ? body.event_id : '';
  if (eventId.length === 0) {
    console.error('Meta CAPI: missing event_id', { event_name: eventName });
    return res.status(400).json({ error: 'Missing event_id' });
  }

  const cookies = parseCookies(req.headers.cookie);
  const userAgent = req.headers['user-agent'];

  const payload = buildEventPayload({
    eventName,
    eventId,
    eventTime: Math.floor(Date.now() / 1000),
    accessToken,
    eventSourceUrl: filterEventSourceUrl(body.event_source_url),
    customData: filterCustomData(body.custom_data),
    testEventCode: process.env.META_TEST_EVENT_CODE || undefined,
    userData: buildUserData({
      email: body.email,
      telefone: body.telefone,
      nome: body.nome,
      fbp: cookies._fbp || (typeof body.fbp === 'string' ? body.fbp : undefined),
      fbc: cookies._fbc || (typeof body.fbc === 'string' ? body.fbc : undefined),
      clientIpAddress: clientIpFromHeader(req.headers['x-forwarded-for']),
      clientUserAgent: typeof userAgent === 'string' ? userAgent : undefined,
    }),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!metaRes.ok) {
      const detail = await metaRes.json().catch(() => null);
      console.error('Meta CAPI rejected the event', {
        event_name: eventName,
        status: metaRes.status,
        fbtrace_id: detail?.error?.fbtrace_id,
      });
    }
  } catch (error) {
    console.error('Meta CAPI request failed', {
      event_name: eventName,
      reason: error instanceof Error ? error.name : 'unknown',
    });
  } finally {
    clearTimeout(timeout);
  }

  return res.status(204).end();
}
