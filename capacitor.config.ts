import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vraxis.kickoffstar',
  appName: 'Kickoff Star',
  webDir: 'dist',
  plugins: {
    SystemBars: { insetsHandling: 'css', style: 'DARK', hidden: false }
  }
};

export default config;
