import { Module } from '@nestjs/common';

import { USER_REPOSITORY, UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  exports: [UserService],
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
    UserService
  ]
})
export class UserModule {}
