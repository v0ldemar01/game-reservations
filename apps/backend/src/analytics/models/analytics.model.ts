import { ObjectType, Field, Int, Float, ID } from "@nestjs/graphql";

@ObjectType()
export class DayUtilization {
  @Field()
  date!: string; // YYYY-MM-DD

  @Field(() => Int)
  bookedMinutes!: number;

  @Field(() => Float)
  utilizationPercent!: number;
}

@ObjectType()
export class HourlyCount {
  @Field(() => Int)
  hour!: number;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class AnalyticsResult {
  @Field(() => [DayUtilization])
  dailyUtilization!: DayUtilization[];

  @Field(() => [HourlyCount])
  peakHours!: HourlyCount[];
}

@ObjectType()
export class ArenaUtilizationSummary {
  @Field(() => ID)
  arenaId!: number;

  @Field()
  arenaName!: string;

  @Field(() => Int)
  totalBookedMinutes!: number;

  @Field(() => Int)
  sessionCount!: number;
}
