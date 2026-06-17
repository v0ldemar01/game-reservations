import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DayUtilization {
  @Field(() => Int)
  bookedMinutes!: number;

  @Field()
  date!: string; // YYYY-MM-DD

  @Field(() => Float)
  utilizationPercent!: number;
}
@ObjectType()
export class HourlyCount {
  @Field(() => Int)
  count!: number;

  @Field(() => Int)
  hour!: number;
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
  sessionCount!: number;

  @Field(() => Int)
  totalBookedMinutes!: number;
}
