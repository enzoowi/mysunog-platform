import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FireIncident } from '../incidents/fire-incident.entity';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(FireIncident)
    private incidentsRepo: Repository<FireIncident>,
  ) {}

  async getIncidents(barangay?: string, startDate?: string, endDate?: string) {
    const query = this.incidentsRepo.createQueryBuilder('incident');
    if (barangay && barangay !== 'All') {
      query.andWhere('incident.barangay = :barangay', { barangay });
    }
    if (startDate) {
      query.andWhere('incident.incidentDate >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('incident.incidentDate <= :endDate', { endDate });
    }
    query.orderBy('incident.incidentDate', 'DESC');
    return query.getMany();
  }

  // ── Shared PDF helpers ──────────────────────────────────────────────
  private drawGovHeader(doc: PDFKit.PDFDocument) {
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Republic of the Philippines', 0, 40, { align: 'center' });
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('BUREAU OF FIRE PROTECTION', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Municipality of Malvar, Batangas', { align: 'center' });
    doc.moveDown(0.3);
    // Horizontal rule
    doc
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .lineWidth(1.5)
      .stroke('#b91c1c');
    doc
      .moveTo(40, doc.y + 3)
      .lineTo(doc.page.width - 40, doc.y + 3)
      .lineWidth(0.5)
      .stroke('#b91c1c');
    doc.y += 10;
  }

  private drawFooter(doc: PDFKit.PDFDocument, pageNum: number) {
    const bottom = doc.page.height - 40;
    doc.save();
    doc
      .moveTo(40, bottom - 15)
      .lineTo(doc.page.width - 40, bottom - 15)
      .lineWidth(0.5)
      .stroke('#d1d5db');
    doc.fontSize(7).font('Helvetica').fillColor('#6b7280');
    doc.text(
      'This is a system-generated document from mySunog — BFP Malvar Fire Incident Management System.',
      40,
      bottom - 10,
      { align: 'center', width: doc.page.width - 80 },
    );
    doc.text(`Page ${pageNum}`, 0, bottom, { align: 'center' });
    doc.fillColor('#000000');
    doc.restore();
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#991b1b').text(title);
    doc
      .moveTo(40, doc.y + 2)
      .lineTo(doc.page.width - 40, doc.y + 2)
      .lineWidth(0.5)
      .stroke('#fca5a5');
    doc.moveDown(0.5);
    doc.fillColor('#000000');
  }

  private drawField(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    labelW = 100,
  ) {
    doc.fontSize(9).font('Helvetica-Bold').text(label, x, y);
    doc.font('Helvetica').text(value || 'N/A', x + labelW, y);
  }

  // ── Multi-incident PDF ──────────────────────────────────────────────
  async generatePdf(
    barangay?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const incidents = await this.getIncidents(barangay, startDate, endDate);

    return new Promise((resolve) => {
      const doc = new (PDFDocument as any)({
        margin: 40,
        size: 'A4',
        bufferPages: true,
      });
      const chunks: any[] = [];
      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Page 1 header
      this.drawGovHeader(doc);
      doc.moveDown(0.5);
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('FIRE INCIDENT REPORT', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563');
      doc.text(
        `Date Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        { align: 'center' },
      );
      if (barangay && barangay !== 'All')
        doc.text(`Barangay: ${barangay}`, { align: 'center' });
      if (startDate || endDate)
        doc.text(`Period: ${startDate || '...'} to ${endDate || '...'}`, {
          align: 'center',
        });
      doc.fillColor('#000000');
      doc.moveDown(1);

      // Summary box
      const totalDmg = incidents.reduce(
        (s, i) => s + Number(i.estimatedDamage || 0),
        0,
      );
      const totalCas = incidents.reduce(
        (s, i) => s + Number(i.casualties || 0),
        0,
      );
      const totalInj = incidents.reduce(
        (s, i) => s + Number(i.injuries || 0),
        0,
      );

      const boxY = doc.y;
      doc
        .rect(40, boxY, doc.page.width - 80, 50)
        .fillAndStroke('#fef2f2', '#fca5a5');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      doc.text(`Total Incidents: ${incidents.length}`, 55, boxY + 10);
      doc.text(
        `Total Est. Damage: ₱${totalDmg.toLocaleString()}`,
        55,
        boxY + 25,
      );
      doc.text(`Total Casualties: ${totalCas}`, 300, boxY + 10);
      doc.text(`Total Injuries: ${totalInj}`, 300, boxY + 25);
      doc.y = boxY + 60;
      doc.font('Helvetica');

      // Table header
      const cols = [
        { label: '#', w: 22 },
        { label: 'Date', w: 55 },
        { label: 'Time', w: 38 },
        { label: 'Barangay', w: 68 },
        { label: 'Cause', w: 55 },
        { label: 'Property', w: 55 },
        { label: 'Damage (₱)', w: 60 },
        { label: 'Cas.', w: 25 },
        { label: 'Inj.', w: 25 },
        { label: 'Remarks', w: 112 },
      ];
      const tableLeft = 40;
      const tableW = cols.reduce((s, c) => s + c.w, 0);
      const rowH = 16;

      function drawTableHeader(d: any, y: number) {
        d.rect(tableLeft, y, tableW, rowH).fillAndStroke('#991b1b', '#991b1b');
        d.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
        let cx = tableLeft;
        cols.forEach((c) => {
          d.text(c.label, cx + 3, y + 4, { width: c.w - 6 });
          cx += c.w;
        });
        d.fillColor('#000000').font('Helvetica');
        return y + rowH;
      }

      let curY = drawTableHeader(doc, doc.y);
      let pageNum = 1;

      incidents.forEach((inc, idx) => {
        if (curY + rowH > doc.page.height - 60) {
          this.drawFooter(doc, pageNum);
          pageNum++;
          doc.addPage();
          this.drawGovHeader(doc);
          doc.moveDown(0.3);
          curY = drawTableHeader(doc, doc.y);
        }
        const fill = idx % 2 === 0 ? '#ffffff' : '#fef2f2';
        doc.rect(tableLeft, curY, tableW, rowH).fillAndStroke(fill, '#e5e7eb');
        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        let cx = tableLeft;
        const vals = [
          String(idx + 1),
          inc.incidentDate,
          inc.incidentTime,
          inc.barangay,
          inc.cause || 'N/A',
          inc.propertyType || 'N/A',
          Number(inc.estimatedDamage || 0).toLocaleString(),
          String(inc.casualties || 0),
          String(inc.injuries || 0),
          (inc.remarks || '').substring(0, 40),
        ];
        vals.forEach((v, vi) => {
          doc.text(v, cx + 3, curY + 4, { width: cols[vi].w - 6 });
          cx += cols[vi].w;
        });
        curY += rowH;
      });

      this.drawFooter(doc, pageNum);
      doc.end();
    });
  }

  // ── Single incident PDF ─────────────────────────────────────────────
  async generateSingleIncidentPdf(id: number): Promise<any> {
    const incident = await this.incidentsRepo.findOne({ where: { id } });
    if (!incident) throw new Error('Incident not found');

    return new Promise(async (resolve) => {
      const doc = new (PDFDocument as any)({ margin: 40, size: 'A4' });
      const chunks: any[] = [];
      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.drawGovHeader(doc);
      doc.moveDown(0.2);
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('FIRE INCIDENT INVESTIGATION REPORT', { align: 'center' });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `Control No. ${String(incident.id).padStart(4, '0')}  |  Generated: ${new Date().toLocaleDateString('en-PH')}`,
          { align: 'center' },
        );
      doc.moveDown(0.8);

      let cy = doc.y;
      const left = 40;
      const width = doc.page.width - 80;
      const mid = left + width / 2;

      // Helper to draw boxed sections like an official form
      const drawBoxedSection = (
        title: string,
        height: number,
        drawContent: (y: number) => void,
      ) => {
        doc.rect(left, cy, width, height).fillAndStroke('#fcfcfc', '#d1d5db');
        doc.rect(left, cy, width, 18).fillAndStroke('#991b1b', '#991b1b');
        doc
          .fillColor('#ffffff')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(title, left + 8, cy + 5);
        doc.fillColor('#000000');
        drawContent(cy + 24); // Content start Y
        cy += height + 12; // Move down for next section
      };

      // I. INCIDENT INFORMATION (Height: 65)
      drawBoxedSection('I. INCIDENT INFORMATION', 65, (y) => {
        this.drawField(doc, 'Date:', incident.incidentDate, left + 8, y, 60);
        this.drawField(doc, 'Time:', incident.incidentTime, mid + 8, y, 60);
        this.drawField(doc, 'Barangay:', incident.barangay, left + 8, y + 16, 60);
        this.drawField(doc, 'Landmark:', incident.landmark || 'N/A', mid + 8, y + 16, 60);
        this.drawField(doc, 'GPS Coords:', `${incident.latitude}, ${incident.longitude}`, left + 8, y + 32, 60);
      });

      // II. REPORTER INFORMATION (Height: 45)
      drawBoxedSection('II. REPORTER INFORMATION', 45, (y) => {
        this.drawField(doc, 'Name:', incident.reporterName || 'N/A', left + 8, y, 60);
        this.drawField(doc, 'Contact No.:', incident.reporterContact || 'N/A', mid + 8, y, 60);
      });

      // III. ASSESSMENT & DAMAGES (Height: 65)
      drawBoxedSection('III. ASSESSMENT & DAMAGES', 65, (y) => {
        this.drawField(doc, 'Cause:', incident.cause || 'Under Investigation', left + 8, y, 60);
        this.drawField(doc, 'Property:', incident.propertyType || 'N/A', mid + 8, y, 60);
        this.drawField(doc, 'Est. Damage:', `Php ${Number(incident.estimatedDamage || 0).toLocaleString()}`, left + 8, y + 16, 60);
        this.drawField(doc, 'Casualties:', String(incident.casualties || 0), mid + 8, y + 16, 60);
        this.drawField(doc, 'Injuries:', String(incident.injuries || 0), left + 8, y + 32, 60);
      });

      // IV. RESPONSE PERFORMANCE (Height: 45)
      drawBoxedSection('IV. RESPONSE PERFORMANCE', 45, (y) => {
        const perfW = width / 4;
        this.drawField(doc, 'Alarm:', incident.alarmTime || 'N/A', left + 8, y, 40);
        this.drawField(doc, 'Response:', incident.responseTime || 'N/A', left + perfW + 8, y, 50);
        this.drawField(doc, 'Control:', incident.controlTime || 'N/A', left + perfW * 2 + 8, y, 45);
        this.drawField(doc, 'Fire Out:', incident.fireOutTime || 'N/A', left + perfW * 3 + 8, y, 45);
      });

      // V. REMARKS / NARRATIVE (Height: 120)
      drawBoxedSection('V. REMARKS / NARRATIVE', 120, (y) => {
        doc.fontSize(9).font('Helvetica').text(incident.remarks || 'No narrative provided.', left + 8, y, {
          width: width - 16,
          align: 'justify',
        });
      });

      // Signatures - strictly pinned to the bottom of the first page
      cy = Math.max(cy + 10, doc.page.height - 160);

      const investigatorName = incident.fireInvestigator
        ? incident.fireInvestigator.toUpperCase()
        : '';
      
      // Investigator Signature
      if (investigatorName) {
        doc.fontSize(10).font('Helvetica-Bold').text(investigatorName, left, cy - 12);
      }
      doc.moveTo(left, cy).lineTo(left + 180, cy).stroke('#000');
      doc.fontSize(9).font('Helvetica-Bold').text('Prepared by:', left, cy + 5);
      doc.font('Helvetica').text('Fire Investigator', left, cy + 17);

      // Incident Images
      let pageNum = 1;
      this.drawFooter(doc, pageNum);

      let imagesArray: string[] = [];
      if (Array.isArray(incident.images)) {
        imagesArray = incident.images;
      } else if (typeof incident.images === 'string') {
        let str = incident.images as string;
        if (str.startsWith('{') && str.endsWith('}')) {
          str = str.slice(1, -1);
        }
        imagesArray = str.split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(s => s.length > 0);
      }

      if (imagesArray.length > 0) {
        // Start a new page immediately after the report
        doc.addPage();
        pageNum++;

        // Draw the same government header for continuity
        this.drawGovHeader(doc);
        doc.moveDown(0.3);

        // Section title styled like the report
        doc.fontSize(14).font('Helvetica-Bold').text('INCIDENT IMAGES', { align: 'center' });
        doc.fontSize(9).font('Helvetica').text(
          `Fire Incident #${String(incident.id).padStart(4, '0')}  —  ${incident.barangay}  —  ${incident.incidentDate}`,
          { align: 'center' },
        );
        doc.moveDown(1);

        this.drawFooter(doc, pageNum);

        let currentY = doc.y;
        const maxImgWidth = 420;
        const maxImgHeight = 280;
        const gap = 25;

        for (let i = 0; i < imagesArray.length; i++) {
          const url = imagesArray[i];
          try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Check if image fits on current page, otherwise add a new one
            if (currentY + maxImgHeight + 25 > doc.page.height - 60) {
              doc.addPage();
              pageNum++;
              this.drawFooter(doc, pageNum);
              currentY = 40;
            }

            // Center the image horizontally
            const x = (doc.page.width - maxImgWidth) / 2;
            doc.image(buffer, x, currentY, {
              fit: [maxImgWidth, maxImgHeight],
              align: 'center',
              valign: 'center',
            });

            // Label below the image
            doc.fontSize(8).font('Helvetica').fillColor('#666666').text(
              `Image ${i + 1} of ${imagesArray.length}`,
              x, currentY + maxImgHeight + 4,
              { width: maxImgWidth, align: 'center' },
            );
            doc.fillColor('#000000');

            currentY += maxImgHeight + gap + 12;
          } catch (e) {
            console.error('Failed to load image for PDF', e);
          }
        }
      }

      doc.end();
    });
  }

  // ── Excel report ────────────────────────────────────────────────────
  async generateExcel(
    barangay?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const incidents = await this.getIncidents(barangay, startDate, endDate);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'mySunog - BFP Malvar';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Fire Incidents');

    // Title row
    sheet.mergeCells('A1:T1');
    const titleCell = sheet.getCell('A1');
    titleCell.value =
      'BUREAU OF FIRE PROTECTION — MUNICIPALITY OF MALVAR, BATANGAS';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF991B1B' },
    };
    sheet.getRow(1).height = 32;

    // Subtitle row
    sheet.mergeCells('A2:T2');
    const subCell = sheet.getCell('A2');
    const filterParts = ['FIRE INCIDENT REPORT'];
    if (barangay && barangay !== 'All')
      filterParts.push(`Barangay: ${barangay}`);
    if (startDate || endDate)
      filterParts.push(`Period: ${startDate || '...'} to ${endDate || '...'}`);
    filterParts.push(
      `Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    );
    subCell.value = filterParts.join('  |  ');
    subCell.font = { bold: true, size: 10, color: { argb: 'FF4B5563' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF1F2' },
    };
    sheet.getRow(2).height = 22;

    // Empty spacer row
    sheet.getRow(3).height = 6;

    // Define columns starting at row 4
    const headers = [
      { key: 'id', header: 'ID', width: 6 },
      { key: 'incidentDate', header: 'Date', width: 12 },
      { key: 'incidentTime', header: 'Time', width: 9 },
      { key: 'barangay', header: 'Barangay', width: 16 },
      { key: 'cause', header: 'Cause', width: 14 },
      { key: 'propertyType', header: 'Property Type', width: 14 },
      { key: 'landmark', header: 'Nearest Landmark', width: 18 },
      { key: 'estimatedDamage', header: 'Est. Damage (₱)', width: 16 },
      { key: 'casualties', header: 'Casualties', width: 10 },
      { key: 'injuries', header: 'Injuries', width: 10 },
      { key: 'reporterName', header: 'Reporter Name', width: 16 },
      { key: 'reporterContact', header: 'Reporter Contact', width: 15 },
      { key: 'fireInvestigator', header: 'Fire Investigator', width: 18 },
      { key: 'alarmTime', header: 'Alarm Time', width: 11 },
      { key: 'responseTime', header: 'Response Time', width: 12 },
      { key: 'controlTime', header: 'Control Time', width: 11 },
      { key: 'fireOutTime', header: 'Fire Out Time', width: 12 },
      { key: 'latitude', header: 'Latitude', width: 12 },
      { key: 'longitude', header: 'Longitude', width: 12 },
      { key: 'remarks', header: 'Remarks', width: 30 },
    ];

    // Set column widths
    headers.forEach((h, i) => {
      sheet.getColumn(i + 1).width = h.width;
    });

    // Header row (row 4)
    const headerRow = sheet.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h.header;
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB91C1C' },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF991B1B' } },
        bottom: { style: 'thin', color: { argb: 'FF991B1B' } },
        left: { style: 'thin', color: { argb: 'FF991B1B' } },
        right: { style: 'thin', color: { argb: 'FF991B1B' } },
      };
    });
    headerRow.height = 24;

    // Data rows
    incidents.forEach((inc, idx) => {
      const row = sheet.getRow(5 + idx);
      const values = [
        inc.id,
        inc.incidentDate,
        inc.incidentTime,
        inc.barangay,
        inc.cause || 'N/A',
        inc.propertyType || 'N/A',
        inc.landmark || '',
        Number(inc.estimatedDamage || 0),
        inc.casualties || 0,
        inc.injuries || 0,
        inc.reporterName || '',
        inc.reporterContact || '',
        inc.fireInvestigator || '',
        inc.alarmTime || '',
        inc.responseTime || '',
        inc.controlTime || '',
        inc.fireOutTime || '',
        Number(inc.latitude),
        Number(inc.longitude),
        inc.remarks || '',
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 9 };
        cell.alignment = { vertical: 'middle', wrapText: true };
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFFF5F5';
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
      // Format damage as number
      row.getCell(8).numFmt = '#,##0.00';
    });

    // Summary row
    const sumRowIdx = 5 + incidents.length + 1;
    const sumRow = sheet.getRow(sumRowIdx);
    sheet.mergeCells(`A${sumRowIdx}:F${sumRowIdx}`);
    sumRow.getCell(1).value = `TOTAL — ${incidents.length} incident(s)`;
    sumRow.getCell(1).font = {
      bold: true,
      size: 10,
      color: { argb: 'FF991B1B' },
    };
    sumRow.getCell(8).value = incidents.reduce(
      (s, i) => s + Number(i.estimatedDamage || 0),
      0,
    );
    sumRow.getCell(8).numFmt = '#,##0.00';
    sumRow.getCell(8).font = { bold: true, size: 10 };
    sumRow.getCell(9).value = incidents.reduce(
      (s, i) => s + Number(i.casualties || 0),
      0,
    );
    sumRow.getCell(9).font = { bold: true, size: 10 };
    sumRow.getCell(10).value = incidents.reduce(
      (s, i) => s + Number(i.injuries || 0),
      0,
    );
    sumRow.getCell(10).font = { bold: true, size: 10 };
    for (let i = 1; i <= 20; i++) {
      sumRow.getCell(i).border = {
        top: { style: 'double', color: { argb: 'FF991B1B' } },
        bottom: { style: 'double', color: { argb: 'FF991B1B' } },
      };
    }

    // Auto-filter
    sheet.autoFilter = { from: 'A4', to: `T${4 + incidents.length}` };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}
