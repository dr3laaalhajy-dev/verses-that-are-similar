/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface AndroidBridgeInterface {
  requestNotificationPermission: () => void;
  getFcmToken?: () => void;
  isNotificationPermissionGranted?: () => boolean;
}

interface Window {
  AndroidBridge?: AndroidBridgeInterface;
}

