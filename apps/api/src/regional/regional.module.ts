import { Module } from '@nestjs/common';
import { AthletesModule } from '../athletes/athletes.module';
import { CompetitionsModule } from '../competitions/competitions.module';
import { DocumentsModule } from '../documents/documents.module';
import { RatingsModule } from '../ratings/ratings.module';
import { RegionalController } from './regional.controller';
import { RegionalService } from './regional.service';
import { OidcController, OidcService } from './oidc.controller';
import { IntegrationsController, WebhookWorker } from './integrations.controller';
import { AwardsController, JudgingDocumentsController } from './awards.controller';
@Module({imports:[AthletesModule,CompetitionsModule,DocumentsModule,RatingsModule],controllers:[RegionalController,OidcController,IntegrationsController,AwardsController,JudgingDocumentsController],providers:[RegionalService,OidcService,WebhookWorker]})
export class RegionalModule {}
