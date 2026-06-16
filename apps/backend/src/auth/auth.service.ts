import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UserService } from "src/user/user.service";
import { User } from "@prisma/client";
import { JwtPayload } from "./strategies/jwt.strategy";

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
  ): Promise<{ token: string; user: User }> {
    const existing = await this.userService.findByEmail(email);
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.userService.create(email, passwordHash);
    const token = this.signToken(user);
    return { token, user };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: User }> {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return { token: this.signToken(user), user };
  }

  private signToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }
}
