// Leitura do que a rotina de arquivamento ("Claudio Secretario") deixou
// registrado — só leitura, nada aqui escreve na pasta da rotina.
//
// A rotina mora em outro repositório (GUSTAVO\claudio), que este não altera.
// Ela deixa três rastros em _CONTROLE\, e é deles que sai o "controle do que
// foi arquivado" da tela:
//
//   MANIFESTO\manifesto.jsonl   uma linha por arquivo arquivado, com o nome
//                               original, a pasta de destino e a execução.
//                               É a fonte confiável: formato fixo.
//   MANIFESTO\qualidade.jsonl   uma linha por execução (quantos não
//                               identificados, alerta).
//   LOGS\AAAA-MM\DD\EXEC-*.txt  o relatório da execução. Quem escreve é o
//   (e SIM-* nas simulações)    próprio Claude, então o formato varia de um dia
//                               pro outro: daqui só se aproveita o que tem cara
//                               fixa ("CATEGORIA: ...") e o texto inteiro, pra
//                               quem quiser ler.
//
// Funções puras (recebem texto, devolvem objeto): o teste roda sem disco.
const fs = require('fs');
const path = require('path');

// O manifesto grava caminho do Windows sem escapar a barra ("G:\Meu Drive"),
// o que não é JSON válido. Tenta do jeito certo e, se não der, com as barras
// viradas — que é como o caminho vai ser mostrado mesmo.
function lerLinhaJson(linha) {
  const t = String(linha || '').trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { /* segue */ }
  try { return JSON.parse(t.replace(/\\/g, '/')); } catch (e) { return null; }
}

// "G:/Meu Drive/2026/58 - TORNEARIA VOLPONI LTDA/CONTÁBIL/EXTRATOS/2026/06/"
//   -> { codigo: '58', cliente: 'TORNEARIA VOLPONI LTDA', subpasta: 'CONTÁBIL/EXTRATOS/2026/06' }
function destinoPorPartes(destino) {
  const partes = String(destino || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const iAno = partes.findIndex((p, i) => i > 0 && /^\d{4}$/.test(p) && /^\d+\s*-\s*/.test(partes[i + 1] || ''));
  if (iAno === -1) return { codigo: null, cliente: null, subpasta: partes.join('/') };
  const m = /^(\d+)\s*-\s*(.+)$/.exec(partes[iAno + 1]);
  return { codigo: m[1], cliente: m[2].trim(), subpasta: partes.slice(iAno + 2).join('/') };
}

// manifesto.jsonl inteiro -> Map(idExecucao -> [arquivos])
function agruparManifesto(texto) {
  const porExecucao = new Map();
  String(texto || '').split(/\r?\n/).forEach(linha => {
    const r = lerLinhaJson(linha);
    if (!r || !r.id_execucao) return;
    const d = destinoPorPartes(r.destino_final);
    const item = {
      original: r.nome_original || '',
      final: r.nome_final || r.nome_original || '',
      codigo: d.codigo,
      cliente: d.cliente,
      subpasta: d.subpasta,
    };
    if (!porExecucao.has(r.id_execucao)) porExecucao.set(r.id_execucao, []);
    porExecucao.get(r.id_execucao).push(item);
  });
  return porExecucao;
}

// qualidade.jsonl -> Map(idExecucao -> { naoIdentificados, alerta, pais })
function lerQualidade(texto) {
  const m = new Map();
  String(texto || '').split(/\r?\n/).forEach(linha => {
    const r = lerLinhaJson(linha);
    if (!r || !r.id_execucao) return;
    m.set(r.id_execucao, {
      naoIdentificados: typeof r.nao_identificados_count === 'number' ? r.nao_identificados_count : null,
      alerta: r.alerta || null,
      pais: typeof r.N_pais === 'number' ? r.N_pais : null,
    });
  });
  return m;
}

// Do relatório, só o que tem forma fixa: "CATEGORIA: resto da linha".
function lerRelatorio(texto) {
  const contagens = {};
  const naoIdentificados = [];
  // O cabeçalho diz o modo de verdade. O prefixo do id não é confiável: uma
  // SIMULACAO já saiu como "EXEC-..." (e com a hora em UTC).
  const cab = /^\s*modo\s*:\s*([A-Z_]+)/m.exec(String(texto || ''));
  const modo = cab ? cab[1] : null;
  String(texto || '').split(/\r?\n/).forEach(linha => {
    const m = /^([A-Z][A-Z_]{3,}):\s*(.*)$/.exec(linha.trim());
    if (!m) return;
    contagens[m[1]] = (contagens[m[1]] || 0) + 1;
    if (m[1] === 'NAO_IDENTIFICADO') {
      const partes = m[2].split(/\s+->\s+/);
      const motivo = (partes[1] || '').replace(/^\(|\)$/g, '').trim();
      naoIdentificados.push({ nome: partes[0].trim(), motivo });
    }
  });
  return { contagens, naoIdentificados, modo };
}

// "EXEC-20260924-130945" -> "2026-09-24T13:09:45" (hora local do PC, que é a do escritório)
function dataDoId(id) {
  const m = /-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-|$)/.exec(id || '');
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString();
}

