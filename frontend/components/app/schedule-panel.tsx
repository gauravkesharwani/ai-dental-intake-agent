'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/shadcn/utils';

export interface ScheduleSlot {
  id: string;
  doctor: string;
  start: string;
  duration_min: number;
}

interface SchedulePanelProps {
  slots: ScheduleSlot[];
  bookedSlotId?: string;
  className?: string;
}

export function SchedulePanel({ slots, bookedSlotId, className }: SchedulePanelProps) {
  if (slots.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="text-sm">Available appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            The agent will check the schedule during your call.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm">Available appointments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {slots.map((slot) => {
          const isBooked = slot.id === bookedSlotId;
          return (
            <div
              key={slot.id}
              className={cn(
                'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                isBooked ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-border'
              )}
            >
              <div>
                <span className="font-medium">{slot.doctor}</span>
                <span className="text-muted-foreground ml-2">{slot.start}</span>
              </div>
              <span className="text-xs">
                {isBooked ? (
                  <span className="font-medium text-green-600 dark:text-green-400">Booked</span>
                ) : (
                  <span className="text-muted-foreground">{slot.duration_min} min</span>
                )}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
