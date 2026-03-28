# Anam Dental Intake Agent — Python

The Python backend for the Anam dental intake demo. This is the **full-featured** backend with ID/insurance card scanning, appointment scheduling, and knowledge base integration.

Built with [LiveKit Agents for Python](https://github.com/livekit/agents), [Anam avatars](https://docs.livekit.io/agents/models/avatar/plugins/anam/), and [LiveKit Cloud](https://cloud.livekit.io/).

## Features

- **Autonomous dental intake**: Guides patients through the full check-in flow via voice
- **ID card capture**: Camera-based scan with [Gemini Vision](https://ai.google.dev/) OCR to extract name, DOB, and address (falls back to mock data without a Google API key)
- **Insurance card capture**: Extracts provider, member ID, group number, and policy holder
- **Appointment scheduling**: In-memory mock schedule across multiple doctors; agent checks availability and books slots
- **Knowledge base**: [Senso KB](https://www.senso.ai/) integration to recognize returning patients and store call summaries (falls back to in-memory without a Senso API key)
- **Mock data fill**: Auto-populates emergency contact, medications, and allergies for demo purposes
- **Anam avatar**: Lip-synced video avatar
- **Voice pipeline**: Deepgram STT, OpenAI LLM, ElevenLabs TTS via [LiveKit Inference](https://docs.livekit.io/agents/models/)
- [LiveKit Turn Detector](https://docs.livekit.io/agents/build/turns/turn-detector/) for contextually-aware speaker detection
- [Background voice cancellation](https://docs.livekit.io/home/cloud/noise-cancellation/)
- Integrated [metrics and logging](https://docs.livekit.io/agents/build/metrics/)
- A Dockerfile ready for [production deployment](https://docs.livekit.io/agents/ops/deployment/)

## Dev Setup

Install dependencies:

```console
cd agent-py
uv sync
```

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
ANAM_API_KEY=your_anam_api_key

# Optional
GOOGLE_API_KEY=your_gemini_api_key   # Enables real card OCR (mock data without it)
SENSO_API_KEY=your_senso_api_key     # Enables persistent knowledge base (in-memory without it)
ANAM_AVATAR_ID=your_avatar_id       # Custom avatar (uses Anam default without it)
```

You can load LiveKit credentials automatically:

```bash
lk cloud auth
lk app env -w -d .env.local
```

## Run the agent

Download required models (one-time):

```console
uv run python src/agent.py download-files
```

Start in development mode:

```console
uv run python src/agent.py dev
```

Start in production:

```console
uv run python src/agent.py start
```

The agent registers as `Anam-Demo`.

## Frontend

The shared Next.js frontend is in `../frontend`. See the [frontend README](../frontend/README.md) or the [top-level README](../README.md) for setup instructions.

## Source files

| File               | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| `src/agent.py`     | Main agent: intake flow, Anam avatar session, all function tools |
| `src/vision.py`    | Card OCR via Gemini Vision with mock fallback                    |
| `src/schedule.py`  | In-memory appointment schedule store                             |
| `src/senso.py`     | Knowledge base client (Senso API + in-memory fallback)           |

## Function tools

| Tool                      | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| `update_field`            | Update a specific form field on the patient's screen via RPC              |
| `get_form_state`          | Retrieve the current state of all form fields                             |
| `submit_form`             | Submit the completed intake form                                          |
| `read_id_card`            | Activate camera to capture photo ID, extract info via Gemini Vision       |
| `read_insurance_card`     | Activate camera to capture insurance card, extract info via Gemini Vision |
| `check_schedule`          | Check available appointment slots (optionally filter by doctor/date)      |
| `book_appointment`        | Book a specific appointment slot                                          |
| `fill_mock_data`          | Auto-populate remaining empty fields with demo data                       |
| `check_returning_patient` | Search knowledge base for previous visits                                 |
| `update_knowledge_base`   | Store a structured summary of this call                                   |

## Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Anam Avatar Plugin](https://docs.livekit.io/agents/models/avatar/plugins/anam/)
- [LiveKit Inference](https://docs.livekit.io/agents/models/)
- [Function Tools](https://docs.livekit.io/agents/build/tools/)
- [RPC Communication](https://docs.livekit.io/home/client/data/rpc/)
