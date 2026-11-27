// A regra do Chrome que escolhe o certificado do escritório sozinho (27/11/2026, o dono: "pode fazer"). O Chrome do robô (o
// do FGTS, fgts-chrome.js) já tem a regra AutoSelectCertificateForUrls para o gov.br, posta à mão no registro do Windows do
// NILMA-SERVER. Para o Login Único da SEF-MG (a certidão estadual, cdt.fazenda.mg.gov.br) é preciso uma igual. O robô
// acrescenta sozinho, ao ligar: acha a regra do gov.br (no HKLM ou no HKCU, onde ela estiver), copia o filtro do certificado
// e grava a nova com o próximo número da lista, no mesmo lugar. Se a regra já existe, não mexe; nunca apaga nem troca as outras.
// O Chrome lê a regra nova quando abre de novo (ou na releitura dele das regras).
'use strict';
const { execFileSync } = require('child_process');

const CHAVES = ['HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\AutoSelectCertificateForUrls', 'HKCU\\SOFTWARE\\Policies\\Google\\Chrome\\AutoSelectCertificateForUrls'];

/** As linhas do `reg query` da chave: [{ nome, valor }] (só os REG_SZ). */
function lerSaidaDoReg(saida) {
  const out = [];
  for (const linha of String(saida || '').split(/\r?\n/)) {
    const m = /^\s+(\S+)\s+REG_SZ\s+(.*)$/.exec(linha);
    if (m) out.push({ nome: m[1], valor: m[2].trim() });
  }
  return out;
}

/**
 * O que gravar para o site (pattern), a partir das regras que já existem: null = já tem regra para o site, ou não há a do
 * gov.br para copiar o filtro. { nome, valor } = o próximo número e o JSON da regra nova.
 */
function regraNova(existentes, pattern, host) {
  const lidas = existentes.map(e => { try { return { nome: e.nome, regra: JSON.parse(e.valor) }; } catch (_) { return { nome: e.nome, regra: null }; } });
  if (lidas.some(l => l.regra && String(l.regra.pattern || '').includes(host))) return null;
  const base = lidas.find(l => l.regra && /gov\.br/.test(String(l.regra.pattern || '')) && l.regra.filter);
  if (!base) return null;
  const numeros = lidas.map(l => Number(l.nome)).filter(n => Number.isInteger(n) && n > 0);
  const proximo = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return { nome: String(proximo), valor: JSON.stringify({ pattern, filter: base.regra.filter }) };
}

/** Garante a regra do certificado para o site; devolve o que aconteceu (para o log). Nunca derruba o robô. */
function garantirRegra(pattern, host, rodar = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true })) {
  for (const chave of CHAVES) {
    let saida = '';
    try { saida = rodar('reg', ['query', chave]); } catch (_) { continue; }
    const existentes = lerSaidaDoReg(saida);
    if (!existentes.length) continue;
    if (existentes.some(e => e.valor.includes(host))) return 'a regra do certificado para ' + host + ' já existe (' + chave.slice(0, 4) + ')';
    const nova = regraNova(existentes, pattern, host);
    if (!nova) continue;
    try {
      rodar('reg', ['add', chave, '/v', nova.nome, '/t', 'REG_SZ', '/d', nova.valor, '/f']);
      return 'regra do certificado para ' + host + ' gravada em ' + chave.slice(0, 4) + ' (número ' + nova.nome + ')';
    } catch (err) {
      return 'não consegui gravar a regra do certificado para ' + host + ' em ' + chave.slice(0, 4) + ': ' + String(err.message || err).slice(0, 160);
    }
  }
  return 'não achei a regra do certificado do gov.br para copiar (a do ' + host + ' fica para pôr à mão)';
}

module.exports = { garantirRegra, regraNova, lerSaidaDoReg, CHAVES };
