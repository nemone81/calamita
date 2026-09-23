import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Calamita',
  version: '0.1.0',
  description: 'Attacca i dati di un documento ai campi giusti di un form, con un clic.',
  permissions: ['sidePanel', 'storage', 'scripting', 'activeTab', 'webNavigation'],
  host_permissions: [
    'https://api.anthropic.com/*',
    'https://api.openai.com/*',
    'https://generativelanguage.googleapis.com/*',
    'https://api.x.ai/*',
    'https://api.meta.ai/*',
  ],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  options_page: 'src/options/index.html',
  action: { default_title: 'Calamita — apri il pannello' },
  content_scripts: [{
    matches: ['<all_urls>'],
    js: ['src/content/index.ts'],
    run_at: 'document_idle',
    all_frames: true,   // i form stanno spesso dentro un iframe
  }],
  commands: {
    'apri-con-selezione': {
      suggested_key: { default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y' },
      description: 'Apri Calamita con il testo selezionato',
    },
  },
})
