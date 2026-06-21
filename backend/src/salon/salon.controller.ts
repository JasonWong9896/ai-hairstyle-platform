import {
  Body,
  Controller,
  Delete,
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
import { SalonService } from './salon.service';

type SalonBody = {
  homepageUrl?: string;
  mainIntroImageUrl?: string;
};

type ImageBody = {
  imageUrl?: string;
  gender?: string;
  priceYen?: number;
  requiresCut?: boolean;
  requiresDye?: boolean;
  requiresTreatment?: boolean;
};

@Controller('salon')
export class SalonController {
  constructor(private readonly salonService: SalonService) {}

  @Get('hairstyles')
  hairstyles() {
    return this.salonService.getPublicHairstyles();
  }

  @Get('public')
  publicSalons() {
    return this.salonService.getPublicSalons();
  }

  @Get('public/:salonId')
  publicSalon(@Param('salonId') salonId: string) {
    return this.salonService.getPublicSalon(salonId);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.salonService.getMine(bearerToken(authorization));
  }

  @Patch('me')
  updateMe(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SalonBody,
  ) {
    return this.salonService.updateMine(
      bearerToken(authorization),
      body.homepageUrl,
      body.mainIntroImageUrl,
    );
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDestination,
        filename: (req, file, callback) => {
          callback(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadImage(
    @Headers('host') host: string | undefined,
    @Headers('x-forwarded-proto') forwardedProto: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body('gender') gender: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.salonService.addSpecialtyImage(
      bearerToken(authorization),
      uploadUrl(file.filename, { host, forwardedProto }),
      gender,
    );
  }

  @Delete('images')
  deleteImage(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ImageBody,
  ) {
    return this.salonService.deleteSpecialtyImage(
      bearerToken(authorization),
      body.imageUrl,
      body.gender,
    );
  }

  @Patch('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDestination,
        filename: (req, file, callback) => {
          callback(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  replaceImage(
    @Headers('host') host: string | undefined,
    @Headers('x-forwarded-proto') forwardedProto: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body('imageUrl') imageUrl: string | undefined,
    @Body('gender') gender: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.salonService.replaceSpecialtyImage(
      bearerToken(authorization),
      imageUrl,
      uploadUrl(file.filename, { host, forwardedProto }),
      gender,
    );
  }

  @Patch('images/details')
  updateImageDetails(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ImageBody,
  ) {
    return this.salonService.updateHairstyleDetail(
      bearerToken(authorization),
      body.imageUrl,
      body.priceYen,
      body.requiresCut,
      body.requiresDye,
      body.requiresTreatment,
    );
  }

  @Post('intro-images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDestination,
        filename: (req, file, callback) => {
          callback(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadIntroImage(
    @Headers('host') host: string | undefined,
    @Headers('x-forwarded-proto') forwardedProto: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.salonService.addIntroImage(
      bearerToken(authorization),
      uploadUrl(file.filename, { host, forwardedProto }),
    );
  }

  @Delete('intro-images')
  deleteIntroImage(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ImageBody,
  ) {
    return this.salonService.deleteIntroImage(
      bearerToken(authorization),
      body.imageUrl,
    );
  }

  @Patch('intro-images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDestination,
        filename: (req, file, callback) => {
          callback(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  replaceIntroImage(
    @Headers('host') host: string | undefined,
    @Headers('x-forwarded-proto') forwardedProto: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body('imageUrl') imageUrl: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.salonService.replaceIntroImage(
      bearerToken(authorization),
      imageUrl,
      uploadUrl(file.filename, { host, forwardedProto }),
    );
  }
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  return authorization.slice('bearer '.length).trim();
}
