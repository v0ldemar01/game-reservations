import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DatabaseService } from 'src/database/database.service';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly prisma: DatabaseService) {}

  @Get('sessions')
  async exportSessions(
    @Query('arenaId') arenaId: string,
    @Query('dayStart') dayStart: string,
    @Query('dayEnd') dayEnd: string,
    @Query('format') format: string = 'csv',
    @Res() res: Response
  ): Promise<void> {
    if (!arenaId || !dayStart || !dayEnd) {
      throw new BadRequestException(
        'arenaId, dayStart and dayEnd are required'
      );
    }

    if (format !== 'csv' && format !== 'ics') {
      throw new BadRequestException('format must be csv or ics');
    }

    const sessions = await this.prisma.session.findMany({
      orderBy: { startTime: 'asc' },
      where: {
        arenaId: Number(arenaId),
        endTime: { gt: new Date(dayStart) },
        startTime: { lt: new Date(dayEnd) }
      }
    });

    if (format === 'csv') {
      const header = 'id,arenaId,startTime,endTime,playerName,comment\r\n';
      const rows = sessions
        .map((s) =>
          [
            s.id,
            s.arenaId,
            s.startTime.toISOString(),
            s.endTime.toISOString(),
            this.csvEscape(s.playerName ?? ''),
            this.csvEscape(s.comment ?? '')
          ].join(',')
        )
        .join('\r\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sessions-arena-${arenaId}.csv"`
      );
      res.send(header + rows);
    } else {
      const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Game Arena Reservations//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
      ];

      const escapedNewline = String.raw`\n`;

      for (const s of sessions) {
        const dtStart = this.toICS(s.startTime);
        const dtEnd = this.toICS(s.endTime);
        const summary = s.playerName
          ? `Arena ${s.arenaId} — ${s.playerName}`
          : `Arena ${s.arenaId}`;
        const description = s.comment
          ? `DESCRIPTION:${s.comment.replaceAll('\n', escapedNewline)}`
          : '';
        lines.push(
          'BEGIN:VEVENT',
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${summary}`,
          description,
          `UID:session-${s.id}@game-reservations`,
          `DTSTAMP:${this.toICS(new Date())}`,
          'END:VEVENT'
        );
      }

      lines.push('END:VCALENDAR');
      const body = lines.filter(Boolean).join('\r\n');
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sessions-arena-${arenaId}.ics"`
      );
      res.send(body);
    }
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replaceAll('"', '""')}"`;
    }

    return value;
  }

  private toICS(d: Date): string {
    return d.toISOString().replaceAll(/[-:]/g, '').split('.')[0] + 'Z';
  }
}
