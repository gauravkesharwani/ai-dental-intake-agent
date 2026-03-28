import json
import logging
import os
from typing import Annotated

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    RunContext,
    cli,
    function_tool,
    inference,
    llm,
    metrics,
    room_io,
)
from livekit.plugins import anam, elevenlabs, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from pydantic import Field

from schedule import schedule_store
from senso import senso_client
from vision import extract_id_info, extract_insurance_info

logger = logging.getLogger("agent")

load_dotenv(".env.local")

# Valid field names for the intake form
VALID_FIELD_NAMES = [
    "fullName",
    "dob",
    "address",
    "phone",
    "emergencyName",
    "emergencyRelationship",
    "emergencyPhone",
    "medications",
    "allergies",
    "reasonForVisit",
    "insuranceProvider",
    "memberId",
    "groupNumber",
    "policyHolder",
    "appointmentSlot",
]

# Longer timeout for card capture — user needs time to position card
CARD_CAPTURE_TIMEOUT = 60.0
DEFAULT_RPC_TIMEOUT = 5.0


def get_remote_participant_identity(ctx: JobContext) -> str:
    """Get the identity of the remote participant (user)."""
    for participant in ctx.room.remote_participants.values():
        return participant.identity
    raise llm.LLMToolException("No remote participant found")


async def perform_rpc_to_frontend(
    ctx: JobContext, method: str, payload: str, timeout: float = DEFAULT_RPC_TIMEOUT
) -> str:
    """Perform an RPC call to the frontend participant."""
    local_participant = ctx.room.local_participant
    if not local_participant:
        raise llm.LLMToolException("Agent not connected to room")

    destination_identity = get_remote_participant_identity(ctx)

    response = await local_participant.perform_rpc(
        destination_identity=destination_identity,
        method=method,
        payload=payload,
        response_timeout=timeout,
    )
    return response


