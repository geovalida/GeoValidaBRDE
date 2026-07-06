// config.js — Configurações de ambiente
// Os placeholders #{...}# são substituídos pela pipeline do Azure DevOps em cada deploy.
// NÃO commitar este arquivo com valores reais.
var APP_CONFIG = {
    MAPBIOMAS_EMAIL: "#{MAPBIOMAS_EMAIL}#",
    MAPBIOMAS_PASSWORD: "#{MAPBIOMAS_PASSWORD}#"
};
