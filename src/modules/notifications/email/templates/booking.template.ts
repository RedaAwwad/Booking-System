export type BookingType = 'flight' | 'hotel';

export interface BookingEmailParams {
  bookingType: BookingType;
  bookingId: string;
  userName: string;
  totalPrice?: number;
  currency?: string;
  // Flight-specific
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  // Hotel-specific
  hotelName?: string;
  checkIn?: string;
  checkOut?: string;
  // Optional free-form details
  details?: Record<string, any>;
}

function formatMoney(amount?: number, currency = 'USD') {
  if (amount == null) return '—';
  return `${currency} ${amount.toFixed(2)}`;
}

export function createBookingEmail(params: BookingEmailParams) {
  const { bookingType, bookingId, userName } = params;
  const subject =
    bookingType === 'flight'
      ? `Flight booking confirmed — ${bookingId}`
      : `Hotel booking confirmed — ${bookingId}`;

  // Plain-text fallback
  let text = `Hi ${userName},\n\n`;
  if (bookingType === 'flight') {
    text += `Your flight booking is confirmed (ID: ${bookingId}).\n`;
    if (params.origin && params.destination) {
      text += `Route: ${params.origin} → ${params.destination}\n`;
    }
    if (params.departureDate) {
      text += `Departure: ${params.departureDate}\n`;
    }
    if (params.returnDate) {
      text += `Return: ${params.returnDate}\n`;
    }
  } else {
    text += `Your hotel booking is confirmed (ID: ${bookingId}).\n`;
    if (params.hotelName) {
      text += `Hotel: ${params.hotelName}\n`;
    }
    if (params.checkIn && params.checkOut) {
      text += `Stay: ${params.checkIn} — ${params.checkOut}\n`;
    }
  }

  if (params.totalPrice != null) {
    text += `Total: ${formatMoney(params.totalPrice, params.currency)}\n`;
  }

  text += `\nIf you have any questions, reply to this email.\n\nThanks,\nBooking System Team`;

  // Simple HTML template
  const htmlParts: string[] = [];
  htmlParts.push(
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.4;">`,
  );
  htmlParts.push(`<h2>Hi ${userName},</h2>`);
  htmlParts.push(`<p>Your ${bookingType} booking is confirmed.</p>`);
  htmlParts.push(`<table style="border-collapse:collapse;width:100%">`);
  htmlParts.push(
    `<tr><td style="padding:6px;font-weight:600">Booking ID</td><td style="padding:6px">${bookingId}</td></tr>`,
  );

  if (bookingType === 'flight') {
    if (params.origin && params.destination)
      htmlParts.push(
        `<tr><td style="padding:6px;font-weight:600">Route</td><td style="padding:6px">${params.origin} → ${params.destination}</td></tr>`,
      );
    if (params.departureDate)
      htmlParts.push(
        `<tr><td style="padding:6px;font-weight:600">Departure</td><td style="padding:6px">${params.departureDate}</td></tr>`,
      );
    if (params.returnDate)
      htmlParts.push(
        `<tr><td style="padding:6px;font-weight:600">Return</td><td style="padding:6px">${params.returnDate}</td></tr>`,
      );
  } else {
    if (params.hotelName)
      htmlParts.push(
        `<tr><td style="padding:6px;font-weight:600">Hotel</td><td style="padding:6px">${params.hotelName}</td></tr>`,
      );
    if (params.checkIn && params.checkOut)
      htmlParts.push(
        `<tr><td style="padding:6px;font-weight:600">Stay</td><td style="padding:6px">${params.checkIn} — ${params.checkOut}</td></tr>`,
      );
  }

  if (params.totalPrice != null) {
    htmlParts.push(
      `<tr><td style="padding:6px;font-weight:600">Total</td><td style="padding:6px">${formatMoney(params.totalPrice, params.currency)}</td></tr>`,
    );
  }

  htmlParts.push(`</table>`);
  htmlParts.push(
    `<p style="margin-top:16px">If you have any questions, reply to this email.</p>`,
  );
  htmlParts.push(
    `<p style="margin-top:18px">Thanks,<br/><strong>Booking System Team</strong></p>`,
  );
  htmlParts.push(`</div>`);

  const html = htmlParts.join('');

  return { subject, text, html } as const;
}
