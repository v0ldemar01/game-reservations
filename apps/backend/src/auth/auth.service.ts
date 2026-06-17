import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { UserService } from 'src/user/user.service';

import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 12;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: User }> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await compare(password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { token: this.signToken(user), user };
  }

  async register(
    email: string,
    password: string
  ): Promise<{ token: string; user: User }> {
    const existing = await this.userService.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(password, AuthService.SALT_ROUNDS);
    const user = await this.userService.create(email, passwordHash);
    const token = this.signToken(user);

    return { token, user };
  }

  private signToken(user: User): string {
    const payload: JwtPayload = { email: user.email, sub: user.id };

    return this.jwtService.sign(payload);
  }
}
