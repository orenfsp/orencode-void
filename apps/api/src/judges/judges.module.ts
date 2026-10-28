import { Module } from "@nestjs/common";
import { JudgesController } from "./judges.controller";
import { JudgesService } from "./judges.service";

@Module({
  controllers: [JudgesController],
  providers: [JudgesService],
})
export class JudgesModule {}
