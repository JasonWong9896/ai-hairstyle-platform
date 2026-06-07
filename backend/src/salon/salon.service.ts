import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';

type SalonRow = {
  user_id: string;
  salon_name?: string | null;
  homepage_url: string | null;
  specialty_images: string[];
  specialty_images_women: string[];
  specialty_images_men: string[];
  intro_images: string[];
  main_intro_image_url: string | null;
  updated_at: Date;
};

type SalonHairstyleGender = 'women' | 'men';
type SpecialtyImagesColumn =
  | 'specialty_images'
  | 'specialty_images_women'
  | 'specialty_images_men';

type PublicSalonHairstyleRow = {
  salon_id: string;
  salon_name: string | null;
  homepage_url: string | null;
  image_url: string;
  image_index: string;
  gender: SalonHairstyleGender;
  price_yen: number | null;
  requires_cut: boolean | null;
  requires_dye: boolean | null;
  requires_treatment: boolean | null;
};

type HairstyleDetailRow = {
  image_url: string;
  price_yen: number;
  requires_cut: boolean;
  requires_dye: boolean;
  requires_treatment: boolean;
};

type SalonProfile = {
  id: string;
  name: string;
  homepageUrl: string | null;
  specialtyImages: string[];
  specialtyImagesWomen: string[];
  specialtyImagesMen: string[];
  introImages: string[];
  mainIntroImageUrl: string | null;
  hairstyleDetails: Record<string, HairstyleDetail>;
  updatedAt: Date | null;
};

type HairstyleDetail = {
  priceYen: number;
  requiresCut: boolean;
  requiresDye: boolean;
  requiresTreatment: boolean;
};

type PublicSalonHairstyle = {
  id: string;
  salonId: string;
  image: string;
  gender: SalonHairstyleGender;
  salonName: string;
  salonHomepageUrl: string | null;
  priceYen: number;
  requiresCut: boolean;
  requiresDye: boolean;
  requiresTreatment: boolean;
};

type PublicSalon = {
  id: string;
  name: string;
  homepageUrl: string | null;
  specialtyImages: string[];
  specialtyImagesWomen: string[];
  specialtyImagesMen: string[];
  introImages: string[];
  mainIntroImageUrl: string | null;
  hairstyleDetails: Record<string, HairstyleDetail>;
  updatedAt: Date | null;
};

@Injectable()
export class SalonService {
  constructor(
    private readonly authService: AuthService,
    private readonly database: DatabaseService,
  ) {}

  async getMine(token: string | undefined): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const profile = await this.findOrCreateProfile(user.id);
    const details = await this.findHairstyleDetails(user.id);