function modoDoId(id) {
  if (/^EXEC-/.test(id)) return 'PRODUCAO';
  if (/^SIM-/.test(id)) return 'SIMULACAO';
  if (/^AUD-/.test(id)) return 'AUDITORIA';
  if (/^BACKFILL-/.test(id)) return 'CARGA_INICIAL';   // histórico trazido de antes da rotina existir
  return null;
}

// Todos os relatórios de execução que existem em LOGS\AAAA-MM\DD\.
function listarExecucoes(raizControle) {
  const logs = path.join(raizControle, 'LOGS');
  const achadas = [];
  let meses = [];
  try { meses = fs.readdirSync(logs).filter(d => /^\d{4}-\d{2}$/.test(d)); } catch (e) { return achadas; }
  for (const mes of meses) {
    let dias = [];
    try { dias = fs.readdirSync(path.join(logs, mes)).filter(d => /^\d{2}$/.test(d)); } catch (e) { continue; }
    for (const dia of dias) {
      let arqs = [];
      try { arqs = fs.readdirSync(path.join(logs, mes, dia)); } catch (e) { continue; }
      for (const a of arqs) {
        const m = /^((?:EXEC|SIM|AUD)-\d{8}-\d{6}(?:-[A-Z0-9]+)?)\.txt$/.exec(a);
        if (!m) continue;
        const caminho = path.join(logs, mes, dia, a);
        let mtime = 0;
        try { mtime = fs.statSync(caminho).mtimeMs; } catch (e) { continue; }
        achadas.push({ id: m[1], txt: caminho, mtime });
      }
    }
  }
  return achadas.sort((a, b) => a.mtime - b.mtime);
}

const MAX_ARQUIVOS_NO_DETALHE = 2500;   // folga larga sob o teto de 1 MB por documento
const MAX_RELATORIO = 120 * 1024;

