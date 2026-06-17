import { Inject, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

import { IUserRepository, USER_REPOSITORY } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository
  ) {}

  create(email: string, passwordHash: string): Promise<User> {
    return this.userRepo.create(email, passwordHash);
  }

  findByEmail(email: string): Promise<null | User> {
    return this.userRepo.findByEmail(email);
  }

  findById(id: number): Promise<null | User> {
    return this.userRepo.findById(id);
  }
}
