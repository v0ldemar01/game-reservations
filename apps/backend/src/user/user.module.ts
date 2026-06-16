import { Module } from "@nestjs/common";
import { UserRepository, USER_REPOSITORY } from "./user.repository";
import { UserService } from "./user.service";

@Module({
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
    UserService,
  ],
  exports: [UserService],
})
export class UserModule {}
