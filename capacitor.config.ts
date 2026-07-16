import type { CapacitorConfig } from "@capacitor/cli";

// App Android que abre o site já publicado na Lovable dentro de um WebView
// nativo (não empacota build estático local — o app usa funções de servidor
// reais, então precisa do backend Nitro rodando ao vivo).
const config: CapacitorConfig = {
  appId: "app.lovable.prever.proposta",
  appName: "Prever",
  webDir: "dist",
  server: {
    url: "https://prever.lovable.app",
    cleartext: false,
  },
};

export default config;
