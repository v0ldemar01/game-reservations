import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import { type ValueOf } from 'src/common/types/types';
import { type Role } from 'src/user/models/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ValueOf<typeof Role>[]): CustomDecorator =>
  SetMetadata(ROLES_KEY, roles);
