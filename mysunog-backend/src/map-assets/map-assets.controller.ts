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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { MapAssetsService } from './map-assets.service';

const photoStorage = diskStorage({
  destination: './uploads/map-assets',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `map-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

@Controller('map')
export class MapAssetsController {
  constructor(private mapAssetsService: MapAssetsService) {}

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
  createHydrant(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    if (file) body.photoUrl = `/uploads/map-assets/${file.filename}`;
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
  updateHydrant(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) body.photoUrl = `/uploads/map-assets/${file.filename}`;
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
  createStation(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    if (file) body.photoUrl = `/uploads/map-assets/${file.filename}`;
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
  updateStation(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) body.photoUrl = `/uploads/map-assets/${file.filename}`;
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
