import { Resolver, Mutation, Args, ID } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { RecurringService } from "./recurring.service";
import { CreateRecurringInput } from "./dto/create-recurring.input";
import { RecurringCreateResult } from "./models/recurring-group.model";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";

@Resolver()
export class RecurringResolver {
  constructor(private readonly recurringService: RecurringService) {}

  @Mutation(() => RecurringCreateResult, {
    description: "Book a recurring weekly session",
  })
  @UseGuards(JwtAuthGuard)
  createRecurringSessions(
    @Args("input") input: CreateRecurringInput,
    @CurrentUser() user: User,
  ): Promise<RecurringCreateResult> {
    return this.recurringService.createRecurring(input, user.id);
  }

  @Mutation(() => Boolean, {
    description: "Cancel a recurring group (deletes all its sessions)",
  })
  @UseGuards(JwtAuthGuard)
  cancelRecurringGroup(
    @Args("groupId", { type: () => ID }) groupId: string,
    @Args("futureOnly", { type: () => Boolean, defaultValue: false })
    futureOnly: boolean,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.recurringService.cancelGroup(
      Number(groupId),
      user.id,
      futureOnly,
    );
  }
}
