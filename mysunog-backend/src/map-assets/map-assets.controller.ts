import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { MapAssetsService } from './map-assets.service';
import { UploadService } from '../upload/upload.service';

const photoStorage = memoryStorage();

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

@Controller('map')
export class MapAssetsController {
  constructor(
    private mapAssetsService: MapAssetsService,
    private uploadService: UploadService,
  ) {}

  // ==================== HYDRANTS ====================
  @Get('hydrants')
  getHydrants() {
    return this.mapAssetsService.findAllHydrants();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('hydrants')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorage,
      fileFilter: imageFileFilter,
    }),
  )
  async createHydrant(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    if (file) body.photoUrl = await this.uploadService.uploadFile(file, 'map-assets');
    return this.mapAssetsService.createHydrant({
      ...body,
      lat: Number(body.lat),
      lng: Number(body.lng),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('hydrants/:id')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorage,
      fileFilter: imageFileFilter,
    }),
  )
  async updateHydrant(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) body.photoUrl = await this.uploadService.uploadFile(file, 'map-assets');
    const data: any = { ...body };
    delete data.id;
    if (body.lat !== undefined) data.lat = Number(body.lat);
    if (body.lng !== undefined) data.lng = Number(body.lng);
    return this.mapAssetsService.updateHydrant(Number(id), data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('hydrants/:id')
  removeHydrant(@Param('id') id: string) {
    return this.mapAssetsService.removeHydrant(Number(id));
  }

  // ==================== BFP STATIONS ====================
  @Get('stations')
  getStations() {
    return this.mapAssetsService.findAllStations();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('stations')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorage,
      fileFilter: imageFileFilter,
    }),
  )
  async createStation(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    if (file) body.photoUrl = await this.uploadService.uploadFile(file, 'map-assets');
    return this.mapAssetsService.createStation({
      ...body,
      lat: Number(body.lat),
      lng: Number(body.lng),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('stations/:id')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorage,
      fileFilter: imageFileFilter,
    }),
  )
  async updateStation(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) body.photoUrl = await this.uploadService.uploadFile(file, 'map-assets');
    const data: any = { ...body };
    delete data.id;
    if (body.lat !== undefined) data.lat = Number(body.lat);
    if (body.lng !== undefined) data.lng = Number(body.lng);
    return this.mapAssetsService.updateStation(Number(id), data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('stations/:id')
  removeStation(@Param('id') id: string) {
    return this.mapAssetsService.removeStation(Number(id));
  }
}
