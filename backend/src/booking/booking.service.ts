import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import Stripe = require('stripe');

import { AuthService } from '../auth/auth.service';
import { EmailService } from '../auth/email.service';
import { DatabaseService } from '../database/database.service';
import { MemberService } from '../member/member.service';

type SalonBookingInput = {
  salonId?: string;
  stylistId?: string;
  customerName?: string;
  customerEmail?: string;
  styleImageUrl?: string;
  styleGender?: string;
  paymentMethod?: string;
  preferredDate?: string;
  preferredTime?: string;
};

type SalonAvailabilityInput = {
  salonId?: string;
  date?: string;
  stylistId?: string;
};

type SalonRow = {
  id: string;
  email: string;
  name: string | null;
  specialty_images: string[];
  specialty_images_women: string[];
  specialty_images_men: string[];
};

type HairstyleDetailRow = {
  price_yen: number;
  requires_dye: boolean;
  requires_treatment: boolean;
};

type BookingPaymentMethod = 'card' | 'points';

type StylistAvailabilityRow = {
  user_id: string;
  stylist_name: string | null;
  availability_slots: AvailabilitySlot[];
};

type ExistingBookingRow = {
  stylist_id: string;
  preferred_time: string;
};

type ExistingCustomerBookingRow = {
  id: string;
};

type AvailabilitySlot = {
  date?: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
};

type SalonBookingRow = {
  id: string;
  salon_id: string;
  stylist_id: string | null;
  customer_name: string;
  customer_email: string;
  style_image_url: string | null;
  style_gender: 'women' | 'men' | null;
  preferred_date: string;
  preferred_time: string;
  status: string;
  payment_status: string;
  payment_amount_yen: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: Date;
};

type ManagedSalonBookingRow = {
  id: string;
  salon_id: string;
  stylist_id: string | null;
  stylist_name: string | null;
  stylist_email: string | null;
  customer_name: string;
  customer_email: string;
  style_image_url: string | null;
  style_gender: 'women' | 'men' | null;
  preferred_date: string | Date;
  preferred_time: string;
  status: string;
  payment_status: string;
  payment_amount_yen: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  completed_at: Date | null;
  created_at: Date;
};

