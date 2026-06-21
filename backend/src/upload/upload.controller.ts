import {
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { diskStorage } from 'multer';

import { extname } from 'path';

import { v4 as uuidv4 } from 'uuid';
import { uploadDestination, uploadUrl } from './upload-storage';

@Controller('upload')
export class UploadController {

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({

        destination: uploadDestination,

        filename: (req, file, callback) => {

          const uniqueName =
            uuidv4() + extname(file.originalname);

          callback(null, uniqueName);
        },
      }),
    }),
  )
  uploadFile(
    @Headers('host')
    host: string | undefined,
    @Headers('x-forwarded-proto')
    forwardedProto: string | undefined,
    @UploadedFile()
    file: Express.Multer.File,
  ) {

    return {
      imageUrl: uploadUrl(file.filename, { host, forwardedProto }),
    };
  }
}
