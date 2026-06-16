import { Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(email: string, passwordHash: string): Promise<User>;
}

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  create(email: string, passwordHash: string): Promise<User> {
    return this.db.user.create({ data: { email, passwordHash } });
  }
}
