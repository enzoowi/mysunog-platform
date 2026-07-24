import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermitRequest, PermitStatus } from './permit.entity';
import { CreatePermitDto } from './dto/create-permit.dto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PermitsService {
  constructor(
    @InjectRepository(PermitRequest)
    private repo: Repository<PermitRequest>,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
    private emailService: EmailService,
  ) {}

  async create(dto: CreatePermitDto, user: User) {
    const permit = this.repo.create({
      ...dto,
      createdBy: user,
      status: PermitStatus.SUBMITTED,
    });

    const savedPermit = await this.repo.save(permit);

    const admins = await this.usersService.findAllAdmins();
    for (const admin of admins) {
      await this.notificationsService.createNotification(
        admin,
        'New FSIC Application',
        `A new FSIC application has been submitted by ${user.email} for "${dto.businessName}".`,
      );
    }

    return savedPermit;
  }

  async listForUser(userId: number) {
    return this.repo.find({
      where: { createdBy: { id: userId } },
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
    status: PermitStatus,
    adminRemarks?: string,
    inspectionDate?: string,
  ) {
    const permit = await this.repo.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!permit) {
      throw new NotFoundException('Permit request not found');
    }

    permit.status = status;
    permit.adminRemarks = adminRemarks ?? undefined;
    if (inspectionDate) {
      permit.inspectionDate = new Date(inspectionDate);
    }

    const updatedPermit = await this.repo.save(permit);

    let message = `Your FSIC application for "${permit.businessName}" is now "${status}".`;
    if (inspectionDate) {
      const d = new Date(inspectionDate);
      message += ` Inspection scheduled: ${d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} at ${d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}.`;
    }

    await this.notificationsService.createNotification(
      permit.createdBy,
      'FSIC Application Update',
      message,
    );

    // Send email notification
    const applicant = permit.createdBy;
    const applicantName = [applicant.firstName, applicant.lastName].filter(Boolean).join(' ') || undefined;
    await this.emailService.sendPermitStatusUpdate({
      applicantEmail: applicant.email,
      applicantName,
      permitType: 'FSIC',
      businessName: permit.businessName,
      status,
      adminRemarks: adminRemarks || undefined,
      inspectionDate: inspectionDate
        ? new Date(inspectionDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : undefined,
    });

    return updatedPermit;
  }

  async issueCertificate(id: number) {
    const permit = await this.repo.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!permit) {
      throw new NotFoundException('Permit request not found');
    }

    // Generate PDF
    const pdfBuffer = await this.generateFsicPdf(permit);

    // Save to disk
    const filename = `fsic-cert-${permit.id}-${Date.now()}.pdf`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'certificates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    // Update permit
    permit.status = PermitStatus.ISSUED;
    permit.certificateUrl = `/uploads/certificates/${filename}`;
    await this.repo.save(permit);

    // Notify applicant
    await this.notificationsService.createNotification(
      permit.createdBy,
      'FSIC Certificate Issued',
      `Your Fire Safety Inspection Certificate for "${permit.businessName}" has been issued. You can download it from your permits page.`,
    );

    // Send email with certificate link
    const applicant = permit.createdBy;
    const applicantName = [applicant.firstName, applicant.lastName].filter(Boolean).join(' ') || undefined;
    await this.emailService.sendPermitStatusUpdate({
      applicantEmail: applicant.email,
      applicantName,
      permitType: 'FSIC',
      businessName: permit.businessName,
      status: 'issued',
      certificateUrl: permit.certificateUrl || undefined,
    });

    return permit;
  }

  private async generateFsicPdf(permit: PermitRequest): Promise<Buffer> {
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

      // ── FSIC Badge (top-right) ──
      doc.save();
      doc.rect(pageW - 150, 30, 110, 40).fill('#b91c1c');
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('FSIC', pageW - 145, 35, { width: 100, align: 'center' });
      doc.fontSize(7).text('APPLICATION FORM', pageW - 145, 57, {
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
        .font('Helvetica-Bold')
        .fillColor('#b91c1c')
        .text('AUTOMATED CLEARANCE SYSTEM', 110, y, {
          width: contentW - 150,
          align: 'center',
        });
      y += 12;
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#333333')
        .text('Service made FAST - EASY - RELIABLE', 110, y, {
          width: contentW - 150,
          align: 'center',
        });
      y += 12;
      doc.fontSize(8).text('Municipality of Malvar, Batangas', 110, y, {
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
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('FIRE SAFETY INSPECTION CERTIFICATE', 40, y, {
          width: contentW,
          align: 'center',
        });
      y += 25;

      // ── Certificate Number & Date ──
      doc.fontSize(9).font('Helvetica');
      doc.text(
        `Certificate No: FSIC-${String(permit.id).padStart(5, '0')}`,
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
          .moveTo(180, atY + 12)
          .lineTo(pageW - 40, atY + 12)
          .lineWidth(0.5)
          .stroke('#999');
        doc.font('Helvetica').text(value || 'N/A', 185, atY);
        return atY + 28;
      };

      const user = permit.createdBy;
      const applicantName = user
        ? `${user.firstName || ''} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName || ''}`.trim() ||
          user.email
        : 'N/A';

      y = drawField('NAME OF OWNER:', applicantName, y);
      y = drawField('ESTABLISHMENT NAME:', permit.businessName, y);

      const address = [
        permit.houseNumber,
        permit.streetName,
        permit.subdivision,
        `Brgy. ${permit.barangay}`,
        'Malvar, Batangas',
      ]
        .filter(Boolean)
        .join(', ');
      y = drawField('EXACT BUSINESS ADDRESS:', address, y);
      y = drawField('BUSINESS NATURE:', permit.description || 'N/A', y);
      y = drawField(
        'APPLICATION TYPE:',
        'FSIC - Fire Safety Inspection Certificate',
        y,
      );

      if (permit.inspectionDate) {
        const inspDate = new Date(permit.inspectionDate);
        y = drawField(
          'INSPECTION DATE:',
          inspDate.toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          y,
        );
      }

      y += 10;

      // ── Certification Box ──
      doc.rect(40, y, contentW, 80).lineWidth(1).stroke('#b91c1c');
      y += 10;
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          'This is to certify that the above-mentioned establishment has been inspected and found to be in compliance with the fire safety requirements prescribed under Republic Act No. 9514, otherwise known as the "Fire Code of the Philippines of 2008" and its Revised Implementing Rules and Regulations.',
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
          'BFP-QSF-FSED-002 REV.00 — Generated by mySunog System',
          40,
          footerY + 22,
          { width: contentW, align: 'center' },
        );

      doc.end();
    });
  }
}
