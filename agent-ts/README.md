# Anam Dental Intake Agent — TypeScript

The TypeScript backend for the Anam dental intake demo. This is a **simplified** version that covers voice-based form filling without the vision, scheduling, or knowledge base features available in the Python backend.

Built with [LiveKit Agents for Node.js](https://github.com/livekit/agents-js), [Anam avatars](https://docs.livekit.io/agents/models/avatar/plugins/anam/), and [LiveKit Cloud](https://cloud.livekit.io/).

## Features

- **Voice intake flow**: Guides patients through a 9-field intake form one section at a time
- **One question at a time**: Confirms each answer (including spelling back names) before proceeding
- **Real-time form updates**: Agent updates the on-screen form via RPC as the patient speaks
- **Anam avatar**: Lip-synced video avatar
- **Voice pipeline**: Deepgram STT, OpenAI LLM, and Cartesia TTS via [LiveKit Inference](https://docs.livekit.io/agents/models/)
- [LiveKit Turn Detector](https://docs.livekit.io/agents/build/turns/turn-detector/) for contextually-aware speaker detection
- [Background voice cancellation](https://docs.livekit.io/home/cloud/noise-cancellation/)
- Integrated [metrics and logging](https://docs.livekit.io/agents/build/metrics/)
- A Dockerfile ready for [production deployment](https://docs.livekit.io/agents/ops/deployment/)

> **Note**: For the full experience with ID/insurance card scanning, appointment scheduling, and knowledge base, use the [Python backend](../agent-py/) instead.

## Dev Setup

Requires Node.js 22+ and pnpm.

```console
cd agent-ts
pnpm install
```

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
ANAM_API_KEY=your_anam_api_key
```

You can load LiveKit credentials automatically:

```bash
lk cloud auth
lk app env -w -d .env.local
```

## Run the agent

Download required models (one-time):

```console
pnpm run download-files
```

Start in development mode:

```console
pnpm run dev
```

Start in production:

```console
pnpm run start
```

The agent registers as `Anam-Demo`.

## Frontend

The shared Next.js frontend is in `../frontend`. See the [frontend README](../frontend/README.md) or the [top-level README](../README.md) for setup instructions.

## Source files

| File           | Description                                             |
| -------------- | ------------------------------------------------------- |
| `src/main.ts`  | Agent entry point and LiveKit session setup              |
| `src/agent.ts` | Intake agent class with instructions and function tools |

## Function tools

| Tool             | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `update_field`   | Update a specific form field on the patient's screen via RPC |
| `get_form_state` | Retrieve the current state of all form fields                |
| `submit_form`    | Submit the completed intake form                             |

## Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Anam Avatar Plugin](https://docs.livekit.io/agents/models/avatar/plugins/anam/)
- [LiveKit Inference](https://docs.livekit.io/agents/models/)
- [Function Tools](https://docs.livekit.io/agents/build/tools/)
- [RPC Communication](https://docs.livekit.io/home/client/data/rpc/)
