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
import { PermitsService } from './permits.service';
import { CreatePermitDto } from './dto/create-permit.dto';
import { UpdatePermitStatusDto } from './dto/update-status.dto';
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
@Controller('permits')
export class PermitsController {
  constructor(
    private permitsService: PermitsService,
    private uploadService: UploadService,
  ) {}

  // Citizen: create request
  @Post()
  @UseInterceptors(
    FileInterceptor('bploSlip', {
      storage: photoStorage,
      fileFilter: imageFileFilter,
    }),
  )
  async create(
    @Body() dto: CreatePermitDto,
    @Req() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      dto.bploSlipUrl = await this.uploadService.uploadFile(file, 'bplo-slips');
    }
    return this.permitsService.create(dto, { id: req.user.userId } as any);
  }

  // Citizen: view my requests
  @Get('mine')
  mine(@Req() req: any) {
    return this.permitsService.listForUser(req.user.userId);
  }

  // Admin: view all
  @Get()
  all() {
    return this.permitsService.listAll();
  }

  // Admin: update status
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePermitStatusDto) {
    return this.permitsService.updateStatus(
      Number(id),
      dto.status,
      dto.adminRemarks,
      dto.inspectionDate,
    );
  }

  // Admin: issue certificate
  @Post(':id/issue-certificate')
  issueCertificate(@Param('id') id: string) {
    return this.permitsService.issueCertificate(Number(id));
  }
}
