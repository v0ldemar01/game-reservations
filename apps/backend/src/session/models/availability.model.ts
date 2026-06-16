import { ObjectType, Field } from "@nestjs/graphql";

@ObjectType()
export class SlotSuggestion {
  @Field()
  startTime!: Date;

  @Field()
  endTime!: Date;
}

@ObjectType()
export class AvailabilityResult {
  @Field()
  available!: boolean;

  @Field(() => [SlotSuggestion], { nullable: true })
  suggestedSlots?: SlotSuggestion[];
}
