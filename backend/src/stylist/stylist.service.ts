import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';

type StylistRow = {
  id: string;
  email: string;
  name: string | null;
  salon_id: string;
  salon_name: string | null;
  profile_images: string[];
  availability_slots: AvailabilitySlot[];
  updated_at: Date;
};

type AvailabilitySlot = {
  date: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
};

type StylistInput = {
  email?: string;
  password?: string;
  name?: string;
};

@Injectable()
export class StylistService {
  constructor(
    private readonly authService: AuthService,
    private readonly database: DatabaseService,
  ) {}

  async listForSalon(token: string | undefined) {
    const salon = await this.requireSalonUser(token);
    const result = await this.database.query<StylistRow>(
      `
        SELECT
          stylists.id,
          stylists.email,
          stylists.name,
          stylist_profiles.salon_id,
          salons.name AS salon_name,
          stylist_profiles.profile_images,
          stylist_profiles.availability_slots,
          stylist_profiles.updated_at
        FROM stylist_profiles
        JOIN users stylists ON stylists.id = stylist_profiles.user_id
        JOIN users salons ON salons.id = stylist_profiles.salon_id
        WHERE stylist_profiles.salon_id = $1
        ORDER BY stylists.created_at DESC
      `,
      [salon.id],
    );

    return result.rows.map(toStylist);
  }

  async createForSalon(token: string | undefined, input: StylistInput) {
    const salon = await this.requireSalonUser(token);
    const stylist = await this.authService.createVerifiedUser(
      input.email ?? '',
      input.password ?? '',
      input.name,
      'stylist',
    );

    const result = await this.database.query<StylistRow>(
      `
        INSERT INTO stylist_profiles (user_id, salon_id)
        VALUES ($1, $2)
        RETURNING
          $1::BIGINT AS id,
          $3::TEXT AS email,
          $4::TEXT AS name,
          salon_id,
          $5::TEXT AS salon_name,
          profile_images,
          availability_slots,
          updated_at
      `,
      [stylist.id, salon.id, stylist.email, stylist.name, salon.name],
    );

    return toStylist(result.rows[0]);
  }

  async listPublicForSalon(salonId: string) {
    if (!/^\d+$/.test(salonId)) {
      throw new BadRequestException('A valid salon is required');
    }

    const result = await this.database.query<StylistRow>(
      `
        SELECT
          stylists.id,
          stylists.email,
          stylists.name,
          stylist_profiles.salon_id,
          salons.name AS salon_name,
          stylist_profiles.profile_images,
          stylist_profiles.availability_slots,
          stylist_profiles.updated_at
        FROM stylist_profiles
        JOIN users stylists ON stylists.id = stylist_profiles.user_id
        JOIN users salons ON salons.id = stylist_profiles.salon_id
        WHERE stylist_profiles.salon_id = $1
        ORDER BY stylists.created_at DESC
      `,
      [salonId],
    );

    return result.rows.map(toStylist);
  }

  async getMine(token: string | undefined) {
    const stylist = await this.requireStylistUser(token);
    return this.getStylist(stylist.id, stylist.id);
  }

  async addImageForSalon(token: string | undefined, stylistId: string, imageUrl: string) {
    const salon = await this.requireSalonUser(token);
    await this.ensureSalonOwnsStylist(salon.id, stylistId);
    return this.addImage(stylistId, imageUrl);
  }

  async addMyImage(token: string | undefined, imageUrl: string) {
    const stylist = await this.requireStylistUser(token);
    return this.addImage(stylist.id, imageUrl);
  }

  async updateAvailabilityForSalon(
    token: string | undefined,
    stylistId: string,
    slots: unknown,
  ) {
    const salon = await this.requireSalonUser(token);
    await this.ensureSalonOwnsStylist(salon.id, stylistId);
    return this.updateAvailability(stylistId, slots);
  }

  async updateMyAvailability(token: string | undefined, slots: unknown) {
    const stylist = await this.requireStylistUser(token);
    return this.updateAvailability(stylist.id, slots);
  }

