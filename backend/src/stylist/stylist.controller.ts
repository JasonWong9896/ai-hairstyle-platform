import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { uploadDestination, uploadUrl } from '../upload/upload-storage';
import { StylistService } from './stylist.service';

type StylistBody = {
  email?: string;
  password?: string;
  name?: string;
  slots?: unknown;
};

@Controller()
export class StylistController {
  constructor(private readonly stylistService: StylistService) {}

  @Get('salon/stylists')
  salonStylists(@Headers('authorization') authorization?: string) {
    return this.stylistService.listForSalon(bearerToken(authorization));
  }

  @Get('stylist/public/salon/:salonId')
  publicSalonStylists(@Param('salonId') salonId: string) {
    return this.stylistService.listPublicForSalon(salonId);
  }

  @Post('salon/stylists')
  createSalonStylist(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: StylistBody,
  ) {
    return this.stylistService.createForSalon(bearerToken(authorization), body);
  }

  @Post('salon/stylists/:stylistId/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDestination,
        filename: (req, file, callback) => callback(null, `${uuidv4()}${extname(file.originalname)}`),
      }),
    }),
  )
  uploadSalonStylistImage(
    @Headers('host') host: string | undefined,
    @Headers('x-forwarded-proto') forwardedProto: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Param('stylistId') stylistId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.stylistService.addImageForSalon(
      bearerToken(authorization),
      stylistId,
      uploadUrl(file.filename, { host, forwardedProto }),
    );
  }

  @Patch('salon/stylists/:stylistId/availability')
  updateSalonStylistAvailability(
    @Headers('authorization') authorization: string | undefined,
    @Param('stylistId') stylistId: string,
    @Body() body: StylistBody,
  ) {
    return this.stylistService.updateAvailabilityForSalon(
      bearerToken(authorization),
      stylistId,
      body.slots,
    );
  }

  @Get('stylist/me')
  me(@Headers('authorization') authorization?: string) {
    return this.stylistService.getMine(bearerToken(authorization));
  }

  @Post('stylist/me/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDestination,
        filename: (req, file, callback) => callback(null, `${uuidv4()}${extname(file.originalname)}`),
      }),
    }),
  )
  uploadMyImage(
    @Headers('host') host: string | undefined,
    @Headers('x-forwarded-proto') forwardedProto: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.stylistService.addMyImage(
      bearerToken(authorization),
      uploadUrl(file.filename, { host, forwardedProto }),
    );
  }

  @Patch('stylist/me/availability')
  updateMyAvailability(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: StylistBody,
  ) {
    return this.stylistService.updateMyAvailability(
      bearerToken(authorization),
      body.slots,
    );
  }
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  return authorization.slice('bearer '.length).trim();
}
