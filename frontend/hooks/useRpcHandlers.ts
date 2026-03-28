'use client';

import { useEffect, useRef } from 'react';
import { RpcError, type RpcInvocationData } from 'livekit-client';
import type { Room } from 'livekit-client';
import type { CaptureType } from '@/components/app/card-capture';
import type { KnowledgeEntry } from '@/components/app/knowledge-panel';
import type { ScheduleSlot } from '@/components/app/schedule-panel';
import type { IntakeFormData } from '@/lib/form-fields';
import { isValidFieldName } from '@/lib/form-fields';

interface UseRpcHandlersOptions {
  room: Room | undefined;
  isConnected: boolean;
  formData: IntakeFormData;
  setFormData: (data: IntakeFormData | ((prev: IntakeFormData) => IntakeFormData)) => void;
  setIsSubmitted: (submitted: boolean) => void;
  setScheduleSlots: (slots: ScheduleSlot[] | ((prev: ScheduleSlot[]) => ScheduleSlot[])) => void;
  setKnowledgeEntries: (
    entries: KnowledgeEntry[] | ((prev: KnowledgeEntry[]) => KnowledgeEntry[])
  ) => void;
  setCaptureMode: (mode: CaptureType | null) => void;
  captureResolverRef: React.RefObject<((base64: string) => void) | null>;
  capturedImageBufferRef: React.RefObject<Record<string, string>>;
}

export function useRpcHandlers({
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
}: UseRpcHandlersOptions) {
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  useEffect(() => {
    if (!room || !isConnected) {
      return;
    }

    room.registerRpcMethod('updateField', async (data: RpcInvocationData) => {
      try {
        const { fieldName, value } = JSON.parse(data.payload) as {
          fieldName: string;
          value: string;
        };
        if (!isValidFieldName(fieldName)) {
          throw new RpcError(1500, 'Invalid field name', JSON.stringify({ fieldName }));
        }
        setFormData((prev) => ({ ...prev, [fieldName]: value }));
        return JSON.stringify({ success: true, fieldName, value });
      } catch (error) {
        if (error instanceof RpcError) throw error;
        throw new RpcError(1500, 'Failed to update field');
      }
    });

    room.registerRpcMethod('getFormState', async () => {
      return JSON.stringify(formDataRef.current);
    });

    room.registerRpcMethod('submitForm', async () => {
      setIsSubmitted(true);
      return JSON.stringify({ success: true });
    });

    room.registerRpcMethod('displaySchedule', async (data: RpcInvocationData) => {
      try {
        const slots = JSON.parse(data.payload) as ScheduleSlot[];
        setScheduleSlots(slots);
        return JSON.stringify({ success: true });
      } catch (error) {
        throw new RpcError(1500, 'Failed to display schedule');
      }
    });

    // Agent requests a card image (ID or insurance). This activates the camera
    // component on the frontend and waits for the user to capture.
    room.registerRpcMethod('requestCardImage', async (data: RpcInvocationData) => {
      try {
        const { type } = JSON.parse(data.payload) as { type: CaptureType };
        setCaptureMode(type);

        // Check if the user already captured an image before the agent asked
        const buffered = capturedImageBufferRef.current[type];
        if (buffered) {
          delete capturedImageBufferRef.current[type];
          return JSON.stringify({ image: buffered });
        }

        const image = await new Promise<string>((resolve) => {
          captureResolverRef.current = resolve;
        });
        return JSON.stringify({ image });
      } catch (error) {
        throw new RpcError(1500, 'Failed to capture card image');
      }
    });

    // Agent pushes previous visit data for a returning patient
    room.registerRpcMethod('displayPreviousVisits', async (data: RpcInvocationData) => {
      try {
        const visits = JSON.parse(data.payload) as KnowledgeEntry[];
        setKnowledgeEntries((prev) => [...visits, ...prev]);
        return JSON.stringify({ success: true });
      } catch (error) {
        throw new RpcError(1500, 'Failed to display previous visits');
      }
    });

    room.registerRpcMethod('updateKnowledgeBase', async (data: RpcInvocationData) => {
      try {
        const entry = JSON.parse(data.payload) as KnowledgeEntry;
        setKnowledgeEntries((prev) => [...prev, entry]);
        return JSON.stringify({ success: true });
      } catch (error) {
        throw new RpcError(1500, 'Failed to update knowledge base');
      }
    });

    return () => {
      room.unregisterRpcMethod('updateField');
      room.unregisterRpcMethod('getFormState');
      room.unregisterRpcMethod('submitForm');
      room.unregisterRpcMethod('displaySchedule');
      room.unregisterRpcMethod('requestCardImage');
      room.unregisterRpcMethod('displayPreviousVisits');
      room.unregisterRpcMethod('updateKnowledgeBase');
    };
  }, [
    room,
    isConnected,
    setFormData,
    setIsSubmitted,
    setScheduleSlots,
    setKnowledgeEntries,
    setCaptureMode,
    captureResolverRef,
    capturedImageBufferRef,
  ]);
}