@Injectable()
export class BookingService {
  private stripe: Stripe.Stripe | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
    private readonly memberService: MemberService,
  ) {}

  async getSalonAvailability(input: SalonAvailabilityInput) {
    const salonId = normalizeId(input.salonId);
    const stylistId = normalizeOptionalId(input.stylistId);
    const date = normalizeDate(input.date);
    const salon = await this.findSalon(salonId);

    if (!salon) {
      throw new BadRequestException('Salon not found');
    }

    if (stylistId) {
      await this.ensureSalonOwnsStylist(salonId, stylistId);
    }

    const availability = await this.availableTimeOptions(salonId, date, stylistId);

    return {
      salonId,
      date,
      stylistId,
      slots: availability.map((slot) => ({
        time: slot.time,
        label: slot.time,
        stylistIds: slot.stylistIds,
      })),
    };
  }

  async createSalonBooking(token: string | undefined, input: SalonBookingInput) {
    const salonId = normalizeId(input.salonId);
    const stylistId = normalizeOptionalId(input.stylistId);
    const customerName = normalizeRequiredText(input.customerName, 'Customer name');
    const customerEmail = normalizeEmail(input.customerEmail);
    const styleImageUrl = normalizeOptionalText(input.styleImageUrl);
    const requestedStyleGender = normalizeOptionalGender(input.styleGender);
    const styleGender = styleImageUrl ? requestedStyleGender : null;
    const paymentMethod = normalizePaymentMethod(input.paymentMethod);
    const preferredDate = normalizeDate(input.preferredDate);
    const preferredTime = normalizeTime(input.preferredTime);
    const salon = await this.findSalon(salonId);

    if (!salon) {
      throw new BadRequestException('Salon not found');
    }

    if (isPastSlot(preferredDate, preferredTime)) {
      throw new BadRequestException('Selected time is in the past');
    }

    if (styleImageUrl && !styleGender) {
      throw new BadRequestException('A valid hairstyle gender is required');
    }

    if (styleImageUrl && styleGender && !salonStyleImages(salon, styleGender).includes(styleImageUrl)) {
      throw new BadRequestException('Selected hairstyle does not belong to this salon');
    }

    if (await this.hasExistingCustomerBooking(salonId, customerEmail, preferredDate, preferredTime)) {
      throw new BadRequestException('Duplicate booking for this time slot');
    }

    const hairstyleDetail = styleImageUrl
      ? await this.findHairstyleDetail(salonId, styleImageUrl)
      : null;
    const paymentAmountYen = Number(hairstyleDetail?.price_yen ?? 0);
    const paymentStatus = paymentAmountYen > 0
      ? paymentMethod === 'points'
        ? 'paid'
        : 'pending'
      : 'not_required';

    const assignedStylistId = await this.pickAvailableStylist(
      salonId,
      preferredDate,
      preferredTime,
      stylistId,
    );

    const result = await this.database.query<SalonBookingRow>(
      `
        INSERT INTO salon_bookings (
          salon_id,
          stylist_id,
          customer_name,
          customer_email,
          style_image_url,
          style_gender,
          preferred_date,
          preferred_time,
          payment_status,
          payment_amount_yen
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          id,
          salon_id,
          stylist_id,
          customer_name,
          customer_email,
          style_image_url,
          style_gender,
          preferred_date,
          preferred_time,
          status,
          payment_status,
          payment_amount_yen,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at
      `,
      [
        salonId,
        assignedStylistId,
        customerName,
        customerEmail,
        styleImageUrl,
        styleGender,
        preferredDate,
        preferredTime,
        paymentStatus,
        paymentAmountYen,
      ],
    );

    const salonName = salon.name ?? 'Salon';
    const booking = result.rows[0];
    let checkout: Awaited<ReturnType<typeof this.createBookingCheckout>> | null = null;
    let pointCharge: Awaited<ReturnType<typeof this.memberService.chargeBookingPayment>> | null = null;
    try {
      if (paymentAmountYen > 0 && paymentMethod === 'points') {
        pointCharge = await this.memberService.chargeBookingPayment(token, paymentAmountYen);
      } else if (paymentAmountYen > 0 && hasStripeSecretKey()) {
        checkout = await this.createBookingCheckout(booking, salonName, customerEmail);
      }
    } catch (error) {
      await this.cancelBooking(booking.id);
      throw error;
    }
    await Promise.all([
      this.emailService.sendCustomerBookingCompletedEmail({
        to: customerEmail,
        recipientName: customerName,
        salonName,
        customerName,
        customerEmail,
        styleImageUrl,
        preferredDate,
        preferredTime,
      }),
      this.emailService.sendSalonBookingCompletedEmail({
        to: salon.email,
        recipientName: salon.name,
        salonName,
        customerName,
        customerEmail,
        styleImageUrl,
        preferredDate,
        preferredTime,
      }),
    ]);

    return {
      id: booking.id,
      salonId: booking.salon_id,
      stylistId: booking.stylist_id,
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      styleImageUrl: booking.style_image_url,
      styleGender: booking.style_gender,
      preferredDate: booking.preferred_date,
      preferredTime: booking.preferred_time,
      status: booking.status,
      paymentStatus: booking.payment_status,
      paymentAmountYen: Number(booking.payment_amount_yen),
      checkoutUrl: checkout?.checkoutUrl ?? null,
      checkoutSessionId: checkout?.checkoutSessionId ?? null,
      wallet: pointCharge?.wallet ?? null,
      createdAt: booking.created_at,
    };
  }

  async handleStripeWebhook(signature: string | undefined, rawBody: Buffer | undefined) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!rawBody) {
      throw new BadRequestException('Missing Stripe webhook body');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    let event: any;
    try {
      event = this.stripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type !== 'checkout.session.completed') {
      return { received: true, ignored: true };
    }

    const session = event.data.object;
    if (session.metadata?.purpose !== 'salon_booking') {
      return { received: true, ignored: true };
    }

    if (session.payment_status !== 'paid') {
      return { received: true, fulfilled: false };
    }

    const bookingId = normalizeId(session.metadata?.bookingId);
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    await this.database.query(
      `
        UPDATE salon_bookings
        SET
          payment_status = 'paid',
          stripe_checkout_session_id = $1,
          stripe_payment_intent_id = $2
        WHERE id = $3
          AND stripe_checkout_session_id = $1
      `,
      [session.id, paymentIntentId, bookingId],
    );

    return { received: true, fulfilled: true };
  }

  async getSalonBookings(token: string | undefined) {
    const user = await this.authService.currentUser(token);
    if (user.role !== 'salon') {
      throw new UnauthorizedException('Salon login is required');
    }

    const result = await this.database.query<ManagedSalonBookingRow>(
      `
        SELECT
          salon_bookings.id,
          salon_bookings.salon_id,
          salon_bookings.stylist_id,
          stylists.name AS stylist_name,
          stylists.email AS stylist_email,
          salon_bookings.customer_name,
          salon_bookings.customer_email,
          salon_bookings.style_image_url,
          salon_bookings.style_gender,
          salon_bookings.preferred_date,
          salon_bookings.preferred_time,
          salon_bookings.status,
          salon_bookings.payment_status,
          salon_bookings.payment_amount_yen,
          salon_bookings.stripe_checkout_session_id,
          salon_bookings.stripe_payment_intent_id,
          salon_bookings.completed_at,
          salon_bookings.created_at
        FROM salon_bookings
        LEFT JOIN users AS stylists ON stylists.id = salon_bookings.stylist_id
        WHERE salon_bookings.salon_id = $1
          AND salon_bookings.status <> 'cancelled'
        ORDER BY salon_bookings.preferred_date ASC, salon_bookings.preferred_time ASC, salon_bookings.created_at ASC
      `,
      [user.id],
    );

    return result.rows.map(toManagedSalonBooking);
  }

  async completeSalonBooking(token: string | undefined, bookingId: string) {
    const user = await this.authService.currentUser(token);
    if (user.role !== 'salon') {
      throw new UnauthorizedException('Salon login is required');
    }

    const normalizedBookingId = normalizeId(bookingId);
    const result = await this.database.query<ManagedSalonBookingRow>(
      `
        UPDATE salon_bookings
        SET status = 'fulfilled', completed_at = now()
        WHERE id = $1
          AND salon_id = $2
          AND status <> 'cancelled'
        RETURNING
          id,
          salon_id,
          stylist_id,
          (SELECT name FROM users WHERE users.id = salon_bookings.stylist_id) AS stylist_name,
          (SELECT email FROM users WHERE users.id = salon_bookings.stylist_id) AS stylist_email,
          customer_name,
          customer_email,
          style_image_url,
          style_gender,
          preferred_date,
          preferred_time,
          status,
          payment_status,
          payment_amount_yen,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          completed_at,
          created_at
      `,
      [normalizedBookingId, user.id],
    );

    const booking = result.rows[0];
    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    return toManagedSalonBooking(booking);
  }

  private async findSalon(salonId: string): Promise<SalonRow | undefined> {
    const result = await this.database.query<SalonRow>(
      `
        SELECT
          users.id,
          users.email,
          COALESCE(NULLIF(users.name, ''), users.email) AS name,
          salon_profiles.specialty_images,
          salon_profiles.specialty_images_women,
          salon_profiles.specialty_images_men
        FROM users
        JOIN salon_profiles ON salon_profiles.user_id = users.id
        WHERE users.id = $1 AND users.role = 'salon'
      `,
      [salonId],
    );

    return result.rows[0];
  }

  private async ensureSalonOwnsStylist(salonId: string, stylistId: string) {
    const result = await this.database.query(
      'SELECT 1 FROM stylist_profiles WHERE salon_id = $1 AND user_id = $2',
      [salonId, stylistId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Stylist not found');
    }
  }

  private async pickAvailableStylist(
    salonId: string,
    date: string,
    time: string,
    stylistId: string | null,
  ) {
    if (stylistId) {
      await this.ensureSalonOwnsStylist(salonId, stylistId);
    }

    const options = await this.availableTimeOptions(salonId, date, stylistId);
    const option = options.find((item) => item.time === time);
    if (!option?.stylistIds.length) {
      throw new BadRequestException('Selected time is no longer available');
    }

    return option.stylistIds[Math.floor(Math.random() * option.stylistIds.length)];
  }

  private async availableTimeOptions(
    salonId: string,
    date: string,
    stylistId: string | null,
  ) {
    const [stylists, bookings] = await Promise.all([
      this.findStylists(salonId, stylistId),
      this.findBookings(salonId, date),
    ]);
    const booked = new Set(
      bookings.map((booking) => `${booking.stylist_id}|${normalizeBookedTime(booking.preferred_time)}`),
    );
    const dayOfWeek = dayOfWeekFromDate(date);
    const byTime = new Map<string, Set<string>>();

    for (const stylist of stylists) {
      for (const slot of stylist.availability_slots ?? []) {
        if (slot.date) {
          if (slot.date !== date) continue;
        } else if (slot.dayOfWeek !== dayOfWeek) {
          continue;
        }

        for (const time of hourlyTimes(slot.startTime, slot.endTime)) {
          if (isPastSlot(date, time)) continue;
          if (booked.has(`${stylist.user_id}|${time}`)) continue;

          if (!byTime.has(time)) {
            byTime.set(time, new Set());
          }
          byTime.get(time)?.add(stylist.user_id);
        }
      }
    }

    return [...byTime.entries()]
      .map(([time, stylistIds]) => ({ time, stylistIds: [...stylistIds] }))
      .sort((left, right) => left.time.localeCompare(right.time));
  }

  private async findStylists(salonId: string, stylistId: string | null) {
    const result = await this.database.query<StylistAvailabilityRow>(
      `
        SELECT
          user_id,
          (SELECT name FROM users WHERE id = user_id) AS stylist_name,
          availability_slots
        FROM stylist_profiles
        WHERE salon_id = $1
          AND ($2::BIGINT IS NULL OR user_id = $2::BIGINT)
      `,
      [salonId, stylistId],
    );

    return result.rows;
  }

  private async findBookings(salonId: string, date: string) {
    const result = await this.database.query<ExistingBookingRow>(
      `
        SELECT stylist_id, preferred_time
        FROM salon_bookings
        WHERE salon_id = $1
          AND preferred_date = $2::DATE
          AND stylist_id IS NOT NULL
          AND status <> 'cancelled'
          AND (payment_status <> 'pending' OR stripe_checkout_session_id IS NOT NULL)
      `,
      [salonId, date],
    );

    return result.rows;
  }

  private async hasExistingCustomerBooking(
    salonId: string,
    customerEmail: string,
    date: string,
    time: string,
  ) {
    const result = await this.database.query<ExistingCustomerBookingRow>(
      `
        SELECT id
        FROM salon_bookings
        WHERE salon_id = $1
          AND customer_email = $2
          AND preferred_date = $3::DATE
          AND preferred_time = $4::TIME
          AND status <> 'cancelled'
          AND (payment_status <> 'pending' OR stripe_checkout_session_id IS NOT NULL)
        LIMIT 1
      `,
      [salonId, customerEmail, date, time],
    );

    return Boolean(result.rows[0]);
  }

  private async findHairstyleDetail(salonId: string, imageUrl: string) {
    const result = await this.database.query<HairstyleDetailRow>(
      `
        SELECT price_yen, requires_dye, requires_treatment
        FROM salon_hairstyle_details
        WHERE salon_id = $1 AND image_url = $2
      `,
      [salonId, imageUrl],
    );

    return result.rows[0] ?? null;
  }

  private async createBookingCheckout(
    booking: SalonBookingRow,
    salonName: string,
    customerEmail: string,
  ) {
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const session = await this.stripeClient().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${frontendUrl}/salons/${booking.salon_id}?booking=paid&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/salons/${booking.salon_id}?booking=cancelled`,
      client_reference_id: booking.id,
      customer_email: customerEmail,
      metadata: {
        bookingId: booking.id,
        salonId: booking.salon_id,
        purpose: 'salon_booking',
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: Number(booking.payment_amount_yen),
            product_data: {
              name: `${salonName} booking`,
              description: `${booking.preferred_date} ${booking.preferred_time}`,
            },
          },
        },
      ],
    });

    await this.database.query(
      `
        UPDATE salon_bookings
        SET stripe_checkout_session_id = $1
        WHERE id = $2
      `,
      [session.id, booking.id],
    );

    return {
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
    };
  }

  private async cancelBooking(bookingId: string) {
    await this.database.query(
      `
        UPDATE salon_bookings
        SET status = 'cancelled'
        WHERE id = $1
      `,
      [bookingId],
    );
  }

  private stripeClient(): Stripe.Stripe {
    if (this.stripe) {
      return this.stripe;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('Stripe secret key is not configured');
    }

    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }
}

function salonStyleImages(row: SalonRow, gender: 'women' | 'men') {
  if (gender === 'men') {
    return row.specialty_images_men ?? [];
  }

  return [
    ...(row.specialty_images ?? []),
    ...(row.specialty_images_women ?? []),
  ];
}

function normalizeId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    throw new BadRequestException('A valid salon is required');
  }

  return trimmed;
}

function normalizeOptionalId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new BadRequestException('A valid stylist is required');
  }

  return trimmed;
}

function normalizeRequiredText(value: string | undefined, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(`${label} is required`);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeEmail(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BadRequestException('A valid customer email is required');
  }

  return normalized;
}

function normalizeOptionalGender(value: string | undefined): 'women' | 'men' | null {
  if (!value) {
    return null;
  }

  if (value === 'women' || value === 'men') {
    return value;
  }

  throw new BadRequestException('A valid hairstyle gender is required');
}

function normalizePaymentMethod(value: string | undefined): BookingPaymentMethod {
  if (!value || value === 'card') {
    return 'card';
  }

  if (value === 'points') {
    return value;
  }

  throw new BadRequestException('A valid payment method is required');
}

function normalizeDate(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException('A valid preferred date is required');
  }

  return trimmed;
}

function normalizeTime(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new BadRequestException('A valid preferred time is required');
  }

  return trimmed;
}

function dayOfWeekFromDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function hourlyTimes(startTime: string, endTime: string) {
  const start = minutes(startTime);
  const end = minutes(endTime);
  if (end <= start) {
    return [];
  }

  const result: string[] = [];
  for (let cursor = start; cursor < end; cursor += 60) {
    result.push(formatMinutes(cursor));
  }

  return result;
}

function minutes(value: string) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function normalizeBookedTime(value: string) {
  return value.slice(0, 5);
}

function isPastSlot(date: string, time: string) {
  const now = new Date();
  const slotStart = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(time.slice(0, 2)),
    Number(time.slice(3, 5)),
  );

  return slotStart <= now;
}

function hasStripeSecretKey() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function toManagedSalonBooking(booking: ManagedSalonBookingRow) {
  return {
    id: booking.id,
    salonId: booking.salon_id,
    stylistId: booking.stylist_id,
    stylistName: booking.stylist_name,
    stylistEmail: booking.stylist_email,
    customerName: booking.customer_name,
    customerEmail: booking.customer_email,
    styleImageUrl: booking.style_image_url,
    styleGender: booking.style_gender,
    preferredDate: formatDateValue(booking.preferred_date),
    preferredTime: normalizeBookedTime(booking.preferred_time),
    status: booking.status,
    paymentStatus: booking.payment_status,
    paymentAmountYen: Number(booking.payment_amount_yen),
    checkoutSessionId: booking.stripe_checkout_session_id,
    completedAt: booking.completed_at,
    createdAt: booking.created_at,
  };
}

function formatDateValue(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}
