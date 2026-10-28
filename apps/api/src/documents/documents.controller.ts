import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@prisma/client";
import { IsUUID } from "class-validator";
import { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthUser } from "../auth/auth.types";
import { ok } from "../common/http";
import { DocumentsService } from "./documents.service";

class CertificateDto {
  @IsUUID()
  athleteId!: string;
  @IsUUID()
  competitionId!: string;
}

function sendFile(
  res: Response,
  file: { buffer: Buffer; filename: string; mime: string },
) {
  res.setHeader("Content-Type", file.mime);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  );
  res.send(file.buffer);
}

@ApiTags("documents")
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get("documents/verify/:token")
  async verify(@Param("token") token: string) {
    return ok(await this.documents.verify(token));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get("documents/protocol/:competitionId.pdf")
  async protocolPdf(
    @CurrentUser() user: AuthUser,
    @Param("competitionId") competitionId: string,
    @Res() res: Response,
  ) {
    await this.documents.assertProtocolAccess(user, competitionId);
    sendFile(res, await this.documents.protocolPdf(competitionId));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get("documents/protocol/:competitionId.xlsx")
  async protocolXlsx(
    @CurrentUser() user: AuthUser,
    @Param("competitionId") competitionId: string,
    @Res() res: Response,
  ) {
    await this.documents.assertProtocolAccess(user, competitionId);
    sendFile(res, await this.documents.protocolXlsx(competitionId));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get("documents/national-team/:teamId.pdf")
  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  async teamPdf(@Param("teamId") teamId: string, @Res() res: Response) {
    sendFile(res, await this.documents.teamPdf(teamId));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get("documents/national-team/:teamId.docx")
  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  async teamDocx(@Param("teamId") teamId: string, @Res() res: Response) {
    sendFile(res, await this.documents.teamOrderDocx(teamId));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get("documents/athletes/:athleteId/history.pdf")
  async history(
    @CurrentUser() user: AuthUser,
    @Param("athleteId") athleteId: string,
    @Res() res: Response,
  ) {
    sendFile(res, await this.documents.athleteHistoryPdf(user, athleteId));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get("documents/certificates")
  async certificates(@CurrentUser() user: AuthUser) {
    return ok(await this.documents.listCertificates(user));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Get("documents/certificates/:id.pdf")
  async certificatePdf(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    sendFile(res, await this.documents.certificatePdf(user, id));
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.FEDERATION, RoleCode.MINISTRY)
  @Get("documents/headcount.xlsx")
  async headcount(@Res() res: Response) {
    sendFile(res, await this.documents.headcountXlsx());
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Post("documents/certificates")
  async certificate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CertificateDto,
    @Res() res: Response,
  ) {
    const file = await this.documents.issueCertificate(
      user,
      dto.athleteId,
      dto.competitionId,
    );
    sendFile(res, file);
  }
}