    return toProfile(profile, user.name ?? user.email, details);
  }

  async updateMine(
    token: string | undefined,
    homepageUrl: string | undefined,
    mainIntroImageUrl: string | undefined,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const current = await this.findOrCreateProfile(user.id);
    const cleanHomepageUrl =
      homepageUrl === undefined ? current.homepage_url : normalizeHomepageUrl(homepageUrl);
    const cleanMainIntroImageUrl =
      mainIntroImageUrl === undefined
        ? current.main_intro_image_url
        : normalizeOptionalImageUrl(mainIntroImageUrl);

    if (
      cleanMainIntroImageUrl &&
      !current.intro_images.includes(cleanMainIntroImageUrl)
    ) {
      throw new BadRequestException('Main intro image must be one of the uploaded intro images');
    }

    const result = await this.database.query<SalonRow>(
      `
        UPDATE salon_profiles
        SET
          homepage_url = $2,
          main_intro_image_url = $3,
          updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [user.id, cleanHomepageUrl, cleanMainIntroImageUrl],
    );

    return toProfile(result.rows[0], user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async addSpecialtyImage(
    token: string | undefined,
    imageUrl: string,
    gender: string | undefined,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const cleanGender = normalizeGender(gender);
    const columnName =
      cleanGender === 'women' ? 'specialty_images_women' : 'specialty_images_men';

    const result = await this.database.query<SalonRow>(
      `
        INSERT INTO salon_profiles (user_id, ${columnName})
        VALUES ($1, ARRAY[$2]::TEXT[])
        ON CONFLICT (user_id)
        DO UPDATE SET
          ${columnName} = array_append(salon_profiles.${columnName}, $2),
          updated_at = now()
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [user.id, imageUrl],
    );

    return toProfile(result.rows[0], user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async deleteSpecialtyImage(
    token: string | undefined,
    imageUrl: string | undefined,
    gender: string | undefined,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const current = await this.findOrCreateProfile(user.id);
    const cleanImageUrl = normalizeRequiredImageUrl(imageUrl);
    const columnName = specialtyColumnForImage(current, normalizeGender(gender), cleanImageUrl);

    const result = await this.database.query<SalonRow>(
      `
        UPDATE salon_profiles
        SET
          ${columnName} = array_remove(${columnName}, $2),
          updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [user.id, cleanImageUrl],
    );

    return toProfile(result.rows[0], user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async replaceSpecialtyImage(
    token: string | undefined,
    imageUrl: string | undefined,
    newImageUrl: string,
    gender: string | undefined,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const current = await this.findOrCreateProfile(user.id);
    const cleanImageUrl = normalizeRequiredImageUrl(imageUrl);
    const columnName = specialtyColumnForImage(current, normalizeGender(gender), cleanImageUrl);

    const result = await this.database.query<SalonRow>(
      `
        UPDATE salon_profiles
        SET
          ${columnName} = array_replace(${columnName}, $2, $3),
          updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [user.id, cleanImageUrl, newImageUrl],
    );

    return toProfile(result.rows[0], user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async updateHairstyleDetail(
    token: string | undefined,
    imageUrl: string | undefined,
    priceYen: number | undefined,
    requiresCut: boolean | undefined,
    requiresDye: boolean | undefined,
    requiresTreatment: boolean | undefined,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const current = await this.findOrCreateProfile(user.id);
    const cleanImageUrl = normalizeRequiredImageUrl(imageUrl);

    if (!allSpecialtyImages(current).includes(cleanImageUrl)) {
      throw new BadRequestException('Hairstyle image not found');
    }

    await this.database.query(
      `
        INSERT INTO salon_hairstyle_details (
          salon_id,
          image_url,
          price_yen,
          requires_cut,
          requires_dye,
          requires_treatment,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (salon_id, image_url)
        DO UPDATE SET
          price_yen = EXCLUDED.price_yen,
          requires_cut = EXCLUDED.requires_cut,
          requires_dye = EXCLUDED.requires_dye,
          requires_treatment = EXCLUDED.requires_treatment,
          updated_at = now()
      `,
      [
        user.id,
        cleanImageUrl,
        normalizePriceYen(priceYen),
        Boolean(requiresCut),
        Boolean(requiresDye),
        Boolean(requiresTreatment),
      ],
    );

    return toProfile(current, user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async addIntroImage(
    token: string | undefined,
    imageUrl: string,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);

    const result = await this.database.query<SalonRow>(
      `
        INSERT INTO salon_profiles (user_id, intro_images, main_intro_image_url)
        VALUES ($1, ARRAY[$2]::TEXT[], $2)
        ON CONFLICT (user_id)
        DO UPDATE SET
          intro_images = array_append(salon_profiles.intro_images, $2),
          main_intro_image_url = COALESCE(salon_profiles.main_intro_image_url, $2),
          updated_at = now()
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [user.id, imageUrl],
    );

    return toProfile(result.rows[0], user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async deleteIntroImage(
    token: string | undefined,
    imageUrl: string | undefined,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const current = await this.findOrCreateProfile(user.id);
    const cleanImageUrl = normalizeRequiredImageUrl(imageUrl);

    if (!current.intro_images.includes(cleanImageUrl)) {
      throw new BadRequestException('Intro image not found');
    }

    const result = await this.database.query<SalonRow>(
      `
        UPDATE salon_profiles
        SET
          intro_images = array_remove(intro_images, $2),
          main_intro_image_url = CASE
            WHEN main_intro_image_url = $2 THEN (array_remove(intro_images, $2))[1]
            ELSE main_intro_image_url
          END,
          updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [user.id, cleanImageUrl],
    );

    return toProfile(result.rows[0], user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async replaceIntroImage(
    token: string | undefined,
    imageUrl: string | undefined,
    newImageUrl: string,
  ): Promise<SalonProfile> {
    const user = await this.requireSalonUser(token);
    const current = await this.findOrCreateProfile(user.id);
    const cleanImageUrl = normalizeRequiredImageUrl(imageUrl);

    if (!current.intro_images.includes(cleanImageUrl)) {
      throw new BadRequestException('Intro image not found');
    }

    const result = await this.database.query<SalonRow>(
      `
        UPDATE salon_profiles
        SET
          intro_images = array_replace(intro_images, $2, $3),
          main_intro_image_url = CASE
            WHEN main_intro_image_url = $2 THEN $3
            ELSE main_intro_image_url
          END,
          updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [user.id, cleanImageUrl, newImageUrl],
    );

    return toProfile(result.rows[0], user.name ?? user.email, await this.findHairstyleDetails(user.id));
  }

  async getPublicHairstyles(): Promise<PublicSalonHairstyle[]> {
    const result = await this.database.query<PublicSalonHairstyleRow>(
      `
        SELECT
          users.id AS salon_id,
          COALESCE(NULLIF(users.name, ''), users.email) AS salon_name,
          salon_profiles.homepage_url,
          images.image_url,
          images.image_index,
          images.gender,
          details.price_yen,
          details.requires_cut,
          details.requires_dye,
          details.requires_treatment
        FROM salon_profiles
        JOIN users ON users.id = salon_profiles.user_id
        CROSS JOIN LATERAL (
          SELECT legacy_images.image_url, legacy_images.image_index, 'women'::TEXT AS gender
          FROM unnest(salon_profiles.specialty_images) WITH ORDINALITY AS legacy_images(image_url, image_index)
          UNION ALL
          SELECT women_images.image_url, women_images.image_index, 'women'::TEXT AS gender
          FROM unnest(salon_profiles.specialty_images_women) WITH ORDINALITY AS women_images(image_url, image_index)
          UNION ALL
          SELECT men_images.image_url, men_images.image_index, 'men'::TEXT AS gender
          FROM unnest(salon_profiles.specialty_images_men) WITH ORDINALITY AS men_images(image_url, image_index)
        ) AS images
        LEFT JOIN salon_hairstyle_details AS details
          ON details.salon_id = users.id
          AND details.image_url = images.image_url
        WHERE users.role = 'salon'
        ORDER BY salon_profiles.updated_at DESC, images.image_index DESC
      `,
    );

    return result.rows.map((row) => ({
      id: `${row.salon_id}-${row.gender}-${row.image_index}`,
      salonId: row.salon_id,
      image: row.image_url,
      gender: row.gender,
      salonName: row.salon_name ?? 'Salon',
      salonHomepageUrl: row.homepage_url,
      priceYen: Number(row.price_yen ?? 0),
      requiresCut: Boolean(row.requires_cut),
      requiresDye: Boolean(row.requires_dye),
      requiresTreatment: Boolean(row.requires_treatment),
    }));
  }

  async getPublicSalons(): Promise<PublicSalon[]> {
    const result = await this.database.query<SalonRow>(
      `
        SELECT
          users.id AS user_id,
          COALESCE(NULLIF(users.name, ''), users.email) AS salon_name,
          salon_profiles.homepage_url,
          salon_profiles.specialty_images,
          salon_profiles.specialty_images_women,
          salon_profiles.specialty_images_men,
          salon_profiles.intro_images,
          salon_profiles.main_intro_image_url,
          salon_profiles.updated_at
        FROM salon_profiles
        JOIN users ON users.id = salon_profiles.user_id
        WHERE users.role = 'salon'
        ORDER BY salon_profiles.updated_at DESC
      `,
    );

    const detailsBySalon = await this.findHairstyleDetailsForSalons(
      result.rows.map((row) => row.user_id),
    );

    return result.rows.map((row) => toPublicSalon(row, detailsBySalon.get(row.user_id) ?? {}));
  }

  async getPublicSalon(salonId: string): Promise<PublicSalon> {
    const result = await this.database.query<SalonRow>(
      `
        SELECT
          users.id AS user_id,
          COALESCE(NULLIF(users.name, ''), users.email) AS salon_name,
          salon_profiles.homepage_url,
          salon_profiles.specialty_images,
          salon_profiles.specialty_images_women,
          salon_profiles.specialty_images_men,
          salon_profiles.intro_images,
          salon_profiles.main_intro_image_url,
          salon_profiles.updated_at
        FROM salon_profiles
        JOIN users ON users.id = salon_profiles.user_id
        WHERE users.role = 'salon' AND users.id = $1
      `,
      [salonId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Salon not found');
    }

    return toPublicSalon(result.rows[0], await this.findHairstyleDetails(salonId));
  }

  private async findOrCreateProfile(userId: string): Promise<SalonRow> {
    const result = await this.database.query<SalonRow>(
      `
        INSERT INTO salon_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id)
        DO UPDATE SET updated_at = salon_profiles.updated_at
        RETURNING user_id, homepage_url, specialty_images, specialty_images_women, specialty_images_men, intro_images, main_intro_image_url, updated_at
      `,
      [userId],
    );

    return result.rows[0];
  }

  private async findHairstyleDetails(salonId: string): Promise<Record<string, HairstyleDetail>> {
    const result = await this.database.query<HairstyleDetailRow>(
      `
        SELECT image_url, price_yen, requires_cut, requires_dye, requires_treatment
        FROM salon_hairstyle_details
        WHERE salon_id = $1
      `,
      [salonId],
    );

    return toHairstyleDetails(result.rows);
  }

  private async findHairstyleDetailsForSalons(salonIds: string[]) {
    if (!salonIds.length) {
      return new Map<string, Record<string, HairstyleDetail>>();
    }

    const result = await this.database.query<HairstyleDetailRow & { salon_id: string }>(
      `
        SELECT salon_id, image_url, price_yen, requires_cut, requires_dye, requires_treatment
        FROM salon_hairstyle_details
        WHERE salon_id = ANY($1::BIGINT[])
      `,
      [salonIds],
    );
    const map = new Map<string, Record<string, HairstyleDetail>>();

    for (const row of result.rows) {
      const details = map.get(row.salon_id) ?? {};
      details[row.image_url] = toHairstyleDetail(row);
      map.set(row.salon_id, details);
    }

    return map;
  }

  private async requireSalonUser(token: string | undefined) {
    const user = await this.authService.currentUser(token);
    if (user.role !== 'salon') {
      throw new ForbiddenException('Salon account is required');
    }

    return user;
  }
}

function normalizeHomepageUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BadRequestException('A valid homepage URL is required');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException('Homepage URL must start with http or https');
  }

  return url.toString();
}

function normalizeOptionalImageUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeRequiredImageUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException('Image URL is required');
  }

  return trimmed;
}

function normalizeGender(value: string | undefined): SalonHairstyleGender {
  if (value === 'women' || value === 'men') {
    return value;
  }

  throw new BadRequestException('Hairstyle gender must be women or men');
}

function normalizePriceYen(value: number | undefined): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new BadRequestException('A valid hairstyle price is required');
  }

  return Math.round(value);
}

function specialtyColumnForImage(
  row: SalonRow,
  gender: SalonHairstyleGender,
  imageUrl: string,
): SpecialtyImagesColumn {
  if (gender === 'women') {
    if ((row.specialty_images ?? []).includes(imageUrl)) {
      return 'specialty_images';
    }

    if ((row.specialty_images_women ?? []).includes(imageUrl)) {
      return 'specialty_images_women';
    }
  }

  if (gender === 'men' && (row.specialty_images_men ?? []).includes(imageUrl)) {
    return 'specialty_images_men';
  }

  throw new BadRequestException('Hairstyle image not found');
}

function allSpecialtyImages(row: SalonRow) {
  return [
    ...(row.specialty_images ?? []),
    ...(row.specialty_images_women ?? []),
    ...(row.specialty_images_men ?? []),
  ];
}

function toProfile(
  row: SalonRow,
  name = 'Salon',
  hairstyleDetails: Record<string, HairstyleDetail> = {},
): SalonProfile {
  const specialtyImagesWomen = [
    ...(row.specialty_images ?? []),
    ...(row.specialty_images_women ?? []),
  ];
  const specialtyImagesMen = row.specialty_images_men ?? [];

  return {
    id: row.user_id,
    name,
    homepageUrl: row.homepage_url,
    specialtyImages: [...specialtyImagesWomen, ...specialtyImagesMen],
    specialtyImagesWomen,
    specialtyImagesMen,
    introImages: row.intro_images ?? [],
    mainIntroImageUrl: row.main_intro_image_url,
    hairstyleDetails,
    updatedAt: row.updated_at ?? null,
  };
}

function toPublicSalon(
  row: SalonRow,
  hairstyleDetails: Record<string, HairstyleDetail> = {},
): PublicSalon {
  const specialtyImagesWomen = [
    ...(row.specialty_images ?? []),
    ...(row.specialty_images_women ?? []),
  ];
  const specialtyImagesMen = row.specialty_images_men ?? [];

  return {
    id: row.user_id,
    name: row.salon_name ?? 'Salon',
    homepageUrl: row.homepage_url,
    specialtyImages: [...specialtyImagesWomen, ...specialtyImagesMen],
    specialtyImagesWomen,
    specialtyImagesMen,
    introImages: row.intro_images ?? [],
    mainIntroImageUrl: row.main_intro_image_url,
    hairstyleDetails,
    updatedAt: row.updated_at ?? null,
  };
}

function toHairstyleDetail(row: HairstyleDetailRow): HairstyleDetail {
  return {
    priceYen: Number(row.price_yen ?? 0),
    requiresCut: Boolean(row.requires_cut),
    requiresDye: Boolean(row.requires_dye),
    requiresTreatment: Boolean(row.requires_treatment),
  };
}

function toHairstyleDetails(rows: HairstyleDetailRow[]) {
  return Object.fromEntries(rows.map((row) => [row.image_url, toHairstyleDetail(row)]));
}
