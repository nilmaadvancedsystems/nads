// A regra do Chrome que escolhe o certificado do escritório sozinho (27/11/2026, o dono: "pode fazer"). Para o Login Único da
// SEF-MG (a certidão estadual, cdt.fazenda.mg.gov.br) o Chrome do robô precisa da regra AutoSelectCertificateForUrls; sem
// ela, o Chrome abre a janela de escolher o certificado e o robô fica parado. O robô acrescenta sozinho, ao ligar:
//   1. se já há uma regra para o site (em qualquer lugar), não mexe;
//   2. se há a do gov.br (no HKLM ou no HKCU), copia o filtro dela e grava a nova no mesmo lugar, com o próximo número;
//   3. senão (27/11/2026: no servidor a do gov.br não está no registro), monta o filtro pelo certificado e-CNPJ do escritório
//      instalado no Windows (o titular "NOME:CNPJ" com a chave privada, o que vence por último) e grava no HKCU.
// Nunca apaga nem troca as outras regras. O Chrome lê a regra nova quando abre de novo (ou na releitura dele das regras).
'use strict';
const { execFileSync } = require('child_process');

const HKLM = 'HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\AutoSelectCertificateForUrls';
const HKCU = 'HKCU\\SOFTWARE\\Policies\\Google\\Chrome\\AutoSelectCertificateForUrls';
const CHAVES = [HKLM, HKCU];

/** As linhas do `reg query` da chave: [{ nome, valor }] (só os REG_SZ). */
function lerSaidaDoReg(saida) {
  const out = [];
  for (const linha of String(saida || '').split(/\r?\n/)) {
    const m = /^\s+(\S+)\s+REG_SZ\s+(.*)$/.exec(linha);
    if (m) out.push({ nome: m[1], valor: m[2].trim() });
  }
  return out;
}

const proximoNumero = existentes => {
  const numeros = existentes.map(e => Number(e.nome)).filter(n => Number.isInteger(n) && n > 0);
  return String((numeros.length ? Math.max(...numeros) : 0) + 1);
};

/**
 * O que gravar para o site (pattern), a partir das regras que já existem: null = já tem regra para o site, ou não há a do
 * gov.br para copiar o filtro. { nome, valor } = o próximo número e o JSON da regra nova.
 */
function regraNova(existentes, pattern, host) {
  const lidas = existentes.map(e => { try { return { nome: e.nome, regra: JSON.parse(e.valor) }; } catch (_) { return { nome: e.nome, regra: null }; } });
  if (lidas.some(l => l.regra && String(l.regra.pattern || '').includes(host))) return null;
  const base = lidas.find(l => l.regra && /gov\.br/.test(String(l.regra.pattern || '')) && l.regra.filter);
  if (!base) return null;
  return { nome: proximoNumero(existentes), valor: JSON.stringify({ pattern, filter: base.regra.filter }) };
}

/** O CN de um nome distinto ("CN=NILMA LTDA:12345678000199, OU=..., O=ICP-Brasil" → "NILMA LTDA:12345678000199"). */
function cnDe(dn) {
  const m = /(?:^|,\s*)CN=("([^"]*)"|[^,]*)/i.exec(String(dn || ''));
  return m ? (m[2] != null ? m[2] : m[1]).trim() : '';
}

/**
 * O certificado e-CNPJ do escritório pela saída do PowerShell (uma linha por certificado: "titular|emissor|aaaa-mm-dd"):
 * o titular com ":<14 números>" no CN, o que vence por último. null = nenhum.
 */
function certificadoECnpj(saida) {
  const certs = String(saida || '').split(/\r?\n/).map(l => l.split('|')).filter(p => p.length >= 3)
    .map(([titular, emissor, vence]) => ({ titular: cnDe(titular), emissor: cnDe(emissor), vence: String(vence).trim() }))
    .filter(c => /:\d{14}$/.test(c.titular) && c.emissor);
  if (!certs.length) return null;
  certs.sort((a, b) => b.vence.localeCompare(a.vence));
  return certs[0];
}

const LISTAR_CERTIFICADOS = "Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } | ForEach-Object { $_.Subject + '|' + $_.Issuer + '|' + $_.NotAfter.ToString('yyyy-MM-dd') }";

/** Garante a regra do certificado para o site; devolve o que aconteceu (para o log e o erro do pedido). Nunca derruba o robô. */
function garantirRegra(pattern, host, rodar = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true })) {
  const visto = [];
  const porChave = new Map();
  for (const chave of CHAVES) {
    let saida = '';
    try { saida = rodar('reg', ['query', chave]); } catch (_) { visto.push(chave.slice(0, 4) + ': sem a chave'); continue; }
    const existentes = lerSaidaDoReg(saida);
    porChave.set(chave, existentes);
    visto.push(chave.slice(0, 4) + ': ' + existentes.length + ' regra(s)');
    if (existentes.some(e => e.valor.includes(host))) return 'a regra do certificado para ' + host + ' já existe (' + chave.slice(0, 4) + ')';
  }
  // 2. a do gov.br, copiando o filtro
  for (const [chave, existentes] of porChave) {
    const nova = regraNova(existentes, pattern, host);
    if (!nova) continue;
    try { rodar('reg', ['add', chave, '/v', nova.nome, '/t', 'REG_SZ', '/d', nova.valor, '/f']); return 'regra do certificado para ' + host + ' gravada em ' + chave.slice(0, 4) + ' (número ' + nova.nome + ', o filtro da do gov.br)'; }
    catch (err) { visto.push('não gravei em ' + chave.slice(0, 4) + ': ' + String(err.message || err).slice(0, 100)); }
  }
  // 3. pelo certificado e-CNPJ instalado
  let cert = null;
  try { cert = certificadoECnpj(rodar('powershell', ['-NoProfile', '-NonInteractive', '-Command', LISTAR_CERTIFICADOS])); }
  catch (err) { visto.push('não li os certificados: ' + String(err.message || err).slice(0, 100)); }
  if (!cert) return 'não achei a regra do gov.br nem o certificado e-CNPJ do escritório no Windows (' + visto.join('; ') + ')';
  // no HKCU (se o HKLM tiver a lista, a do HKCU não vale: aí grava no HKLM)
  const destino = (porChave.get(HKLM) || []).length ? HKLM : HKCU;
  const nome = proximoNumero(porChave.get(destino) || []);
  const valor = JSON.stringify({ pattern, filter: { ISSUER: { CN: cert.emissor }, SUBJECT: { CN: cert.titular } } });
  try {
    rodar('reg', ['add', destino, '/v', nome, '/t', 'REG_SZ', '/d', valor, '/f']);
    return 'regra do certificado para ' + host + ' gravada em ' + destino.slice(0, 4) + ' (número ' + nome + ', pelo certificado ' + cert.titular.replace(/:\d{14}$/, '') + ', vence ' + cert.vence + ')';
  } catch (err) {
    return 'não consegui gravar a regra do certificado para ' + host + ' em ' + destino.slice(0, 4) + ': ' + String(err.message || err).slice(0, 160) + ' (' + visto.join('; ') + ')';
  }
}

module.exports = { garantirRegra, regraNova, lerSaidaDoReg, certificadoECnpj, cnDe, CHAVES, HKLM, HKCU };
