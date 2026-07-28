import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { UploadService } from '../upload/upload.service';

const photoStorage = memoryStorage();

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

@UseGuards(AuthGuard('jwt'))
@Controller('inspections')
export class InspectionsController {
  constructor(
    private inspectionsService: InspectionsService,
    private uploadService: UploadService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('bploSlip', {
      storage: photoStorage,
      fileFilter: imageFileFilter,
    }),
  )
  async create(
    @Body() dto: CreateInspectionDto,
    @Req() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      dto.bploSlipUrl = await this.uploadService.uploadFile(file, 'bplo-slips');
    }
    return this.inspectionsService.create(dto, { id: req.user.userId } as any);
  }

  @Get('mine')
  mine(@Req() req: any) {
    return this.inspectionsService.listForUser(req.user.userId);
  }

  @Get()
  all() {
    return this.inspectionsService.listAll();
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateInspectionDto) {
    return this.inspectionsService.updateStatus(
      Number(id),
      dto.status,
      dto.adminNotes,
      dto.scheduledDate,
      dto.scheduledTime,
    );
  }

  // Admin: issue certificate
  @Post(':id/issue-certificate')
  issueCertificate(@Param('id') id: string) {
    return this.inspectionsService.issueCertificate(Number(id));
  }
}
