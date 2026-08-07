import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { EducationService } from './education.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UploadService } from '../upload/upload.service';

@Controller('education')
export class EducationController {
  constructor(
    private educationService: EducationService,
    private uploadService: UploadService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async create(
    @Body() dto: CreateEducationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl = dto.imageUrl;
    if (file) {
      imageUrl = await this.uploadService.uploadFile(file, 'education');
    }
    return this.educationService.create({ ...dto, imageUrl });
  }

  @Get()
  findAll(@Query('category') category?: string) {
    return this.educationService.findAll(category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.educationService.findOne(Number(id));
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async update(
    @Param('id') id: string, 
    @Body() dto: Partial<CreateEducationDto>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl = dto.imageUrl;
    if (file) {
      imageUrl = await this.uploadService.uploadFile(file, 'education');
    }
    const updateData = { ...dto };
    if (imageUrl) updateData.imageUrl = imageUrl;
    
    return this.educationService.update(Number(id), updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.educationService.remove(Number(id));
  }

  /** Upload / replace image for an education content item */
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = await this.uploadService.uploadFile(file, 'education');
    return this.educationService.update(Number(id), { imageUrl });
  }
}
