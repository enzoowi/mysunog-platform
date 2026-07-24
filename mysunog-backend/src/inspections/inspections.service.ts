import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection, InspectionStatus } from './inspection.entity';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(Inspection)
    private repo: Repository<Inspection>,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
    private emailService: EmailService,
  ) {}

  async create(dto: CreateInspectionDto, user: User) {
    const inspection = this.repo.create({
      ...dto,
      requestedBy: user,
      status: InspectionStatus.PENDING,
    });
    const savedInspection = await this.repo.save(inspection);

    const admins = await this.usersService.findAllAdmins();
    for (const admin of admins) {
      await this.notificationsService.createNotification(
        admin,
        'New FSEC Application',
        `A new FSEC application has been submitted by ${user.email} for "${dto.businessName}".`,
      );
    }

    return savedInspection;
  }

  async listForUser(userId: number) {
    return this.repo.find({
      where: { requestedBy: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async listAll() {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: number,
    status: InspectionStatus,
    adminNotes?: string,
    scheduledDate?: string,
    scheduledTime?: string,
  ) {
    const inspection = await this.repo.findOne({
      where: { id },
      relations: ['requestedBy'],
    });

    if (!inspection) {
      throw new NotFoundException('Inspection request not found');
    }

    inspection.status = status;
    if (adminNotes !== undefined) inspection.adminNotes = adminNotes;
    if (scheduledDate !== undefined) inspection.scheduledDate = scheduledDate;
    if (scheduledTime !== undefined) inspection.scheduledTime = scheduledTime;

    const updated = await this.repo.save(inspection);

    let message = `Your FSEC application for "${inspection.businessName}" is now "${status}".`;
    if (scheduledDate) {
      message += ` Inspection scheduled: ${scheduledDate}${scheduledTime ? ' at ' + scheduledTime : ''}.`;
    }

    await this.notificationsService.createNotification(
      inspection.requestedBy,
      'FSEC Application Update',
      message,
    );

    // Send email notification
    const applicant = inspection.requestedBy;
    const applicantName = [applicant.firstName, applicant.lastName].filter(Boolean).join(' ') || undefined;
    await this.emailService.sendPermitStatusUpdate({
      applicantEmail: applicant.email,
      applicantName,
      permitType: 'FSEC',
      businessName: inspection.businessName,
      status,
      adminRemarks: adminNotes || undefined,
      inspectionDate: scheduledDate || undefined,
      inspectionTime: scheduledTime || undefined,
    });

    return updated;
  }

  async issueCertificate(id: number) {
    const inspection = await this.repo.findOne({
      where: { id },
      relations: ['requestedBy'],
    });

    if (!inspection) {
      throw new NotFoundException('Inspection request not found');
    }

    // Generate PDF
    const pdfBuffer = await this.generateFsecPdf(inspection);

    // Save to disk
    const filename = `fsec-cert-${inspection.id}-${Date.now()}.pdf`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'certificates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    // Update inspection
    inspection.status = InspectionStatus.ISSUED;
    inspection.certificateUrl = `/uploads/certificates/${filename}`;
    await this.repo.save(inspection);

    // Notify applicant
    await this.notificationsService.createNotification(
      inspection.requestedBy,
      'FSEC Certificate Issued',
      `Your Fire Safety Evaluation Clearance for "${inspection.businessName}" has been issued. You can download it from your permits page.`,
    );

    // Send email with certificate link
    const applicant = inspection.requestedBy;
    const applicantName = [applicant.firstName, applicant.lastName].filter(Boolean).join(' ') || undefined;
    await this.emailService.sendPermitStatusUpdate({
      applicantEmail: applicant.email,
      applicantName,
      permitType: 'FSEC',
      businessName: inspection.businessName,
      status: 'issued',
      certificateUrl: inspection.certificateUrl || undefined,
    });

    return inspection;
  }

  private async generateFsecPdf(inspection: Inspection): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new (PDFDocument as any)({ margin: 40, size: 'A4' });
      const chunks: any[] = [];
      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageW = doc.page.width;
      const contentW = pageW - 80;

      // ── Try to add BFP Logo ──
      const logoPath = path.join(process.cwd(), 'uploads', 'bfp-logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 30, { width: 60 });
      }

      // ── FSEC Badge (top-right) ──
      doc.save();
      doc.rect(pageW - 150, 30, 110, 40).fill('#b91c1c');
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('FSEC', pageW - 145, 35, { width: 100, align: 'center' });
      doc.fontSize(7).text('APPLICATION NUMBER', pageW - 145, 57, {
        width: 100,
        align: 'center',
      });
      doc.restore();
      doc.fillColor('#000000');

      // ── Header ──
      let y = 35;
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('BUREAU OF FIRE PROTECTION', 110, y, {
          width: contentW - 150,
          align: 'center',
        });
      y += 16;
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#333333')
        .text('MIMAROPA Region', 110, y, {
          width: contentW - 150,
          align: 'center',
        });
      y += 11;
      doc.text('Province of Oriental Mindoro', 110, y, {
        width: contentW - 150,
        align: 'center',
      });
      y += 11;
      doc.text('Municipality of Malvar, Batangas', 110, y, {
        width: contentW - 150,
        align: 'center',
      });
      doc.fillColor('#000000');

      // ── Red divider ──
      y += 20;
      doc
        .moveTo(40, y)
        .lineTo(pageW - 40, y)
        .lineWidth(2)
        .stroke('#b91c1c');
      y += 3;
      doc
        .moveTo(40, y)
        .lineTo(pageW - 40, y)
        .lineWidth(0.5)
        .stroke('#b91c1c');
      y += 15;

      // ── Title ──
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('FIRE SAFETY EVALUATION CLEARANCE', 40, y, {
          width: contentW,
          align: 'center',
        });
      y += 16;
      doc
        .fontSize(10)
        .text('APPLICATION FORM', 40, y, { width: contentW, align: 'center' });
      y += 25;

      // ── Certificate Number & Date ──
      doc.fontSize(9).font('Helvetica');
      doc.text(
        `Certificate No: FSEC-${String(inspection.id).padStart(5, '0')}`,
        40,
        y,
      );
      doc.text(
        `Date Issued: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        300,
        y,
      );
      y += 25;

      // ── Form Fields ──
      const drawField = (label: string, value: string, atY: number) => {
        doc.fontSize(9).font('Helvetica-Bold').text(label, 40, atY);
        doc
          .moveTo(200, atY + 12)
          .lineTo(pageW - 40, atY + 12)
          .lineWidth(0.5)
          .stroke('#999');
        doc.font('Helvetica').text(value || 'N/A', 205, atY);
        return atY + 28;
      };

      const user = inspection.requestedBy;
      const applicantName = user
        ? `${user.firstName || ''} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName || ''}`.trim() ||
          user.email
        : 'N/A';

      y = drawField('PROJECT OWNER:', applicantName, y);
      y = drawField('PROJECT TITLE:', inspection.businessName, y);

      const address = [
        inspection.houseNumber,
        inspection.streetName,
        inspection.subdivision,
        `Brgy. ${inspection.barangay}`,
        'Malvar, Batangas',
      ]
        .filter(Boolean)
        .join(', ');
      y = drawField('PROJECT LOCATION:', address, y);
      y = drawField('DESCRIPTION:', inspection.description || 'N/A', y);
      y = drawField(
        'APPLICATION TYPE:',
        'FSEC - Fire Safety Evaluation Clearance',
        y,
      );

      if (inspection.scheduledDate) {
        const schedStr =
          inspection.scheduledDate +
          (inspection.scheduledTime ? ` at ${inspection.scheduledTime}` : '');
        y = drawField('INSPECTION DATE:', schedStr, y);
      }

      y += 10;

      // ── Certification Box ──
      doc.rect(40, y, contentW, 80).lineWidth(1).stroke('#b91c1c');
      y += 10;
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          'This is to certify that the above-mentioned project/building has been evaluated and found to be in compliance with the fire safety requirements prescribed under Republic Act No. 9514, otherwise known as the "Fire Code of the Philippines of 2008" and its Revised Implementing Rules and Regulations.',
          55,
          y,
          { width: contentW - 30, align: 'justify', lineGap: 3 },
        );
      y += 95;

      // ── Signature Block ──
      y += 20;
      doc
        .fontSize(9)
        .font('Helvetica')
        .text('Approved by:', pageW / 2 - 80, y);
      y += 30;
      doc
        .moveTo(pageW / 2 - 80, y)
        .lineTo(pageW / 2 + 80, y)
        .lineWidth(0.5)
        .stroke('#333');
      y += 5;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('FIRE MARSHAL', pageW / 2 - 80, y, {
          width: 160,
          align: 'center',
        });
      y += 14;
      doc
        .fontSize(8)
        .font('Helvetica')
        .text('Chief, Fire Safety Enforcement', pageW / 2 - 80, y, {
          width: 160,
          align: 'center',
        });
      y += 12;
      doc.text('BFP Malvar Fire Station', pageW / 2 - 80, y, {
        width: 160,
        align: 'center',
      });

      // ── Footer ──
      const footerY = doc.page.height - 60;
      doc
        .moveTo(40, footerY)
        .lineTo(pageW - 40, footerY)
        .lineWidth(0.5)
        .stroke('#d1d5db');
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#b91c1c')
        .text('"FIRE SAFETY IS OUR MAIN CONCERN"', 40, footerY + 8, {
          width: contentW,
          align: 'center',
        });
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text(
          'BFP-QSF-FSED-001 REV.01 — Generated by mySunog System',
          40,
          footerY + 22,
          { width: contentW, align: 'center' },
        );

      doc.end();
    });
  }
}