  private async addImage(stylistId: string, imageUrl: string) {
    const result = await this.database.query<StylistRow>(
      `
        UPDATE stylist_profiles
        SET
          profile_images = array_append(profile_images, $2),
          updated_at = now()
        WHERE user_id = $1
        RETURNING
          user_id AS id,
          (SELECT email FROM users WHERE id = user_id) AS email,
          (SELECT name FROM users WHERE id = user_id) AS name,
          salon_id,
          (SELECT name FROM users WHERE id = salon_id) AS salon_name,
          profile_images,
          availability_slots,
          updated_at
      `,
      [stylistId, imageUrl],
    );

    return toStylist(result.rows[0]);
  }

  private async updateAvailability(stylistId: string, slots: unknown) {
    const cleanSlots = normalizeSlots(slots);
    const result = await this.database.query<StylistRow>(
      `
        UPDATE stylist_profiles
        SET
          availability_slots = $2::JSONB,
          updated_at = now()
        WHERE user_id = $1
        RETURNING
          user_id AS id,
          (SELECT email FROM users WHERE id = user_id) AS email,
          (SELECT name FROM users WHERE id = user_id) AS name,
          salon_id,
          (SELECT name FROM users WHERE id = salon_id) AS salon_name,
          profile_images,
          availability_slots,
          updated_at
      `,
      [stylistId, JSON.stringify(cleanSlots)],
    );

    return toStylist(result.rows[0]);
  }

  private async getStylist(requestUserId: string, stylistId: string) {
    const result = await this.database.query<StylistRow>(
      `
        SELECT
          stylists.id,
          stylists.email,
          stylists.name,
          stylist_profiles.salon_id,
          salons.name AS salon_name,
          stylist_profiles.profile_images,
          stylist_profiles.availability_slots,
          stylist_profiles.updated_at
        FROM stylist_profiles
        JOIN users stylists ON stylists.id = stylist_profiles.user_id
        JOIN users salons ON salons.id = stylist_profiles.salon_id
        WHERE stylist_profiles.user_id = $1 AND stylists.id = $2
      `,
      [requestUserId, stylistId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Stylist not found');
    }

    return toStylist(result.rows[0]);
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

  private async requireSalonUser(token: string | undefined) {
    const user = await this.authService.currentUser(token);
    if (user.role !== 'salon') {
      throw new ForbiddenException('Salon account is required');
    }

    return user;
  }

  private async requireStylistUser(token: string | undefined) {
    const user = await this.authService.currentUser(token);
    if (user.role !== 'stylist') {
      throw new ForbiddenException('Stylist account is required');
    }

    return user;
  }
}

function normalizeSlots(value: unknown): AvailabilitySlot[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('Availability slots are required');
  }

  return value.map((slot) => {
    if (!slot || typeof slot !== 'object') {
      throw new BadRequestException('Invalid availability slot');
    }

    const item = slot as Partial<AvailabilitySlot>;
    if (
      !isDateInAvailabilityWindow(item.date) ||
      !isTime(item.startTime) ||
      !isTime(item.endTime)
    ) {
      throw new BadRequestException('Invalid availability slot');
    }

    return {
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
    };
  });
}

function isDateInAvailabilityWindow(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = parseDateOnly(value);
  if (!date || toDateInputValue(date) !== value) {
    return false;
  }

  const today = dateOnly(new Date());
  const latest = new Date(today);
  latest.setMonth(latest.getMonth() + 1);

  return date >= today && date <= latest;
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return dateOnly(date);
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toStylist(row: StylistRow) {
  return {
    id: String(row.id),
    email: row.email,
    name: row.name,
    salonId: String(row.salon_id),
    salonName: row.salon_name,
    profileImages: row.profile_images ?? [],
    availabilitySlots: row.availability_slots ?? [],
    updatedAt: row.updated_at ?? null,
  };
}
