import { Module } from "@nestjs/common";
import { NationalTeamController } from "./national-team.controller";
import { NationalTeamService } from "./national-team.service";

@Module({
  controllers: [NationalTeamController],
  providers: [NationalTeamService],
  exports: [NationalTeamService],
})
export class NationalTeamModule {}
