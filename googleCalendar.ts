import type { Customer, Order, Product } from './types';

type SyncArgs = {
  accessToken: string;
  orders: Order[];
  customers: Customer[];
  products: Product[];
  calendarId: string;
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  start: { date: string };
  end: { date: string };
  extendedProperties?: { private?: Record<string, string> };
};

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(n => Number(n));
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function buildOrderEvent(order: Order, customers: Customer[], products: Product[]): GoogleCalendarEvent {
  const customer = customers.find(c => c.id === order.customerId);
  const customerName = customer?.company || customer?.name || order.customerId;
  const deliveryLabel = order.deliveryDate ? `${order.deliveryDate}着` : '納品日未定';

  const itemLines = order.items.map(it => {
    const productName = products.find(p => p.id === it.productId)?.name || it.productId;
    return `- ${productName} x${it.quantity}`;
  });

  const description = [
    `注文ID: ${order.id}`,
    `納品日: ${order.deliveryDate || '未定'}`,
    '',
    '明細:',
    ...itemLines,
    ...(order.notes ? ['', `備考: ${order.notes}`] : []),
    '',
    '※ 注文管理アプリから同期',
  ].join('\n');

  // All-day event on shipping date (end is exclusive).
  return {
    summary: `${customerName}出荷（${deliveryLabel}）`,
    description,
    location: customer?.address || '',
    start: { date: order.shippingDate },
    end: { date: addDaysISO(order.shippingDate, 1) },
    extendedProperties: {
      private: {
        orderId: order.id,
        source: 'order-management',
      },
    },
  };
}

async function calendarFetch(accessToken: string, input: string, init?: RequestInit) {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const message = `Google Calendar API error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`;
    throw new Error(message);
  }

  // Some endpoints can return empty body.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return null;
}

async function findExistingEventId(accessToken: string, order: Order, calendarId: string): Promise<string | null> {
  const timeMin = `${order.shippingDate}T00:00:00+09:00`;
  const timeMax = `${addDaysISO(order.shippingDate, 1)}T00:00:00+09:00`;

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('privateExtendedProperty', `orderId=${order.id}`);

  const data = await calendarFetch(accessToken, url.toString(), { method: 'GET' });
  const items = (data?.items || []) as Array<{ id?: string }>;
  return items[0]?.id || null;
}

async function listManagedEvents(accessToken: string, calendarId: string): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('maxResults', '2500');
    url.searchParams.set('privateExtendedProperty', 'source=order-management');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await calendarFetch(accessToken, url.toString(), { method: 'GET' });
    const items = (data?.items || []) as GoogleCalendarEvent[];
    events.push(...items);
    pageToken = data?.nextPageToken;
  } while (pageToken);

  return events;
}

async function createCalendar(accessToken: string, summary: string): Promise<string> {
  const data = await calendarFetch(accessToken, 'https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary }),
  });
  return data?.id || '';
}

async function updateCalendar(accessToken: string, calendarId: string, summary: string): Promise<void> {
  await calendarFetch(accessToken, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ summary }),
  });
}

async function listCalendars(accessToken: string): Promise<Array<{ id: string; summary: string }>> {
  const calendars: Array<{ id: string; summary: string }> = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await calendarFetch(accessToken, url.toString(), { method: 'GET' });
    const items = (data?.items || []) as Array<{ id: string; summary: string }>;
    calendars.push(...items);
    pageToken = data?.nextPageToken;
  } while (pageToken);

  return calendars;
}

export async function ensureCalendarId(args: { accessToken: string; calendarId: string; calendarName: string }) {
  const { accessToken, calendarId, calendarName } = args;
  if (calendarId) {
    await updateCalendar(accessToken, calendarId, calendarName);
    return calendarId;
  }
  const name = calendarName || '注文管理アプリ';
  const calendars = await listCalendars(accessToken);
  const existing = calendars.find(c => c.summary === name);
  if (existing?.id) return existing.id;
  const createdId = await createCalendar(accessToken, name);
  return createdId;
}

export async function syncShippingOrdersToGoogleCalendar(args: SyncArgs) {
  const { accessToken, orders, customers, products, calendarId } = args;
  const targetCalendarId = calendarId || 'primary';

  const targets = orders.filter(o => o.status === 'Pending' && !!o.shippingDate);
  const targetIds = new Set(targets.map(o => o.id));

  // Remove calendar events that no longer exist (deleted or no shipping date)
  const existingEvents = await listManagedEvents(accessToken, targetCalendarId);
  for (const event of existingEvents) {
    const orderId = event.extendedProperties?.private?.orderId;
    if (orderId && !targetIds.has(orderId) && event.id) {
      await calendarFetch(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(event.id)}`,
        { method: 'DELETE' }
      );
    }
  }

  for (const order of targets) {
    const event = buildOrderEvent(order, customers, products);
    const existingId = await findExistingEventId(accessToken, order, targetCalendarId);

    if (existingId) {
      await calendarFetch(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(existingId)}`,
        { method: 'PATCH', body: JSON.stringify(event) }
      );
    } else {
      await calendarFetch(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`,
        { method: 'POST', body: JSON.stringify(event) }
      );
    }
  }
}
