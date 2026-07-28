import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { SiteImagesService } from './site-images.service';
import { UploadService } from '../upload/upload.service';

@Controller('site-images')
export class SiteImagesController {
  constructor(
    private siteImagesService: SiteImagesService,
    private uploadService: UploadService,
  ) {}

  @Get()
  findAll() {
    return this.siteImagesService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':key')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async upload(
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('label') label?: string,
  ) {
    const imageUrl = await this.uploadService.uploadFile(file, 'site-images');
    return this.siteImagesService.upsert(key, imageUrl, label);
  }
}
