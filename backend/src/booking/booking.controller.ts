import { Body, Controller, Get, Headers, Param, Patch, Post, Query, RawBody } from '@nestjs/common';

import { BookingService } from './booking.service';

type SalonBookingBody = {
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

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('salon')
  createSalonBooking(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SalonBookingBody,
  ) {
    return this.bookingService.createSalonBooking(bearerToken(authorization), body);
  }

  @Get('salon/:salonId/availability')
  salonAvailability(
    @Param('salonId') salonId: string,
    @Query('date') date: string | undefined,
    @Query('stylistId') stylistId: string | undefined,
  ) {
    return this.bookingService.getSalonAvailability({ salonId, date, stylistId });
  }

  @Get('salon/manage')
  salonBookings(@Headers('authorization') authorization: string | undefined) {
    return this.bookingService.getSalonBookings(bearerToken(authorization));
  }

  @Patch('salon/manage/:bookingId/complete')
  completeSalonBooking(
    @Headers('authorization') authorization: string | undefined,
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingService.completeSalonBooking(bearerToken(authorization), bookingId);
  }

  @Post('salon/stripe/webhook')
  stripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
  ) {
    return this.bookingService.handleStripeWebhook(signature, rawBody);
  }
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  return authorization.slice('bearer '.length).trim();
}
