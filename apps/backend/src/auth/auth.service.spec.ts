import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { type ValueOf } from 'src/common/types/types';
import { Role } from 'src/user/models/role.enum';
import { UserService } from 'src/user/user.service';

import { AuthService } from './auth.service';

function makeUser(
  overrides: Partial<{
    createdAt: Date;
    email: string;
    id: number;
    passwordHash: string;
    role: ValueOf<typeof Role>;
    updatedAt: Date;
  }> = {}
) {
  return {
    createdAt: new Date(),
    email: 'user@example.com',
    id: 1,
    passwordHash: 'hashed',
    role: Role.PLAYER,
    updatedAt: new Date(),
    ...overrides
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<Pick<UserService, 'create' | 'findByEmail'>>;
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    userService = {
      create: jest.fn(),
      findByEmail: jest.fn()
    };

    jwtService = { sign: jest.fn().mockReturnValue('signed-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService }
      ]
    }).compile();

    service = module.get(AuthService);
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('throws ConflictException when email is already taken', async () => {
      userService.findByEmail.mockResolvedValue(makeUser());
      await expect(
        service.register('user@example.com', 'pass')
      ).rejects.toThrow(ConflictException);
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('hashes password before storing', async () => {
      userService.findByEmail.mockResolvedValue(null);
      const user = makeUser({ email: 'new@example.com' });
      userService.create.mockResolvedValue(user);

      await service.register('new@example.com', 'plaintext');

      const [[, storedHash]] = userService.create.mock.calls;
      const matches = await bcrypt.compare('plaintext', storedHash);
      expect(matches).toBe(true);
    });

    it('returns token and user on success', async () => {
      userService.findByEmail.mockResolvedValue(null);
      const user = makeUser({ email: 'new@example.com' });
      userService.create.mockResolvedValue(user);

      const result = await service.register('new@example.com', 'pass');

      expect(result.token).toBe('signed-token');
      expect(result.user).toEqual(user);
    });

    it('signs JWT with correct sub and email', async () => {
      userService.findByEmail.mockResolvedValue(null);
      const user = makeUser({ email: 'new@example.com', id: 42 });
      userService.create.mockResolvedValue(user);

      await service.register('new@example.com', 'pass');

      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'new@example.com',
        sub: 42
      });
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  describe('login', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      userService.findByEmail.mockResolvedValue(null);
      await expect(service.login('ghost@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const hash = await bcrypt.hash('correct-pass', 10);
      userService.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hash })
      );

      await expect(
        service.login('user@example.com', 'wrong-pass')
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('returns token and user when credentials are correct', async () => {
      const hash = await bcrypt.hash('correct-pass', 10);
      const user = makeUser({ passwordHash: hash });
      userService.findByEmail.mockResolvedValue(user);

      const result = await service.login('user@example.com', 'correct-pass');

      expect(result.token).toBe('signed-token');
      expect(result.user).toEqual(user);
    });

    it('error message does not differentiate user-not-found vs wrong-password', async () => {
      userService.findByEmail.mockResolvedValue(null);
      const error1 = await service
        .login('x@x.com', 'p')
        .catch((error) => error);

      const hash = await bcrypt.hash('correct', 10);
      userService.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: hash })
      );
      const error2 = await service
        .login('x@x.com', 'wrong')
        .catch((error) => error);

      expect(error1.message).toBe(error2.message);
    });
  });
});
