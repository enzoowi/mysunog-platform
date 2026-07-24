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
import { diskStorage } from 'multer';
import { extname } from 'path';

const photoStorage = diskStorage({
  destination: './uploads/bplo-slips',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `fsic-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

@UseGuards(AuthGuard('jwt'))
@Controller('permits')
export class PermitsController {
  constructor(private permitsService: PermitsService) {}

  // Citizen: create request
  @Post()
  @UseInterceptors(
    FileInterceptor('bploSlip', {
      storage: photoStorage,
      fileFilter: imageFileFilter,
    }),
  )
  create(
    @Body() dto: CreatePermitDto,
    @Req() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      dto.bploSlipUrl = `/uploads/bplo-slips/${file.filename}`;
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
