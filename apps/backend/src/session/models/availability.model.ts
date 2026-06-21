import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SlotSuggestion {
  @Field()
  endTime!: Date;

  @Field()
  startTime!: Date;
}
@ObjectType()
export class AvailabilityResult {
  @Field()
  available!: boolean;

  @Field(() => [SlotSuggestion], { nullable: true })
  suggestedSlots?: SlotSuggestion[];
}
