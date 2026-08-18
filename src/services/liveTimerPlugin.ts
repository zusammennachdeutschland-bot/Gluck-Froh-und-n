import { registerPlugin } from '@capacitor/core';

export interface LiveTimerPluginInterface {
  /**
   * Starts the native android Foreground Service with Google Maps navigation-style live notification
   */
  startTimer(options: {
    title?: string;
    startTime: number;
    durationMins?: number;
    elapsedMins?: number;
    remainingMins?: number;
    percent?: number;
  }): Promise<void>;

  /**
   * Stops the native android Foreground Service and removes the notification
   */
  stopTimer(): Promise<void>;
}

const LiveTimer = registerPlugin<LiveTimerPluginInterface>('LiveTimer', {
  web: {
    startTimer: async (options) => {
      console.log('[LiveTimer Web Fallback] startTimer called:', options);
    },
    stopTimer: async () => {
      console.log('[LiveTimer Web Fallback] stopTimer called');
    },
  },
});

export default LiveTimer;
