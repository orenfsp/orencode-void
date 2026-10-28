import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import ExcelJS from "exceljs";
import { existsSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import QRCode from "qrcode";
import { Prisma } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { ReportsService } from "../reports/reports.service";

type CertificateWithRelations = Prisma.ParticipationCertificateGetPayload<{
  include: {
    athlete: true;
    competition: { include: { discipline: true } };
    result: true;
  };
}>;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  async assertProtocolAccess(user: AuthUser, competitionId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      include: { protocol: true },
    });
    if (!competition) throw new NotFoundException("Соревнование не найдено");
    if (
      !["FEDERATION", "MINISTRY"].includes(user.activeRole) &&
      (competition.publicationStatus !== "PUBLISHED" ||
        competition.protocol?.status !== "PUBLISHED")
    )
      throw new ForbiddenException("Протокол ещё не опубликован");
  }

  async protocolPdf(competitionId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        discipline: true,
        protocol: true,
        results: { include: { athlete: true }, orderBy: { place: "asc" } },
      },
    });
    if (!competition) {
      throw new NotFoundException("Соревнование не найдено");
    }
    const number =
      competition.protocol?.number ?? `ЧЕРНОВИК-${competition.id.slice(0, 8)}`;
    return this.pdf((doc) => {
      doc.fontSize(16).text("Протокол соревнования", { align: "center" });
      doc.moveDown();
      doc.fontSize(11).text(`№ ${number}`);
      doc.text(competition.name);
      doc.text(`Дисциплина: ${competition.discipline.name}`);
      doc.text(`Дата: ${competition.startsAt.toLocaleDateString("ru-RU")}`);
      doc.moveDown();
      competition.results.forEach((item) => {
        doc.text(
          `${item.place}. ${item.athlete.lastName} ${item.athlete.firstName} — ${item.score.toString()}`,
        );
      });
    }, `protocol-${number}.pdf`);
  }

  async protocolXlsx(competitionId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        discipline: true,
        results: { include: { athlete: true }, orderBy: { place: "asc" } },
      },
    });
    if (!competition) {
      throw new NotFoundException("Соревнование не найдено");
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Протокол");
    sheet.addRow(["Место", "ФИО", "Баллы"]);
    for (const item of competition.results) {
      sheet.addRow([
        item.place,
        `${item.athlete.lastName} ${item.athlete.firstName}`,
        Number(item.score),
      ]);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `protocol-${competition.name}.xlsx`,
      mime: xlsxMime,
    };
  }

  async teamPdf(teamId: string) {
    const team = await this.prisma.nationalTeam.findUnique({
      where: { id: teamId },
      include: {
        discipline: true,
        ageGroup: true,
        members: { include: { athlete: true } },
      },
    });
    if (!team) {
      throw new NotFoundException("Сборная не найдена");
    }
    return this.pdf((doc) => {
      doc.fontSize(16).text("Список сборной региона", { align: "center" });
      doc.moveDown();
      doc.fontSize(11).text(team.title);
      doc.text(
        `${team.discipline.name}, ${team.ageGroup.name}, сезон ${team.season}`,
      );
      doc.moveDown();
      team.members.forEach((member, index) => {
        doc.text(
          `${index + 1}. ${member.athlete.lastName} ${member.athlete.firstName} (${member.source})`,
        );
      });
    }, `sbornaya-${team.season}-${team.discipline.code}.pdf`);
  }

  async teamOrderDocx(teamId: string) {
    const team = await this.prisma.nationalTeam.findUnique({
      where: { id: teamId },
      include: {
        discipline: true,
        ageGroup: true,
        members: { include: { athlete: true } },
      },
    });
    if (!team) {
      throw new NotFoundException("Сборная не найдена");
    }
    const members = team.members
      .map((member, index) =>
        `${index + 1}. ${member.athlete.lastName} ${member.athlete.firstName} ${member.athlete.middleName ?? ""}`.trim(),
      )
      .join("\n");
    const zip = new PizZip(this.minimalDocx());
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.render({
      title: team.title,
      discipline: team.discipline.name,
      ageGroup: team.ageGroup.name,
      season: String(team.season),
      date: new Date().toLocaleDateString("ru-RU"),
      members,
    });
    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    return {
      buffer,
      filename: `proekt-prikaza-sbornaya-${team.season}.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  async athleteHistoryPdf(user: AuthUser, athleteId: string) {
    await this.assertAthleteAccess(user, athleteId);
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        results: {
          where: { status: "PUBLISHED" },
          include: { competition: { include: { discipline: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!athlete) {
      throw new NotFoundException("Спортсмен не найден");
    }
    return this.pdf((doc) => {
      doc
        .fontSize(16)
        .text("История соревнований спортсмена", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(11)
        .text(
          `${athlete.lastName} ${athlete.firstName} ${athlete.middleName ?? ""}`,
        );
      doc.moveDown();
      athlete.results.forEach((item) => {
        doc.text(
          `${item.competition.startsAt.toLocaleDateString("ru-RU")} — ${item.competition.name} (${item.competition.discipline.name}): место ${item.place}, баллы ${item.score.toString()}`,
        );
      });
    }, `istoriya-${athlete.lastName}.pdf`);
  }

  async headcountXlsx() {
    const data = await this.reports.headcount();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Численность");
    sheet.addRow(["Демонстрационные данные"]);
    sheet.addRow(["Всего спортсменов", data.total]);
    sheet.addRow([]);
    sheet.addRow(["Дисциплина", "Количество"]);
    data.byDiscipline.forEach((item) => sheet.addRow([item.name, item.count]));
    sheet.addRow([]);
    sheet.addRow(["Организация", "Количество"]);
    data.byOrganization.forEach((item) =>
      sheet.addRow([item.name, item.count]),
    );
    sheet.addRow([]);
    sheet.addRow(["Муниципалитет", "Количество"]);
    data.byMunicipality.forEach((item) =>
      sheet.addRow([item.name, item.count]),
    );
    sheet.addRow([]);
    sheet.addRow(["Возрастная группа", "Количество"]);
    data.byAgeGroup.forEach((item) => sheet.addRow([item.name, item.count]));
    sheet.addRow([]);
    sheet.addRow(["Год начала занятий (накопительно)", "Количество"]);
    data.dynamics.forEach((item) => sheet.addRow([item.year, item.count]));
    sheet.getColumn(1).width = 64;
    sheet.getColumn(2).width = 22;
    sheet.getRow(1).font = { bold: true };
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, filename: "otchet-chislennost.xlsx", mime: xlsxMime };
  }

  async issueCertificate(
    user: AuthUser,
    athleteId: string,
    competitionId: string,
  ) {
    await this.assertAthleteAccess(user, athleteId);
    const result = await this.prisma.competitionResult.findUnique({
      where: { competitionId_athleteId: { competitionId, athleteId } },
    });
    if (!result || result.status !== "PUBLISHED") {
      throw new NotFoundException("Опубликованный результат не найден");
    }
    const token = randomBytes(24).toString("hex");
    const number = `СП-${new Date().getFullYear()}-${token.slice(0, 8).toUpperCase()}`;
    const certificate = await this.prisma.participationCertificate.create({
      data: {
        verificationToken: token,
        number,
        athleteId,
        competitionId,
        resultId: result.id,
        issuedById: user.id,
      },
      include: {
        athlete: true,
        competition: { include: { discipline: true } },
        result: true,
      },
    });
    const file = await this.buildCertificatePdf(certificate);
    return { certificate, ...file };
  }

  async listCertificates(user: AuthUser) {
    if (user.activeRole === "FEDERATION" || user.activeRole === "MINISTRY") {
      return this.prisma.participationCertificate.findMany({
        include: {
          athlete: true,
          competition: { include: { discipline: true } },
          result: true,
        },
        orderBy: { issuedAt: "desc" },
        take: 100,
      });
    }
    if (user.activeRole === "ATHLETE" && user.athleteId) {
      return this.prisma.participationCertificate.findMany({
        where: { athleteId: user.athleteId },
        include: {
          athlete: true,
          competition: { include: { discipline: true } },
          result: true,
        },
        orderBy: { issuedAt: "desc" },
      });
    }
    if (user.activeRole === "COACH" && user.coachId) {
      return this.prisma.participationCertificate.findMany({
        where: {
          athlete: {
            coaches: { some: { coachId: user.coachId, status: "ACTIVE" } },
          },
        },
        include: {
          athlete: true,
          competition: { include: { discipline: true } },
          result: true,
        },
        orderBy: { issuedAt: "desc" },
      });
    }
    return [];
  }

  async certificatePdf(user: AuthUser, certificateId: string) {
    const certificate = await this.prisma.participationCertificate.findUnique({
      where: { id: certificateId },
      include: {
        athlete: true,
        competition: { include: { discipline: true } },
        result: true,
      },
    });
    if (!certificate) {
      throw new NotFoundException("Справка не найдена");
    }
    await this.assertAthleteAccess(user, certificate.athleteId);
    return this.buildCertificatePdf(certificate);
  }

  async verify(token: string) {
    const certificate = await this.prisma.participationCertificate.findUnique({
      where: { verificationToken: token },
      include: {
        athlete: true,
        competition: { include: { discipline: true } },
        result: true,
      },
    });
    if (!certificate) {
      throw new NotFoundException("Справка не найдена");
    }
    return {
      valid: certificate.result?.status === "PUBLISHED",
      number: certificate.number,
      athlete: `${certificate.athlete.lastName} ${certificate.athlete.firstName.charAt(0)}.`,
      competition: certificate.competition.name,
      discipline: certificate.competition.discipline.name,
      place: certificate.result?.place ?? null,
      issuedAt: certificate.issuedAt,
    };
  }

  private async buildCertificatePdf(certificate: CertificateWithRelations) {
    const verifyUrl = `${process.env.PUBLIC_WEB_URL ?? "http://localhost:3000"}/verify/${certificate.verificationToken}`;
    const qr = await QRCode.toDataURL(verifyUrl);
    return this.pdf((doc) => {
      doc.fontSize(16).text("Справка об участии", { align: "center" });
      doc.moveDown();
      doc.fontSize(11).text(`№ ${certificate.number}`);
      doc.text(
        `Спортсмен: ${certificate.athlete.lastName} ${certificate.athlete.firstName}`,
      );
      doc.text(`Соревнование: ${certificate.competition.name}`);
      doc.text(`Дисциплина: ${certificate.competition.discipline.name}`);
      if (certificate.result) {
        doc.text(
          `Результат: место ${certificate.result.place}, баллы ${certificate.result.score.toString()}`,
        );
      }
      doc.text(
        `Дата формирования: ${certificate.issuedAt.toLocaleDateString("ru-RU")}`,
      );
      doc.text(`Проверка: ${verifyUrl}`);
      const qrBuffer = Buffer.from(qr.split(",")[1], "base64");
      doc.image(qrBuffer, { width: 120 });
    }, `spravka-${certificate.number}.pdf`);
  }

  private async assertAthleteAccess(user: AuthUser, athleteId: string) {
    if (user.activeRole === "FEDERATION" || user.activeRole === "MINISTRY") {
      return;
    }
    if (user.activeRole === "ATHLETE" && user.athleteId === athleteId) {
      return;
    }
    if (user.activeRole === "COACH" && user.coachId) {
      const link = await this.prisma.coachAthlete.findFirst({
        where: { coachId: user.coachId, athleteId, status: "ACTIVE" },
      });
      if (link) {
        return;
      }
    }
    throw new ForbiddenException("Нет доступа к документам спортсмена");
  }

  private fontPath(filename: string) {
    const candidates = [
      path.resolve(__dirname, "..", "..", "assets", "fonts", filename),
      path.resolve(process.cwd(), "assets", "fonts", filename),
      path.resolve(process.cwd(), "apps", "api", "assets", "fonts", filename),
    ];
    return candidates.find((candidate) => existsSync(candidate));
  }

  pdf(draw: (doc: PDFKit.PDFDocument) => void, filename: string) {
    return new Promise<{ buffer: Buffer; filename: string; mime: string }>(
      (resolve, reject) => {
        const doc = new PDFDocument({ margin: 48 });
        // Встроенные шрифты PDFKit не поддерживают кириллицу, поэтому
        // подключаем свободный шрифт DejaVu Sans из ресурсов приложения.
        const regular = this.fontPath("DejaVuSans.ttf");
        if (regular) {
          doc.registerFont("Body", regular);
          doc.font("Body");
        }
        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk as Buffer));
        doc.on("end", () =>
          resolve({
            buffer: Buffer.concat(chunks),
            filename,
            mime: "application/pdf",
          }),
        );
        doc.on("error", reject);
        draw(doc);
        doc.end();
      },
    );
  }

  private minimalDocx() {
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Проект приказа о составе сборной</w:t></w:r></w:p>
    <w:p><w:r><w:t>{title}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Дисциплина: {discipline}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Возрастная группа: {ageGroup}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Сезон: {season}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Дата: {date}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{members}</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    const zip = new PizZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );
    zip.file("word/document.xml", documentXml);
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
    );
    return zip.generate({ type: "nodebuffer" });
  }
}

const xlsxMime =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
