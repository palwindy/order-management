import type { Customer, Order, Product } from './types';

type SyncArgs = {
  accessToken: string;
  orders: Order[];
  customers: Customer[];
  products: Product[];
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
  const customerName = customer?.company ? `${customer.company} ${customer.name}` : (customer?.name || order.customerId);

  const itemLines = order.items.map(it => {
    const productName = products.find(p => p.id === it.productId)?.name || it.productId;
    return `- ${productName} x${it.quantity}`;
  });

  const description = [
    `注文ID: ${order.id}`,
    `納品日: ${order.deliveryDate || '-'}`,
    '',
    '明細:',
    ...itemLines,
    '',
    '※ 注文管理システムから同期',
  ].join('\n');

  // All-day event on shipping date (end is exclusive).
  return {
    summary: `出荷予定: ${customerName}`,
    description,
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

async function findExistingEventId(accessToken: string, order: Order): Promise<string | null> {
  const timeMin = `${order.shippingDate}T00:00:00+09:00`;
  const timeMax = `${addDaysISO(order.shippingDate, 1)}T00:00:00+09:00`;

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
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

export async function syncShippingOrdersToGoogleCalendar(args: SyncArgs) {
  const { accessToken, orders, customers, products } = args;

  const targets = orders.filter(o => o.status === 'Pending' && !!o.shippingDate);
  for (const order of targets) {
    const event = buildOrderEvent(order, customers, products);
    const existingId = await findExistingEventId(accessToken, order);

    if (existingId) {
      await calendarFetch(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingId)}`,
        { method: 'PATCH', body: JSON.stringify(event) }
      );
    } else {
      await calendarFetch(
        accessToken,
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        { method: 'POST', body: JSON.stringify(event) }
      );
    }
  }
}