class IntakeAssistant(Agent):
    def __init__(self, ctx: JobContext) -> None:
        self._ctx = ctx

        # Build context from previous calls in the knowledge base
        prior_context = senso_client.get_context()
        kb_section = ""
        if prior_context:
            summaries = json.dumps(prior_context, indent=2)
            kb_section = f"""
            KNOWLEDGE BASE (from previous calls):
            {summaries}

            Use this context to personalize the conversation. If you recognize a returning patient after reading their ID, greet them warmly, reference their prior visit, and let them know you have their info on file."""

        super().__init__(
            instructions=f"""You are an autonomous patient intake assistant for a dental practice.
            Your job is to quickly collect key info and get the patient checked in.

            PERSONALITY:
            - Warm, professional, efficient.
            - Speak in short, natural sentences.
            - Do not use markdown, emojis, asterisks, or stage directions.
            - Keep responses under 30 words when possible — this is a voice interface.

            CALL FLOW (follow these steps in order):
            1. Greet the patient warmly and ask them to hold their photo ID up to the camera.
            2. Call get_form_state to check if fullName, dob, and address are already filled. If they are, the patient already scanned their ID — acknowledge by name and move to step 3. If NOT filled, call read_id_card to capture and extract their name, DOB, and address.
            3. ALWAYS call check_returning_patient with the patient's full name (from form state or ID scan). If previous visit data is found, acknowledge it warmly (e.g. "Welcome back! I see you visited us before for...").
            4. Ask the reason for their visit. Use update_field to set reasonForVisit.
            5. Call get_form_state to check if insurance fields are already filled. If they are, acknowledge and move on. Otherwise ask if they have an insurance card. If yes, call read_insurance_card. If no card, skip.
            6. Call fill_mock_data to auto-populate remaining fields (emergency contact, medications, allergies).
            7. Call check_schedule to show available appointments. Offer 2-3 options (say doctor name, date, and time).
            8. When the patient picks a slot, call book_appointment.
            9. Briefly confirm all details. Call submit_form.
            10. ALWAYS call update_knowledge_base as the very last step.

            TOOL USAGE RULES:
            - read_id_card and read_insurance_card activate the camera on the patient's screen. Tell the patient to show their card BEFORE calling these tools.
            - Use update_field for reasonForVisit after the patient tells you verbally.
            - IMPORTANT: Always call get_form_state before calling read_id_card or read_insurance_card. If the relevant fields are already filled (from the patient scanning their card on the frontend), skip the capture and move on immediately.
            - The submit_form tool speaks the final confirmation; do not add your own.
            - IMPORTANT: When the patient says something like "done", "I scanned it", "got it", "captured", or any indication they have scanned their card, immediately call get_form_state to check and proceed.

            OPENING:
            Start with: "Hi, welcome to the practice! Let me get you checked in. Could you please hold your photo ID up to the camera and click capture when ready."
            {kb_section}""",
        )

    @function_tool
    async def update_field(
        self,
        context: RunContext,
        field_name: Annotated[
            str,
            Field(
                description="The field ID to update: fullName, dob, address, phone, emergencyName, emergencyRelationship, emergencyPhone, medications, allergies, reasonForVisit, insuranceProvider, memberId, groupNumber, policyHolder, appointmentSlot"
            ),
        ],
        value: Annotated[
            str,
            Field(
                description="The value to set. For medications/allergies, use a comma-separated string with all items."
            ),
        ],
    ):
        """Update a form field on the patient intake form."""
        if field_name not in VALID_FIELD_NAMES:
            raise llm.LLMToolException(f"Invalid field name: {field_name}")

        try:
            payload = json.dumps({"fieldName": field_name, "value": value})
            response = await perform_rpc_to_frontend(self._ctx, "updateField", payload)
            return response
        except Exception as e:
            raise llm.LLMToolException(f"Failed to update field: {e!s}") from e

    @function_tool
    async def get_form_state(self, context: RunContext):
        """Get the current state of all form fields to verify data before submitting."""
        try:
            response = await perform_rpc_to_frontend(self._ctx, "getFormState", "{}")
            return response
        except Exception as e:
            raise llm.LLMToolException(f"Failed to get form state: {e!s}") from e

    @function_tool
    async def submit_form(self, context: RunContext):
        """Submit the completed intake form. Only call after patient confirms all entries are accurate."""
        try:
            response = await perform_rpc_to_frontend(self._ctx, "submitForm", "{}")
            context.session.say(
                "Your form has been submitted and your appointment is booked. You will receive a confirmation shortly. Thank you!"
            )
            return response
        except Exception as e:
            raise llm.LLMToolException(f"Failed to submit form: {e!s}") from e

    @function_tool
    async def check_schedule(
        self,
        context: RunContext,
        doctor: Annotated[
            str,
            Field(description="Doctor name to filter by, or empty string for any doctor"),
        ] = "",
        date: Annotated[
            str,
            Field(description="Date to filter by in YYYY-MM-DD format, or empty string for any date"),
        ] = "",
    ):
        """Check available appointment slots at the practice. Returns a list of open time slots."""
        try:
            available = schedule_store.check_available(
                doctor=doctor if doctor else None,
                date=date if date else None,
            )
            result = json.dumps(available)
            await perform_rpc_to_frontend(self._ctx, "displaySchedule", result)
            return result
        except Exception as e:
            raise llm.LLMToolException(f"Failed to check schedule: {e!s}") from e

    @function_tool
    async def book_appointment(
        self,
        context: RunContext,
        slot_id: Annotated[str, Field(description="The ID of the time slot to book")],
        patient_name: Annotated[str, Field(description="Full name of the patient")],
        reason: Annotated[str, Field(description="Reason for the appointment")],
    ):
        """Book a specific appointment slot for the patient."""
        try:
            result = schedule_store.book(slot_id, patient_name)
            if result.get("success"):
                slot_display = f"{result['doctor']} on {result['start']}"
                await perform_rpc_to_frontend(
                    self._ctx,
                    "updateField",
                    json.dumps({"fieldName": "appointmentSlot", "value": slot_display}),
                )
            return json.dumps(result)
        except Exception as e:
            raise llm.LLMToolException(f"Failed to book appointment: {e!s}") from e

    @function_tool
    async def read_id_card(self, context: RunContext):
        """Activate the camera to capture the patient's photo ID (driver's license). Extracts full name, date of birth, and address."""
        try:
            # Request image from frontend (long timeout — user needs to position card)
            image_response = await perform_rpc_to_frontend(
                self._ctx,
                "requestCardImage",
                json.dumps({"type": "id"}),
                timeout=CARD_CAPTURE_TIMEOUT,
            )
            image_data = json.loads(image_response)

            if not image_data.get("image"):
                return json.dumps({"error": "No ID image captured. Ask the patient to try again."})

            # Extract info via Gemini Vision (or mock)
            info = await extract_id_info(image_data["image"])

            # Update form fields
            field_mapping = {
                "full_name": "fullName",
                "date_of_birth": "dob",
                "address": "address",
            }
            for key, field_name in field_mapping.items():
                if info.get(key):
                    await perform_rpc_to_frontend(
                        self._ctx,
                        "updateField",
                        json.dumps({"fieldName": field_name, "value": info[key]}),
                    )

            # Check for returning patient
            patient_name = info.get("full_name", "")
            if patient_name:
                previous_visits = senso_client.search_patient(patient_name)
                if previous_visits:
                    await perform_rpc_to_frontend(
                        self._ctx,
                        "displayPreviousVisits",
                        json.dumps(previous_visits),
                    )
                    info["returning_patient"] = True
                    info["previous_visits"] = previous_visits

            return json.dumps(info)
        except Exception as e:
            raise llm.LLMToolException(f"Failed to read ID card: {e!s}") from e

    @function_tool
    async def check_returning_patient(
        self,
        context: RunContext,
        patient_name: Annotated[
            str,
            Field(description="The patient's full name to look up in the knowledge base."),
        ],
    ):
        """Check if a patient has visited before by searching the knowledge base. Call this after obtaining the patient's name (from ID scan or form state). Returns previous visit data if found."""
        try:
            previous_visits = senso_client.search_patient(patient_name)
            if previous_visits:
                await perform_rpc_to_frontend(
                    self._ctx,
                    "displayPreviousVisits",
                    json.dumps(previous_visits),
                )
                return json.dumps({"returning_patient": True, "previous_visits": previous_visits})
            return json.dumps({"returning_patient": False})
        except Exception as e:
            raise llm.LLMToolException(f"Failed to check returning patient: {e!s}") from e

    @function_tool
    async def read_insurance_card(self, context: RunContext):
        """Activate the camera to capture the patient's insurance card. Extracts insurance provider, member ID, group number, and policy holder name."""
        try:
            image_response = await perform_rpc_to_frontend(
                self._ctx,
                "requestCardImage",
                json.dumps({"type": "insurance"}),
                timeout=CARD_CAPTURE_TIMEOUT,
            )
            image_data = json.loads(image_response)

            if not image_data.get("image"):
                return json.dumps({"error": "No insurance card image captured. Ask the patient to try again."})

            info = await extract_insurance_info(image_data["image"])

            field_mapping = {
                "insurance_provider": "insuranceProvider",
                "member_id": "memberId",
                "group_number": "groupNumber",
                "policy_holder": "policyHolder",
            }
            for key, field_name in field_mapping.items():
                if info.get(key):
                    await perform_rpc_to_frontend(
                        self._ctx,
                        "updateField",
                        json.dumps({"fieldName": field_name, "value": info[key]}),
                    )

            return json.dumps(info)
        except Exception as e:
            raise llm.LLMToolException(f"Failed to read insurance card: {e!s}") from e

    @function_tool
    async def fill_mock_data(self, context: RunContext):
        """Fill remaining empty form fields with mock/demo data. Call after collecting ID, reason, and insurance."""
        try:
            state_response = await perform_rpc_to_frontend(self._ctx, "getFormState", "{}")
            state = json.loads(state_response)

            mock_values = {
                "phone": "(415) 555-0142",
                "emergencyName": "Robert Smith",
                "emergencyRelationship": "Spouse",
                "emergencyPhone": "(415) 555-0198",
                "medications": "Ibuprofen 200mg as needed",
                "allergies": "None",
            }

            for field_name, value in mock_values.items():
                if not state.get(field_name):
                    await perform_rpc_to_frontend(
                        self._ctx,
                        "updateField",
                        json.dumps({"fieldName": field_name, "value": value}),
                    )

            return json.dumps({"success": True, "fields_filled": list(mock_values.keys())})
        except Exception as e:
            raise llm.LLMToolException(f"Failed to fill mock data: {e!s}") from e

    @function_tool
    async def update_knowledge_base(
        self,
        context: RunContext,
        patient_name: Annotated[str, Field(description="Full name of the patient")],
        patient_intent: Annotated[str, Field(description="Reason for visit / chief complaint")],
        insurance_detected: Annotated[
            str, Field(description="Insurance provider if detected, otherwise empty string")
        ] = "",
        slot_booked: Annotated[
            str, Field(description="Booked appointment slot description, otherwise empty string")
        ] = "",
        new_facts_learned: Annotated[
            str,
            Field(description="Comma-separated list of new facts learned during this call"),
        ] = "",
    ):
        """Store a structured summary of this call to the knowledge base so future calls can reference it."""
        try:
            facts = [f.strip() for f in new_facts_learned.split(",") if f.strip()] if new_facts_learned else []
            result = senso_client.write_summary(
                patient_name=patient_name,
                patient_intent=patient_intent,
                insurance_detected=insurance_detected,
                slot_booked=slot_booked,
                new_facts_learned=facts,
            )
            # Push to frontend for display
            entry = senso_client.get_context(patient_name)[-1]
            await perform_rpc_to_frontend(
                self._ctx, "updateKnowledgeBase", json.dumps(entry)
            )
            return result
        except Exception as e:
            raise llm.LLMToolException(f"Failed to update knowledge base: {e!s}") from e


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="Anam-Demo")
async def intake_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    await ctx.connect()

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        llm=inference.LLM(model="openai/gpt-4o"),
        tts=elevenlabs.TTS(),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Start Anam avatar session
    anam_avatar_id = os.getenv("ANAM_AVATAR_ID", "")
    if os.getenv("ANAM_API_KEY"):
        avatar = anam.AvatarSession(
            persona_config=anam.PersonaConfig(
                name="Liv",
                avatarId=anam_avatar_id,
            ),
        )
        await avatar.start(session, room=ctx.room)

    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def on_metrics_collected(ev: MetricsCollectedEvent) -> None:
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    await session.start(
        agent=IntakeAssistant(ctx),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # Listen for data messages from the frontend (e.g. card extraction notifications)
    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        try:
            payload = json.loads(data.data.decode("utf-8"))
            message = payload.get("message", "")
            if message:
                session.generate_reply(instructions=message)
        except Exception:
            pass

    session.generate_reply(
        instructions="Use the defined opening line. Ask the patient to show their photo ID on camera."
    )


if __name__ == "__main__":
    cli.run_app(server)
