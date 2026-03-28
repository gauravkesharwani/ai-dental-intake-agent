# Anam Dental Intake Agent

A LiveKit Agents demo that autonomously handles patient intake for a dental practice using voice, an Anam lip-synced avatar, and computer vision. The agent (Liv) guides patients through ID scanning, insurance capture, appointment scheduling, and form completion — all via natural conversation. The demo includes both a **Python** and a **TypeScript** backend; the Python backend has the full feature set, while the TypeScript backend covers basic intake flow. The frontend works with either.

## Features

- **Autonomous intake flow**: Liv walks patients through the entire check-in process hands-free
- **ID card scanning**: Camera-based capture with Gemini Vision OCR to extract name, DOB, and address
- **Insurance card scanning**: Camera-based capture to extract provider, member ID, group number, and policy holder
- **Appointment scheduling**: In-memory schedule with available slots across multiple doctors; agent books directly
- **Knowledge base**: Senso KB integration to recognize returning patients and personalize conversations
- **Real-time form updates**: Agent updates the on-screen form as the user speaks via RPC
- **Anam avatar**: Lip-synced video avatar powered by the Anam plugin
- **Voice pipeline**: Deepgram STT, OpenAI LLM, and ElevenLabs TTS (via LiveKit Inference)
- **Mock data fill**: Auto-populates remaining fields (emergency contact, medications, allergies) for demo purposes
- **Form submission**: Final confirmation loop, then submit from the frontend

> **Note**: The TypeScript backend (`agent-ts`) implements a simpler intake flow (voice-only form filling, no vision/scheduling/knowledge base). Use the Python backend (`agent-py`) for the full experience.

## Prerequisites

- **For the Python backend**: Python 3.10+, uv
- **For the TypeScript backend**: Node.js 22+, pnpm
- **For the frontend**: Node.js, pnpm
- LiveKit Cloud account
- Anam API key
- Google Gemini API key (optional, for real card OCR — falls back to mock data without it)
- Senso API key (optional, for persistent knowledge base — falls back to in-memory without it)

## Installation

1. Clone this repository and go to the anam demo
   ```bash
   git clone <repository-url>
   cd complex-agents/avatars/anam
   ```

2. Install the backend you want to use (or both).
   - **Python backend**
     ```bash
     cd agent-py
     uv sync
     cd ..
     ```
   - **TypeScript backend**
     ```bash
     cd agent-ts
     pnpm install
     cd ..
     ```

3. Install frontend dependencies
   ```bash
   cd frontend
   pnpm install
   cd ..
   ```

4. Set up environment for your chosen agent
   - **Python**: In `agent-py`, copy `.env.example` to `.env.local` and add your credentials.
   - **TypeScript**: In `agent-ts`, copy `.env.example` to `.env.local` and add your credentials.

5. Set up environment for the frontend
   In `frontend`, copy `.env.example` to `.env.local`. Add the same LiveKit credentials and set `AGENT_NAME=Anam-Demo`.

## Configuration

### Agent environment (`agent-py/.env.local` or `agent-ts/.env.local`)

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
ANAM_API_KEY=your_anam_api_key

# Python backend only:
GOOGLE_API_KEY=your_gemini_api_key     # Optional — enables real card OCR
SENSO_API_KEY=your_senso_api_key       # Optional — enables persistent knowledge base
ANAM_AVATAR_ID=your_avatar_id          # Optional — defaults to Anam's default avatar
```

Get your Anam API key from the [Anam dashboard](https://lab.anam.ai/api-keys). Get your LiveKit credentials from [LiveKit Cloud](https://cloud.livekit.io/) or the CLI:

```bash
lk cloud auth
lk app env -w -d .env.local
```

### Frontend (`frontend/.env.local`)

```bash
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-project.livekit.cloud
AGENT_NAME=Anam-Demo
GOOGLE_API_KEY=your_gemini_api_key     # Optional — enables frontend-side card extraction
```

Use the same LiveKit values as the agent. `AGENT_NAME=Anam-Demo` matches both backends.

## Usage

Run **one** backend (Python or TypeScript) and the frontend. Do not run both backends at the same time.

### Python backend

1. One-time: download Silero VAD and the turn detector model
   ```bash
   cd agent-py
   uv run python src/agent.py download-files
   ```

2. Start the agent
   ```bash
   uv run python src/agent.py dev
   ```

### TypeScript backend

1. One-time: download Silero VAD and the turn detector model
   ```bash
   cd agent-ts
   pnpm run download-files
   ```

2. Start the agent
   ```bash
   pnpm run dev
   ```

### Frontend

```bash
cd frontend
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser and start a session.

## Project structure

```
anam/
├── agent-py/                  # Python backend (full features)
│   ├── src/
│   │   ├── agent.py           # Intake agent, Anam avatar, function tools
│   │   ├── vision.py          # Card OCR via Gemini Vision (with mock fallback)
│   │   ├── schedule.py        # Mock appointment schedule store
│   │   └── senso.py           # Knowledge base client (Senso KB + in-memory)
│   ├── pyproject.toml
│   └── .env.local
├── agent-ts/                  # TypeScript backend (basic intake)
│   ├── src/
│   │   ├── main.ts            # Agent entry point
│   │   └── agent.ts           # Intake agent with update/get/submit tools
│   ├── package.json
│   └── .env.local
└── frontend/                  # Next.js frontend
    ├── app/
    │   └── api/               # Card extraction + connection details endpoints
    ├── components/app/
    │   ├── intake-form.tsx     # Patient intake form UI
    │   ├── card-capture.tsx    # Camera-based card capture
    │   ├── insurance-upload.tsx # Insurance card upload
    │   ├── schedule-panel.tsx  # Appointment schedule display
    │   ├── knowledge-panel.tsx # Previous visit info display
    │   ├── avatar-panel.tsx    # Anam avatar video rendering
    │   └── session-view.tsx    # Main session layout
    ├── app-config.ts           # Branding and feature flags
    └── .env.local
```

### Call flow (Python backend)

1. Greet patient, ask for photo ID
2. Capture ID via camera → Gemini Vision extracts name, DOB, address
3. Check knowledge base for returning patient
4. Ask reason for visit
5. Capture insurance card (if available) → extract provider, member ID, group number
6. Fill remaining fields with mock data
7. Show available appointment slots, book selection
8. Confirm all details, submit form
9. Store call summary to knowledge base

## Built with

- [LiveKit Agents](https://docs.livekit.io/agents/) — Agent framework
- [Anam plugin](https://docs.livekit.io/agents/models/avatar/plugins/anam/) — Lip-synced avatar
- [LiveKit Inference](https://docs.livekit.io/agents/models/) — STT (Deepgram), LLM (OpenAI), TTS (ElevenLabs)
- [Gemini Vision](https://ai.google.dev/) — Card OCR
- [Senso KB](https://www.senso.ai/) — Knowledge base persistence
- [Next.js](https://nextjs.org/) — Frontend framework