// Monta os dois documentos de uma execução: o resumo (leve, pra lista) e o
// detalhe (lista de arquivos + relatório, carregado só quando alguém abre).
// mtimeRelatorio: quando o relatório foi gravado (fim da execução). É a hora
// que vale pra mostrar: a do id às vezes vem em UTC.
function montarExecucao(id, arquivos, qualidade, relatorioTexto, mtimeRelatorio) {
  arquivos = arquivos || [];
  const rel = lerRelatorio(relatorioTexto);
  const porCliente = new Map();
  arquivos.forEach(a => {
    if (!a.codigo) return;
    const c = porCliente.get(a.codigo) || { codigo: a.codigo, nome: a.cliente, n: 0 };
    c.n++;
    porCliente.set(a.codigo, c);
  });
  const clientes = Array.from(porCliente.values()).sort((a, b) => b.n - a.n);
  const naoId = qualidade && qualidade.naoIdentificados != null ? qualidade.naoIdentificados : rel.naoIdentificados.length;
  const resumo = {
    id,
    modo: rel.modo || modoDoId(id),
    em: mtimeRelatorio ? new Date(mtimeRelatorio).toISOString() : dataDoId(id),
    arquivados: arquivos.length,
    naoIdentificados: naoId,
    duplicados: rel.contagens.DUPLICADO || 0,
    jaArquivados: rel.contagens.JA_ARQUIVADO_ANTERIORMENTE || 0,
    alerta: qualidade && qualidade.alerta && qualidade.alerta !== 'NENHUM' ? qualidade.alerta : null,
    codigos: clientes.map(c => c.codigo),
    clientes: clientes.slice(0, 60),
    contagens: rel.contagens,
  };
  const texto = String(relatorioTexto || '');
  const detalhe = {
    arquivos: arquivos.slice(0, MAX_ARQUIVOS_NO_DETALHE),
    arquivosCortados: Math.max(0, arquivos.length - MAX_ARQUIVOS_NO_DETALHE),
    naoIdentificados: rel.naoIdentificados.slice(0, 500),
    relatorio: texto.length > MAX_RELATORIO ? texto.slice(0, MAX_RELATORIO) + '\n\n[relatório cortado aqui]' : texto,
  };
  return { resumo, detalhe };
}

// O que foi arquivado no mês, para o painel do robô (21/10/2026): as execuções de PRODUÇÃO do mês de `agora`, a mais
// nova primeiro, e as somas de hoje e do mês. Conta pelo manifesto (a fonte confiável); a hora é a do relatório quando
// há (a do id às vezes vem em UTC). porExec: agruparManifesto; relatorios: Map(id -> { mtime }); qual: lerQualidade.
const MAX_EXECUCOES_NO_PAINEL = 40;
function resumoDoMes(porExec, relatorios, qual, agora) {
  const d = agora || new Date();
  const dois = n => String(n).padStart(2, '0');
  const diaDe = x => x.getFullYear() + '-' + dois(x.getMonth() + 1) + '-' + dois(x.getDate());
  const hoje = diaDe(d);
  const mes = hoje.slice(0, 7);
  const execucoes = [];
  for (const id of new Set([...(porExec ? porExec.keys() : []), ...(relatorios ? relatorios.keys() : [])])) {
    if (modoDoId(id) !== 'PRODUCAO') continue;
    const rel = relatorios && relatorios.get(id);
    const em = rel && rel.mtime ? new Date(rel.mtime) : (dataDoId(id) ? new Date(dataDoId(id)) : null);
    if (!em || diaDe(em).slice(0, 7) !== mes) continue;
    const arquivos = (porExec && porExec.get(id)) || [];
    const q = qual && qual.get(id);
    execucoes.push({
      id, em: em.toISOString(), dia: diaDe(em), arquivados: arquivos.length,
      clientes: new Set(arquivos.map(a => a.codigo).filter(Boolean)).size,
      naoIdentificados: q && q.naoIdentificados != null ? q.naoIdentificados : 0,
    });
  }
  execucoes.sort((a, b) => b.em.localeCompare(a.em));
  const soma = (lista, campo) => lista.reduce((s, e) => s + e[campo], 0);
  return {
    mes, em: d.toISOString(),
    hoje: soma(execucoes.filter(e => e.dia === hoje), 'arquivados'),
    noMes: soma(execucoes, 'arquivados'),
    naoIdentificadosNoMes: soma(execucoes, 'naoIdentificados'),
    execucoesNoMes: execucoes.length,
    execucoes: execucoes.slice(0, MAX_EXECUCOES_NO_PAINEL),
  };
}

module.exports = {
  lerLinhaJson, destinoPorPartes, agruparManifesto, lerQualidade, lerRelatorio,
  dataDoId, modoDoId, listarExecucoes, montarExecucao, resumoDoMes,
};
