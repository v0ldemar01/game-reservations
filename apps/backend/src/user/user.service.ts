import { Injectable, Inject } from "@nestjs/common";
import { User } from "@prisma/client";
import { IUserRepository, USER_REPOSITORY } from "./user.repository";

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findByEmail(email);
  }

  create(email: string, passwordHash: string): Promise<User> {
    return this.userRepo.create(email, passwordHash);
  }
}
