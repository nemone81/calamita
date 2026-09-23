import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Incolla',
  version: '0.1.0',
  description: 'Spezza i dati di un documento in chip e riempie i form con un clic.',
  permissions: ['sidePanel', 'storage', 'scripting', 'activeTab'],
  host_permissions: [
    'https://api.anthropic.com/*',
    'https://api.openai.com/*',
    'https://generativelanguage.googleapis.com/*',
    'https://api.x.ai/*',
    'https://api.meta.ai/*',
  ],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  action: { default_title: 'Incolla — apri il pannello' },
  content_scripts: [{
    matches: ['<all_urls>'],
    js: ['src/content/index.ts'],
    run_at: 'document_idle',
    all_frames: false,
  }],
  commands: {
    'apri-con-selezione': {
      suggested_key: { default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y' },
      description: 'Apri Incolla con il testo selezionato',
    },
  },
})
