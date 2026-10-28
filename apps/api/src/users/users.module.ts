import { Module } from "@nestjs/common";
import { MiscController } from "./misc.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController, MiscController],
  providers: [UsersService],
})
export class UsersModule {}
