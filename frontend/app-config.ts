export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  // agent dispatch configuration
  agentName?: string;

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'ThirdVoice Intake',
  pageTitle: 'ThirdVoice Intake',
  pageDescription: 'Autonomous patient intake and scheduling agent',

  supportsChatInput: false,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,

  logo: '/livecare-logo-light.svg',
  accent: '#2563EB',
  logoDark: '/livecare-logo-dark.svg',
  accentDark: '#3B82F6',
  startButtonText: 'Start intake call',

  // agent dispatch configuration
  agentName: process.env.AGENT_NAME ?? 'Anam-Demo',

  // LiveKit Cloud Sandbox configuration
  sandboxId: undefined,
};
