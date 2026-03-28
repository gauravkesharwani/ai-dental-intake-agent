'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/shadcn/utils';

export interface KnowledgeEntry {
  patient_name: string;
  patient_intent: string;
  insurance_detected: string;
  slot_booked: string;
  new_facts_learned: string[];
  timestamp: string;
}

interface KnowledgePanelProps {
  entries: KnowledgeEntry[];
  className?: string;
}

export function KnowledgePanel({ entries, className }: KnowledgePanelProps) {
  // Entries pushed via displayPreviousVisits come first (previous visits).
  // Entries pushed via updateKnowledgeBase come later (current session).
  // We detect "previous" vs "current" by checking if the timestamp is older
  // than the earliest entry that arrived during this component's lifetime.
  // Simple heuristic: if there are multiple entries, the ones pushed first
  // via displayPreviousVisits are "previous".

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle className="text-sm">Knowledge base</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Call summaries will appear here after each session. The agent uses this context to
            improve future calls.
          </p>
        ) : (
          entries.map((entry, i) => {
            // Heuristic: entries with timestamps more than 60s in the past are previous visits
            const isPrevious = Date.now() - new Date(entry.timestamp).getTime() > 60_000;

            return (
              <div
                key={i}
                className={cn(
                  'space-y-1 rounded-md border p-3 text-sm',
                  isPrevious
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                    : 'border-border'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.patient_name}</span>
                    {isPrevious && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Previous visit
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground">{entry.patient_intent}</p>
                {entry.insurance_detected && (
                  <p className="text-xs">
                    Insurance: <span className="font-medium">{entry.insurance_detected}</span>
                  </p>
                )}
                {entry.slot_booked && (
                  <p className="text-xs">
                    Appointment: <span className="font-medium">{entry.slot_booked}</span>
                  </p>
                )}
                {entry.new_facts_learned.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs font-medium">New facts learned:</p>
                    <ul className="text-muted-foreground list-inside list-disc text-xs">
                      {entry.new_facts_learned.map((fact, j) => (
                        <li key={j}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
