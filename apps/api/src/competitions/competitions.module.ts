import { Module } from "@nestjs/common";
import { RatingsModule } from "../ratings/ratings.module";
import { CompetitionsController } from "./competitions.controller";
import { CompetitionsService } from "./competitions.service";

@Module({
  imports: [RatingsModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
