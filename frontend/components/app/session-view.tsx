'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAgent, useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { type CaptureType, CardCapture } from '@/components/app/card-capture';
import { IntakeForm } from '@/components/app/intake-form';
import { type KnowledgeEntry, KnowledgePanel } from '@/components/app/knowledge-panel';
import { SchedulePanel, type ScheduleSlot } from '@/components/app/schedule-panel';
import { Button } from '@/components/ui/button';
import { useRpcHandlers } from '@/hooks/useRpcHandlers';
import { EMPTY_FORM_DATA, type IntakeFormData } from '@/lib/form-fields';

interface SessionViewProps {
  appConfig: AppConfig;
}

const POST_SUBMIT_FALLBACK_MS = 90_000;
const POST_SPEAK_DELAY_MS = 15_000;

export const SessionView = ({
  appConfig,
  ...props
}: React.ComponentProps<'section'> & SessionViewProps) => {
  void appConfig;
  const { end, room, isConnected } = useSessionContext();
  const agent = useAgent();
  const [formData, setFormData] = useState<IntakeFormData>(EMPTY_FORM_DATA);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [captureMode, setCaptureMode] = useState<CaptureType | null>('id');
  const captureResolverRef = useRef<((base64: string) => void) | null>(null);
  const capturedImageBufferRef = useRef<Record<string, string>>({});
  const hasSpokenRef = useRef(false);

  // Send a chat message to nudge the agent that card data was extracted
  const notifyAgent = useCallback(
    (message: string) => {
      if (!room?.localParticipant) return;
      const encoder = new TextEncoder();
      room.localParticipant.publishData(encoder.encode(JSON.stringify({ message })), {
        reliable: true,
      });
    },
    [room]
  );

  // Called when ID data is extracted from the card image
  const handleIdExtracted = useCallback(
    (data: Record<string, string>) => {
      setFormData((prev) => ({
        ...prev,
        fullName: data.fullName || prev.fullName,
        dob: data.dob || prev.dob,
        address: data.address || prev.address,
      }));
      notifyAgent('Patient scanned their photo ID. The ID fields have been filled in automatically. Please call get_form_state and continue to the next step.');
    },
    [notifyAgent]
  );

  // Called when insurance data is extracted from the card image
  const handleInsuranceExtracted = useCallback(
    (data: Record<string, string>) => {
      setFormData((prev) => ({
        ...prev,
        insuranceProvider: data.insuranceProvider || prev.insuranceProvider,
        memberId: data.memberId || prev.memberId,
        groupNumber: data.groupNumber || prev.groupNumber,
        policyHolder: data.policyHolder || prev.policyHolder,
      }));
      notifyAgent('Patient scanned their insurance card. The insurance fields have been filled in automatically. Please call get_form_state and continue to the next step.');
    },
    [notifyAgent]
  );

  // Track whether the agent has started
  const [agentReady, setAgentReady] = useState(false);
  useEffect(() => {
    if (!agentReady && (agent.state === 'speaking' || agent.state === 'listening')) {
      setAgentReady(true);
    }
  }, [agent.state, agentReady]);

  // Fallback: disconnect after 90s if something goes wrong
  useEffect(() => {
    if (!isSubmitted || isSessionEnded) return;

    const fallbackTimer = setTimeout(() => {
      setIsSessionEnded(true);
      end();
    }, POST_SUBMIT_FALLBACK_MS);

    return () => clearTimeout(fallbackTimer);
  }, [isSubmitted, isSessionEnded, end]);

  // After agent finishes speaking post-submit, wait a bit for KB RPC, then disconnect
  useEffect(() => {
    if (!isSubmitted || isSessionEnded) return;

    if (agent.isFinished) {
      const timer = setTimeout(() => {
        setIsSessionEnded(true);
        end();
      }, POST_SPEAK_DELAY_MS);
      return () => clearTimeout(timer);
    }

    if (agent.state === 'speaking') {
      hasSpokenRef.current = true;
    }

    if (hasSpokenRef.current && agent.state !== 'speaking') {
      const timer = setTimeout(() => {
        setIsSessionEnded(true);
        end();
      }, POST_SPEAK_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted, isSessionEnded, agent.state, agent.isFinished, end]);

  useRpcHandlers({
    room,
    isConnected,
    formData,
    setFormData,
    setIsSubmitted,
    setScheduleSlots,
    setKnowledgeEntries,
    setCaptureMode,
    captureResolverRef,
    capturedImageBufferRef,
  });

  // Derive booked slot ID from form data
  const bookedSlotId = scheduleSlots.find(
    (s) => formData.appointmentSlot && formData.appointmentSlot.includes(s.start)
  )?.id;

  // Show connecting spinner until agent is ready
  if (!agentReady) {
    return (
      <section
        className="bg-background flex h-full w-full flex-col items-center justify-center gap-4"
        style={{ zIndex: 'var(--app-z-session)' }}
        {...props}
      >
        <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="text-muted-foreground text-sm font-medium">
          Connecting to your intake assistant...
        </p>
      </section>
    );
  }

  return (
    <section
      className="bg-background relative flex h-full w-full flex-col overflow-hidden"
      style={{ zIndex: 'var(--app-z-session)' }}
      {...props}
    >
      {/* Session ended banner */}
      {isSessionEnded && (
        <div className="bg-primary/10 flex items-center justify-between px-6 py-3">
          <p className="text-sm font-medium">
            Session complete. Review the knowledge base summary below.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Start new session
          </Button>
        </div>
      )}

      {/* 3-panel layout */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left panel: Intake form */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto md:w-[35%] md:flex-none md:border-r">
          <IntakeForm
            formData={formData}
            onFormDataChange={setFormData}
            isSubmitted={isSubmitted}
            onSubmit={() => setIsSubmitted(true)}
            className="flex-1"
          />
        </div>

        {/* Center panel: Card capture + Schedule */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:w-[35%] md:flex-none md:border-r">
          <CardCapture
            captureType="id"
            onImageCaptured={(base64) => {
              capturedImageBufferRef.current['id'] = base64;
              if (captureResolverRef.current && captureMode === 'id') {
                captureResolverRef.current(base64);
                captureResolverRef.current = null;
              }
            }}
            onDataExtracted={handleIdExtracted}
          />
          <CardCapture
            captureType="insurance"
            onImageCaptured={(base64) => {
              capturedImageBufferRef.current['insurance'] = base64;
              if (captureResolverRef.current && captureMode === 'insurance') {
                captureResolverRef.current(base64);
                captureResolverRef.current = null;
              }
            }}
            onDataExtracted={handleInsuranceExtracted}
          />
          <SchedulePanel slots={scheduleSlots} bookedSlotId={bookedSlotId} />
        </div>

        {/* Right panel: Knowledge base */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 md:w-[30%] md:flex-none">
          <KnowledgePanel entries={knowledgeEntries} className="flex-1" />
        </div>
      </div>
    </section>
  );
};
