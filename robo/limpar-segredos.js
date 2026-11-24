'use strict';
// Tira do texto o que parece segredo (token, senha, chave de API, Bearer, cookie, chave privada, base64 comprido).
// Era da Central (central.js, 07/11/2026); saiu para cá (auditoria de segurança, 24/11/2026) para o suporte usar no
// relatório do Claude, que volta a quem mandou o bug: nada que o Claude tenha lido de segredo sai no texto.
function limparSegredos(texto) {
  return String(texto == null ? '' : texto)
    .replace(/-----BEGIN [A-Z ]*-----[\s\S]*?(-----END [A-Z ]*-----|$)/g, '***')
    .replace(/\b(bearer|basic)\s+[\w\-.~+/=]{8,}/gi, '$1 ***')
    .replace(/\b(token|access_token|refresh_token|id_token|senha|password|passwd|secret|segredo|client_secret|api[_-]?key|chave|authorization|cookie|set-cookie)(["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi, '$1$2***')
    .replace(/\bAIza[\w-]{20,}/g, '***')
    .replace(/\bya29\.[\w\-.]+/g, '***')
    .replace(/\b1\/\/[\w-]{20,}/g, '***')
    .replace(/\b(sk|pk|rk)-[\w-]{16,}/g, '***')
    .replace(/[A-Za-z0-9+_-]{40,}={0,2}/g, '***');
}

module.exports = { limparSegredos };
