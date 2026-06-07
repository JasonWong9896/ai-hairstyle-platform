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

@Controller('upload')
export class UploadController {

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({

        destination: './uploads',

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
    @UploadedFile()
    file: Express.Multer.File,
  ) {

    console.log(file);

    return {
      imageUrl: uploadUrl(file.filename, host),
    };
  }
}

function uploadUrl(filename: string, host: string | undefined): string {
  const publicApiUrl =
    process.env.PUBLIC_API_URL ?? (host ? `http://${host}` : 'http://localhost:8000');

  return `${publicApiUrl.replace(/\/$/, '')}/uploads/${filename}`;
}
