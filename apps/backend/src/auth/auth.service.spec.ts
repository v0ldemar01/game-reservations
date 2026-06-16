import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { UserService } from "src/user/user.service";
import { Role } from "@prisma/client";

function makeUser(
  overrides: Partial<{
    id: number;
    email: string;
    passwordHash: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 1,
    email: "user@example.com",
    passwordHash: "hashed",
    role: Role.PLAYER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("AuthService", () => {
  let service: AuthService;
  let userService: jest.Mocked<Pick<UserService, "findByEmail" | "create">>;
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    jwtService = { sign: jest.fn().mockReturnValue("signed-token") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  describe("register", () => {
    it("throws ConflictException when email is already taken", async () => {
      userService.findByEmail.mockResolvedValue(makeUser());
      await expect(
        service.register("user@example.com", "pass"),
      ).rejects.toThrow(ConflictException);
      expect(userService.create).not.toHaveBeenCalled();
    });

    it("hashes password before storing", async () => {
      userService.findByEmail.mockResolvedValue(null);
      const user = makeUser({ email: "new@example.com" });
      userService.create.mockResolvedValue(user);

      await service.register("new@example.com", "plaintext");

      const [, storedHash] = userService.create.mock.calls[0];
      const matches = await bcrypt.compare("plaintext", storedHash);
      expect(matches).toBe(true);
    });

    it("returns token and user on success", async () => {
      userService.findByEmail.mockResolvedValue(null);
      const user = makeUser({ email: "new@example.com" });
      userService.create.mockResolvedValue(user);

      const result = await service.register("new@example.com", "pass");

      expect(result.token).toBe("signed-token");
      expect(result.user).toEqual(user);
    });

    it("signs JWT with correct sub and email", async () => {
      userService.findByEmail.mockResolvedValue(null);
      const user = makeUser({ id: 42, email: "new@example.com" });
      userService.create.mockResolvedValue(user);

      await service.register("new@example.com", "pass");

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 42,
        email: "new@example.com",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  describe("login", () => {
    it("throws UnauthorizedException when user does not exist", async () => {
      userService.findByEmail.mockResolvedValue(null);
      await expect(service.login("ghost@example.com", "pass")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when password is wrong", async () => {
      const hash = await bcrypt.hash("correct-pass", 10);
      userService.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hash }),
      );

      await expect(
        service.login("user@example.com", "wrong-pass"),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it("returns token and user when credentials are correct", async () => {
      const hash = await bcrypt.hash("correct-pass", 10);
      const user = makeUser({ passwordHash: hash });
      userService.findByEmail.mockResolvedValue(user);

      const result = await service.login("user@example.com", "correct-pass");

      expect(result.token).toBe("signed-token");
      expect(result.user).toEqual(user);
    });

    it("error message does not differentiate user-not-found vs wrong-password", async () => {
      userService.findByEmail.mockResolvedValue(null);
      const err1 = await service.login("x@x.com", "p").catch((e) => e);

      const hash = await bcrypt.hash("correct", 10);
      userService.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hash }),
      );
      const err2 = await service.login("x@x.com", "wrong").catch((e) => e);

      expect(err1.message).toBe(err2.message);
    });
  });
});
