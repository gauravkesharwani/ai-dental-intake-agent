---
name: anam-healthcare-intake
description: Build an AI-powered healthcare intake assistant with a lip-synced Anam avatar, LiveKit voice pipeline, and real-time form updates via RPC
license: MIT
compatibility: "Python >=3.10, Node.js >=18"
---

# Anam Healthcare Intake Agent

A voice-driven healthcare intake assistant that uses a lip-synced Anam avatar to guide patients through a medical intake form. The agent collects patient information one field at a time, confirms answers, and updates the on-screen form in real time.

## Architecture

This skill uses a **Python agent backend** with a **Next.js frontend**:

- **Agent** (`agent-py/`): LiveKit Agents voice pipeline with Deepgram STT, OpenAI LLM, ElevenLabs TTS, and Anam avatar
- **Frontend** (`frontend/`): Next.js app with real-time form, avatar video, and RPC communication

The agent communicates with the frontend via LiveKit RPC using three function tools:
- `update_field` — updates a specific intake form field on the patient's screen
- `get_form_state` — retrieves the current state of all form fields
- `submit_form` — submits the completed intake form

## Intake Form Fields

The agent collects these fields in order:

1. Full legal name
2. Date of birth
3. Address
4. Phone number
5. Emergency contact (name, relationship, phone)
6. Current medications
7. Allergies
8. Reason for visit
9. Insurance information (provider, member ID, group number, policy holder)
10. Appointment slot

## Prerequisites

- Python 3.10+ with `uv` package manager
- Node.js 18+ with `pnpm`
- LiveKit Cloud account (get credentials at https://cloud.livekit.io/)
- Anam API key (get at https://lab.anam.ai/api-keys)

## Setup Instructions

### 1. Install dependencies

```bash
# Python backend
cd agent-py && uv sync && cd ..

# Frontend
cd frontend && pnpm install && cd ..
```

### 2. Configure environment

Create `.env.local` in both `agent-py/` and `frontend/` with:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
ANAM_API_KEY=your_anam_api_key
```

Frontend also needs:
```bash
AGENT_NAME=Anam-Demo
```

### 3. Download models (first run only)

```bash
cd agent-py
uv run python src/agent.py download-files
```

### 4. Run

```bash
# Terminal 1: Start the agent
cd agent-py && uv run python src/agent.py dev

# Terminal 2: Start the frontend
cd frontend && pnpm dev
```

Open http://localhost:3000 to start the intake session.

## Key Patterns

### RPC-based form updates
The agent uses LiveKit RPC to send field updates to the frontend in real time. Each field update is sent individually as the patient provides information, creating a live-updating form experience.

### One question at a time
The agent always confirms each answer before moving to the next field. This ensures accuracy and gives the patient control over their information.

### Voice pipeline
Uses LiveKit Inference to serve Deepgram (STT), OpenAI (LLM), and ElevenLabs (TTS) through a unified voice pipeline with Silero VAD for voice activity detection and a multilingual turn detector.

## Built With

- [LiveKit Agents](https://docs.livekit.io/agents/) — Agent framework
- [Anam Plugin](https://docs.livekit.io/agents/models/avatar/plugins/anam/) — Lip-synced avatar
- [LiveKit Inference](https://docs.livekit.io/agents/models/) — STT, LLM, TTS models
