import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export interface IUserRepository {
  create(email: string, passwordHash: string): Promise<User>;
  findByEmail(email: string): Promise<null | User>;
  findById(id: number): Promise<null | User>;
}
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly db: DatabaseService) {}

  create(email: string, passwordHash: string): Promise<User> {
    return this.db.user.create({ data: { email, passwordHash } });
  }

  findByEmail(email: string): Promise<null | User> {
    return this.db.user.findUnique({ where: { email } });
  }

  findById(id: number): Promise<null | User> {
    return this.db.user.findUnique({ where: { id } });
  }
}
