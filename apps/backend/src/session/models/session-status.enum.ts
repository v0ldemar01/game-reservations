import { registerEnumType } from "@nestjs/graphql";
import { SessionStatus } from "@prisma/client";

export { SessionStatus };

registerEnumType(SessionStatus, { name: "SessionStatus" });
