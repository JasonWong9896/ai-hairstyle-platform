import {
  Controller,
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
  uploadFile(@UploadedFile() file: Express.Multer.File) {

    return {
      imageUrl:
        `${publicApiUrl()}/uploads/${file.filename}`,
    };
  }
}

function publicApiUrl() {
  return (process.env.PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
}
