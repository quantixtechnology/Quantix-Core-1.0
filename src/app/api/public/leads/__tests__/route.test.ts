// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { leadFindFirst, leadCreate, generateLeadId } = vi.hoisted(() => ({
  leadFindFirst: vi.fn(),
  leadCreate: vi.fn(),
  generateLeadId: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    lead: {
      findFirst: leadFindFirst,
      create: leadCreate,
    },
  },
}));

vi.mock('@/lib/lead-id', () => ({
  generateLeadId,
}));

import { POST } from '@/app/api/public/leads/route';

const VALID_TOKEN = 'valid-turnstile-token';
const VALID_PHONE = '8844557744';
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

function siteverify(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRequest(
  overrides: Record<string, unknown> = {},
  options: { ip?: string; origin?: string | null } = {},
): NextRequest {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-forwarded-for': options.ip ?? nextIp(),
    };
    if (options.origin !== null) {
      headers.origin = options.origin ?? 'https://www.quantixtechnology.in';
    }

    return new Request('http://localhost/api/public/leads', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test User',
        businessName: 'Test Business',
        phone: VALID_PHONE,
        businessType: 'GROCERY',
        city: 'Mumbai',
        captchaToken: VALID_TOKEN,
        _hp: '',
        _t: Date.now() - 10_000,
        ...overrides,
      }),
    }) as unknown as NextRequest;
}

async function post(overrides: Record<string, unknown> = {}, options: { ip?: string; origin?: string | null } = {}) {
  const response = await POST(makeRequest(overrides, options));
  const body = await response.json();
  return { response, body };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  leadFindFirst.mockResolvedValue(null);
  leadCreate.mockResolvedValue({});
  generateLeadId.mockResolvedValue('LED-202611-0001');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(siteverify({ success: true }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TURNSTILE_SECRET_KEY;
});

describe('POST /api/public/leads CAPTCHA enforcement', () => {
  it('rejects a direct API request without a CAPTCHA token and writes nothing', async () => {
    const { response, body } = await post(
      { captchaToken: undefined },
      { origin: null },
    );

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/captcha/i);
    expect(fetch).not.toHaveBeenCalled();
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('rejects an invalid CAPTCHA token and writes nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(siteverify({ success: false, 'error-codes': ['invalid-input-response'] })),
      ),
    );

    const { response, body } = await post();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/captcha/i);
    expect(fetch).toHaveBeenCalledWith(
      SITEVERIFY_URL,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('rejects a reused/expired CAPTCHA token and writes nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(siteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] })),
      ),
    );

    const { response, body } = await post();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/captcha/i);
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('accepts a valid CAPTCHA token and creates the lead', async () => {
    const { response, body } = await post();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      SITEVERIFY_URL,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { contactPhone: VALID_PHONE },
      select: { id: true },
    });
    expect(leadCreate).toHaveBeenCalledTimes(1);
    expect(leadCreate.mock.calls[0][0].data).toMatchObject({
      contactPhone: VALID_PHONE,
      source: 'WEBSITE_INQUIRY',
      stage: 'LEAD',
    });
  });

  it('fails closed when TURNSTILE_SECRET_KEY is missing', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    const { response, body } = await post();

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(fetch).not.toHaveBeenCalled();
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('fails closed when Cloudflare siteverify is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { response, body } = await post();

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('fails closed when Cloudflare siteverify returns a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(siteverify({}, 500))));

    const { response, body } = await post();

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/temporarily unavailable/i);
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/public/leads phone validation', () => {
  it.each([
    ['987654321', '9 digits'],
    ['09876543210', '11 digits starting with 0'],
    ['884455774411', '12 digits not starting with 91'],
    ['91884455774', '11 digits starting with 91'],
    ['5844557744', '10 digits starting with 5'],
  ])('rejects invalid phone %s (%s) without calling CAPTCHA or DB', async (phone) => {
    const { response, body } = await post({ phone });

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/valid 10-digit mobile/i);
    expect(fetch).not.toHaveBeenCalled();
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it.each([
    '8844557744',
    '+91 8844557744',
    '+91-8844-557744',
    '(91) 8844557744',
    '91 8844557744',
  ])('normalizes and stores valid phone %s as 8844557744', async (phone) => {
    const { response } = await post({ phone });

    expect(response.status).toBe(200);
    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { contactPhone: VALID_PHONE },
      select: { id: true },
    });
    expect(leadCreate.mock.calls[0][0].data.contactPhone).toBe(VALID_PHONE);
  });
});

describe('POST /api/public/leads existing protections', () => {
  it('silently succeeds for honeypot submissions without verifying or writing', async () => {
    const { response, body } = await post({ _hp: 'bot-filled-this' });

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('silently succeeds when the form is submitted too quickly', async () => {
    const { response, body } = await post({ _t: Date.now() });

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('keeps duplicate-phone protection and does not write again', async () => {
    leadFindFirst.mockResolvedValue({ id: 'existing-lead' });

    const { response, body } = await post();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, duplicate: true });
    expect(leadCreate).not.toHaveBeenCalled();
  });

  it('rate limits after 5 requests from the same IP', async () => {
    const ip = '198.51.100.250';
    leadFindFirst.mockResolvedValue({ id: 'existing-lead' });

    for (let i = 0; i < 5; i += 1) {
      const { response } = await post({}, { ip });
      expect(response.status).toBe(200);
    }

    const { response, body } = await post({}, { ip });
    expect(response.status).toBe(429);
    expect(body.error).toMatch(/too many requests/i);
  });

  it('rejects malformed JSON with 400', async () => {
    const request = new Request('http://localhost/api/public/leads', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': nextIp(),
      },
      body: '{not-json',
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(leadCreate).not.toHaveBeenCalled();
  });
});
