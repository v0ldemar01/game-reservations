import { registerEnumType } from '@nestjs/graphql';
import { SessionStatus } from '@prisma/client';

registerEnumType(SessionStatus, { name: 'SessionStatus' });

export { SessionStatus } from '@prisma/client';
