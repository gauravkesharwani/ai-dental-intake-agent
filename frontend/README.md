# Anam Dental Intake — Frontend

The Next.js frontend for the Anam dental intake demo. Provides the patient-facing UI with an Anam avatar, intake form, card capture, appointment scheduling, and knowledge base display.

Built with Next.js, React, Tailwind CSS, and [LiveKit Agents UI](https://livekit.io/ui) components.

## Features

- **Anam avatar panel**: Real-time lip-synced video avatar rendering
- **Intake form**: Interactive form that updates in real time as the agent fills it via RPC
- **Card capture**: Camera-based capture flow for photo ID and insurance cards
- **Insurance upload**: Upload or capture insurance card images
- **Schedule panel**: Displays available appointment slots sent by the agent
- **Knowledge panel**: Shows previous visit data for returning patients
- **Chat transcript**: Displays the conversation between patient and agent
- **Theme switching**: Light/dark theme with system preference detection
- **Branding configuration**: Customizable company name, colors, logos, and button text via `app-config.ts`

## Dev Setup

```console
cd frontend
pnpm install
```

Copy `.env.example` to `.env.local` and fill in:

```bash
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-project.livekit.cloud
AGENT_NAME=Anam-Demo
GOOGLE_API_KEY=your_gemini_api_key   # Optional — enables frontend-side card extraction
```

Use the same LiveKit credentials as your agent backend. `AGENT_NAME=Anam-Demo` matches both the Python and TypeScript backends.

## Run

```console
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You also need one of the agent backends running. See the [Python backend](../agent-py/) or [TypeScript backend](../agent-ts/) READMEs.

## Project structure

```
frontend/
├── app/
│   ├── api/
│   │   ├── connection-details/  # LiveKit connection token endpoint
│   │   ├── extract-id/          # Server-side ID card OCR endpoint
│   │   └── extract-insurance/   # Server-side insurance card OCR endpoint
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── agents-ui/     # LiveKit Agents UI components (shadcn-based)
│   ├── ai-elements/   # Conversation, message, shimmer components
│   ├── app/
│   │   ├── app.tsx              # Root app with session provider
│   │   ├── session-view.tsx     # Main session layout
│   │   ├── view-controller.tsx  # Welcome → session state transitions
│   │   ├── welcome-view.tsx     # Pre-session welcome screen
│   │   ├── avatar-panel.tsx     # Anam avatar video rendering
│   │   ├── intake-form.tsx      # Patient intake form
│   │   ├── card-capture.tsx     # Camera-based card capture
│   │   ├── insurance-upload.tsx # Insurance card upload/capture
│   │   ├── schedule-panel.tsx   # Appointment schedule display
│   │   ├── knowledge-panel.tsx  # Previous visit info display
│   │   ├── chat-transcript.tsx  # Conversation transcript
│   │   └── tile-layout.tsx      # Media tile layout management
│   └── ui/            # Primitive shadcn/ui components
├── app-config.ts       # Branding, feature flags, agent dispatch config
└── styles/globals.css
```

## Configuration

Edit `app-config.ts` to customize branding and features:

```ts
export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'ThirdVoice Intake',
  pageTitle: 'ThirdVoice Intake',
  pageDescription: 'Autonomous patient intake and scheduling agent',
  logo: '/livecare-logo-light.svg',
  accent: '#2563EB',
  startButtonText: 'Start intake call',
  agentName: process.env.AGENT_NAME ?? 'Anam-Demo',
  // ...
};
```

## RPC methods

The frontend registers these RPC handlers that the agent calls:

| Method                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `updateField`           | Update a specific form field                     |
| `getFormState`          | Return current values of all form fields         |
| `submitForm`            | Submit the completed form                        |
| `requestCardImage`      | Activate camera capture for ID or insurance card |
| `displaySchedule`       | Show available appointment slots                 |
| `displayPreviousVisits` | Show returning patient info                      |
| `updateKnowledgeBase`   | Display stored call summary                      |
