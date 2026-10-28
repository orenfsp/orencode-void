import { Module } from "@nestjs/common";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";
import { PublicRatingsController } from "./public-ratings.controller";

@Module({
  controllers: [RatingsController, PublicRatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
