import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { AthletesModule } from "./athletes/athletes.module";
import { CatalogsModule } from "./catalogs/catalogs.module";
import { CoachesModule } from "./coaches/coaches.module";
import { CommonModule } from "./common/common.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { CompetitionsModule } from "./competitions/competitions.module";
import { DocumentsModule } from "./documents/documents.module";
import { JudgesModule } from "./judges/judges.module";
import { NationalTeamModule } from "./national-team/national-team.module";
import { RanksModule } from "./ranks/ranks.module";
import { RatingsModule } from "./ratings/ratings.module";
import { ReportsModule } from "./reports/reports.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    CatalogsModule,
    AthletesModule,
    CoachesModule,
    JudgesModule,
    CompetitionsModule,
    RanksModule,
    RatingsModule,
    NationalTeamModule,
    ReportsModule,
    DocumentsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
