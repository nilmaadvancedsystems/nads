// O acompanhamento do arquivador novo no site do admin (Vitor, 22/10/2026: "se possível algo bem visual" e "eu preciso de
// um feedback melhor dele"). O modo contínuo (arquivador-continuo.js) avisa cada coisa que acontece — a varredura da pasta,
// o lote que começou, as decisões, o Drive fora, a espera pela rotina antiga, o lado a lado — e este módulo junta tudo e
// publica, com freio, o que a página Admin › Arquivador mostra:
//
//   robo/arquivadorNovo, campo `painel`   (no máximo 1 gravação a cada FREIO_MS; o campo `config` do mesmo documento é do
//                                          contínuo e não é tocado: grava com mergeFields)
//     o modo e o config em vigor, a pasta (quantos chegando, na fila, sendo lidos, parados), a passada atual (feitos de
//     total, o início e o ritmo), as contagens do dia e do mês (por ação, por tipo e por cliente, as pastas novas), os
//     últimos arquivos com o porquê (as evidências em português), os não identificados com o motivo e a sugestão, os
//     erros com o que fazer, os alertas de agora e o último lado a lado.
//   robo/arquivadorNovo/dias/{AAAA-MM-DD}-{n}   o histórico do dia em partes de até ~700 KB (a busca da aba Arquivados);
//                                          só a parte que mudou é regravada, junto com o documento principal; as de mais
//                                          de DIAS_GUARDADOS dias o próprio robô apaga (no banco e no PC), na virada do dia.
//
// No PC fica uma cópia do que foi publicado (continuo\acompanhamento.json) e o histórico do dia (continuo\arquivados-
// AAAA-MM-DD.jsonl), para o robô reiniciar sem perder as listas nem a contagem.
//
// Quem lê: só o admin (firestore.rules do Entregas). Quem grava: o robô, pelo Admin SDK.
// Regra deste módulo: NUNCA derrubar o arquivador. Toda entrada engole o próprio erro (no máximo uma linha no log).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const FREIO_MS = 45 * 1000;
const BATIMENTO_MS = 10 * 60 * 1000;
const MAX_ULTIMOS = 50;
const MAX_PENDENTES = 80;
const MAX_ERROS = 30;
const MAX_CHEGANDO = 40;
const MAX_EVIDENCIAS = 8;
const MAX_EVIDENCIAS_HISTORICO = 4;
const MAX_CLIENTES = 15;
const BYTES_POR_PARTE = 700 * 1024;
const JANELA_RITMO_MS = 10 * 60 * 1000;
const DIAS_GUARDADOS = 31;

// ---------------------------------------------------------------------------------------------------------------------
// puras (teste-arquivador-acompanhamento.js)
// ---------------------------------------------------------------------------------------------------------------------
/** O motivo do NÃO IDENTIFICADO (e do que fica na pasta) em português, e o que a pessoa faz. */
const MOTIVOS = {
  CLIENTE_NAO_LOCALIZADO: ['CNPJ não cadastrado', 'Nenhum CNPJ ou CPF do documento é de cliente. Se for de um cliente novo, cadastre o CNPJ no Cadastro do nads; se não for de cliente, tire o arquivo da pasta.'],
  CLIENTE_AMBIGUO: ['Duas empresas possíveis', 'O documento serve para mais de um cliente. Escolha o cliente certo e mova o arquivo para a pasta dele.'],
  EVENTO_SEM_ORIGINAL: ['Evento sem o documento original', 'É um evento (cancelamento, carta de correção, MDF-e, ciência…) de uma nota que não foi arquivada e que o SIEG também não tem. Procure a nota pela chave de acesso; se for de um cliente, arquive a nota e o evento na pasta dele.'],
  CONTEUDO_SEM_TEXTO: ['Escaneado sem leitura', 'É uma imagem sem texto e a leitura (OCR) não bastou. Peça o PDF original ao cliente ou arquive à mão.'],
  CONTEUDO_ILEGIVEL: ['Escaneado ilegível', 'A leitura (OCR) saiu ruim. Peça uma cópia melhor ou arquive à mão.'],
  CONFIANCA_ABAIXO_DO_LIMIAR: ['Pouca certeza', 'O robô achou um destino, mas sem certeza suficiente. Confira a sugestão e mova o arquivo, se estiver certa.'],
  COMPETENCIA_AUSENTE: ['Sem a competência', 'Não achou o mês do documento. Ponha o mês no nome do arquivo (ex.: 01-2026) ou arquive à mão.'],
  VENCIMENTO_AUSENTE: ['Sem o vencimento', 'Não achou o vencimento da guia. Arquive à mão.'],
  VALOR_AUSENTE: ['Sem o valor', 'Não achou o valor do documento. Arquive à mão.'],
  BANCO_AUSENTE: ['Banco não reconhecido', 'Não achou o banco. Ponha o nome do banco no nome do arquivo ou arquive à mão.'],
  BANCO_DIVERGENTE: ['Banco diferente do nome', 'O banco do conteúdo é outro que o do nome do arquivo. Confira qual é o certo e corrija o nome.'],
  TIPO_NAO_RECONHECIDO: ['Tipo de documento desconhecido', 'O robô ainda não conhece este documento. Arquive à mão; se for comum, peça a regra.'],
  FORMATO_SEM_REGRA: ['Formato sem regra', 'Imagem, Word e afins não têm regra automática. Arquive à mão.'],
  VOCABULARIO_AUSENTE: ['Faltou um dado do documento', 'Não leu um dado necessário (o tributo, a chave, o emissor ou o número). Arquive à mão.'],
  EMITENTE_INDETERMINADO: ['Emitente não identificado', 'Não deu para saber quem emitiu a nota. Arquive à mão.'],
  PARCELAMENTO_SEM_REGRA_DETERMINISTICA: ['Parcelamento', 'Guia de parcelamento precisa do número da parcela. Arquive à mão em PARCELAMENTOS.'],
  CONTRATO_SEM_NUMERO: ['Contrato sem número', 'Operação de crédito sem o número do contrato. Arquive à mão.'],
  REGIME_INDEFINIDO: ['Regime do cliente indefinido', 'O cliente está sem regime no Cadastro do nads. Preencha o regime e o robô arquiva na próxima volta.'],
  REGIME_SEM_ESPECIALISTA: ['Regime sem regra', 'O regime do cliente ainda não tem regra para este documento. Arquive à mão.'],
  TIPO_INCOMPATIVEL_COM_REGIME: ['Documento não combina com o regime', 'O documento não é do regime cadastrado (ex.: DAS de empresa do Lucro Presumido). Confira o regime no Cadastro.'],
  PASTA_DO_CLIENTE_DUPLICADA: ['Cliente com duas pastas', 'O código do cliente tem mais de uma pasta no Drive. Junte as pastas e o robô arquiva na próxima volta.'],
  PASTA_EXISTE_COM_OUTRO_CODIGO: ['Pasta com outro código', 'O Drive já tem a pasta desta empresa com outro código. Corrija o código no Cadastro ou o nome da pasta.'],
  HASH_CONFIRMADO_SEM_REGRA_DE_DESTINO: ['Cliente certo, destino sem regra', 'O robô sabe o cliente, mas não a pasta. Arquive à mão na pasta do cliente.'],
  PDF_COMPOSTO_NAO_SEPARADO: ['PDF com vários documentos', 'O PDF junta várias guias ou documentos. Separe as páginas e ponha de volta na pasta.'],
  ARQUIVO_COMPACTADO_CORROMPIDO: ['Compactado corrompido', 'O .zip/.rar não abre. Peça o arquivo de novo.'],
  FERRAMENTA_EXTRACAO_AUSENTE: ['Sem o programa para abrir', 'Falta o programa para abrir este compactado no PC (WinRAR/7-Zip).'],
  ARQUIVO_INACESSIVEL: ['Arquivo travado', 'O arquivo está aberto em outro programa ou ainda sincronizando. Feche-o; o robô tenta de novo sozinho.'],
  TIPO_XML_NAO_TRATADO: ['XML sem regra', 'Este tipo de XML ainda não tem regra. Arquive à mão.'],
  VIDEO_OU_AUDIO: ['Vídeo ou áudio', 'Vídeo e áudio ficam na pasta: não são arquivados.'],
  IDENTICO_JA_ARQUIVADO: ['Já arquivado', 'O mesmo conteúdo já está na pasta do cliente.'],
};
function motivoLegivel(motivo) { return (MOTIVOS[motivo] || [motivo ? String(motivo).toLowerCase().replace(/_/g, ' ') : 'sem motivo'])[0]; }

/** O que fazer com o NÃO IDENTIFICADO, com o que o item traz (os candidatos, a sugestão de destino). */
function sugestao(x) {
  const ev = (x.evidencias || []).join(' · ');
  const cand = /candidatos ([\d, ]+)/.exec(ev);
  if (cand) {
    const cods = cand[1].split(/[,\s]+/).filter(Boolean);
    if (cods.length >= 2) return 'Escolha entre ' + cods.slice(0, -1).join(', ') + ' e ' + cods[cods.length - 1] + ' e mova o arquivo para a pasta do certo.';
  }
  const raiz = /raiz do CNPJ de ([\d, ]+)/.exec(ev);
  if (raiz) return 'É de outro estabelecimento (matriz ou filial) de ' + raiz[1].trim() + ': cadastre o CNPJ dele ou mova à mão.';
  if (x.destinoSugerido) return 'Sugestão do robô: ' + destinoCurto(x.destinoSugerido) + '. Se estiver certa, mova para lá.';
  return (MOTIVOS[x.motivo] || [null, 'Arquive à mão e, se acontecer de novo, avise para criar a regra.'])[1];
}

/** "G:\Meu Drive\2026\380 - X\CONTÁBIL\…" → "380 - X\CONTÁBIL\…" */
function destinoCurto(p) { return String(p || '').replace(/^[A-Z]:\\Meu Drive\\\d{4}\\/i, '').replace(/^G:\\Meu Drive\\/i, ''); }

/** A evidência das regras em português de quem usa: sem as referências internas (Dicionário §, 03, 05d). */
function evidenciaLegivel(e) {
  let t = String(e || '').trim();
  t = t.replace(/^(\d\d[a-z]?\s+)?§[\d.]+\s*:\s*/i, '').replace(/^Dicionário\s*§[\d.]+\s*:\s*/i, '');
  t = t.replace(/\s*\((Dicionário|0\d[a-z]?)\b[^)]*\)/gi, '').replace(/\s*\(0\d regra \d+\)/gi, '');
  t = t.replace(/\bCNPJ\/CPF do XML e subpasta/i, 'CNPJ/CPF do XML confere com a subpasta')
    .replace(/^CNPJ\/CPF do documento$/i, 'CNPJ/CPF do documento é de um cliente só')
    .replace(/^título: (.+?) \((.+)\)$/i, 'título "$2" → tipo $1')
    .replace(/^texto por OCR \(Tesseract (\d+)%\): confiança limitada a ([\d.]+)$/i, (m, c, teto) => 'texto lido por OCR (leitura ' + c + '%): certeza limitada a ' + Math.round(+teto * 100) + '%');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = t[0].toUpperCase() + t.slice(1);
  return t.length > 160 ? t.slice(0, 159) + '…' : t;
}

/** Erro de disco, Drive ou leitura → o tipo, o título e o que fazer. */
function classificarErro(texto) {
  const t = String(texto || '');
  if (/EBUSY|being used by another process|resource busy|locked/i.test(t)) return { tipo: 'travado', titulo: 'Arquivo travado', oQueFazer: 'Feche o arquivo no programa que o abriu (ou espere o Drive terminar de sincronizar). O robô tenta de novo sozinho.' };
  if (/EPERM|EACCES|permission|operation not permitted|acesso negado/i.test(t)) return { tipo: 'permissao', titulo: 'Sem permissão', oQueFazer: 'O PC do robô não tem permissão na pasta. Confira se a pasta não é só leitura e se o Google Drive está logado na conta do escritório.' };
  if (/ENOSPC|no space/i.test(t)) return { tipo: 'espaco', titulo: 'Disco cheio', oQueFazer: 'O disco do PC do robô (ou o cache do Drive) encheu. Libere espaço.' };
  if (/corromp|invalid pdf|bad xref|xref|unexpected end|password|criptograf|FormatError|InvalidPDF/i.test(t)) return { tipo: 'corrompido', titulo: 'Arquivo corrompido', oQueFazer: 'O arquivo não abre (corrompido ou com senha). Peça de novo ao cliente.' };
  if (/OCR|tesseract|tempo esgotado|timeout/i.test(t)) return { tipo: 'ocr', titulo: 'A leitura (OCR) falhou ou demorou demais', oQueFazer: 'O PDF escaneado é grande ou ruim. Peça o PDF original; se acontecer com muitos, avise.' };
  if (/hash não confere|o original mudou/i.test(t)) return { tipo: 'conferencia', titulo: 'A cópia não conferiu', oQueFazer: 'O arquivo mudou no meio da cópia. O original ficou na pasta; o robô tenta de novo.' };
  if (/Google Drive|não está acessível|ENOENT.*Meu Drive|EIO|ENOTCONN/i.test(t)) return { tipo: 'drive', titulo: 'Google Drive fora do ar', oQueFazer: 'Abra o Google Drive no PC do robô e confira se o G: aparece. O robô espera o Drive voltar e continua sozinho.' };
  return { tipo: 'outro', titulo: 'Erro', oQueFazer: 'Se repetir, avise o administrador com o texto do erro.' };
}

/** A ação do item como o painel conta: arquivou (produção), arquivaria (simulação), jaArquivado, naoIdentificado, fica, erro. */
function acaoDoItem(x, modoRes) {
  if (x.erro) return 'erro';
  if (x.acao === 'AGUARDANDO_ORIGINAL') return 'aguardando';
  const aplicado = modoRes === 'PRODUCAO' && !x.naoAplicado;
  if (x.acao === 'ARQUIVAR') return aplicado ? 'arquivou' : 'arquivaria';
  if (x.acao === 'JA_ARQUIVADO' || x.acao === 'DESCARTAR') return 'jaArquivado';   // descarte confirmado: saiu da pasta para a quarentena
  if (x.acao === 'NAO_IDENTIFICADO') return 'naoIdentificado';
  return 'fica';
}

const corta = (t, n) => { const s = String(t == null ? '' : t); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const codigoDoCliente = x => (x.cliente != null && x.cliente !== '' ? String(x.cliente) : null);

/**
 * Um item do plano (arquivador-novo.planos) na forma que o painel guarda: o arquivo, a decisão, o destino e o porquê.
 * historico = a versão curta (menos evidências), para as partes do dia.
 */
function itemCompacto(x, modoRes, em, historico) {
  const acao = acaoDoItem(x, modoRes);
  const nome = x.nome || path.basename(String(x.rel || '').replace(/\\/g, '/'));
  const evid = [];
  for (const e of x.evidencias || []) { const t = evidenciaLegivel(e); if (t && !evid.includes(t)) evid.push(t); }
  const max = historico ? MAX_EVIDENCIAS_HISTORICO : MAX_EVIDENCIAS;
  const it = {
    id: String(x.hash || '').slice(0, 16) + '-' + Date.parse(em || 0).toString(36),
    em, nome: corta(nome, 140), rel: corta(x.rel, 260), acao,
    tipo: x.tipo || null, cliente: codigoDoCliente(x), clienteNome: x.clienteNome ? corta(x.clienteNome, 80) : null,
    confianca: typeof x.confianca === 'number' ? Math.round(x.confianca * 100) : null,
    destino: x.onde ? corta(destinoCurto(x.onde), 300) : x.destinoRelativo ? corta(x.destinoRelativo + '\\' + (x.nomeFinal || ''), 300) : null,
    nomeFinal: x.onde ? corta(path.win32.basename(x.onde), 160) : x.nomeFinal ? corta(x.nomeFinal, 160) : null,
    copias: (x.copias || []).map(c => corta(destinoCurto(c.onde || c.destinoRelativo), 300)).filter(Boolean).slice(0, 4),
    pastaNova: x.criarPastaCliente && x.pastaCliente ? corta(x.pastaCliente, 120) : null,
    evidencias: evid.slice(0, max),
    ocr: x.ocr ? { confianca: x.ocr.confianca == null ? null : Math.round(x.ocr.confianca), segundos: x.ocr.ms ? Math.round(x.ocr.ms / 1000) : null, erro: x.ocr.erro ? corta(x.ocr.erro, 120) : null } : null,
    dentroDe: x.dentroDe ? corta(path.win32.basename(x.dentroDe), 140) : null,
  };
  if (acao === 'naoIdentificado' || acao === 'fica') {
    it.motivo = x.motivo || null;
    // o hash e o caminho na pasta: o site manda de volta nos pedidos (abrir, arquivar em…, descartar; arquivador-pedidos.js)
    it.hash = x.hash || null;
    it.motivoTexto = motivoLegivel(x.motivo);
    it.sugestao = corta(sugestao(x), 260);
    if (x.destinoSugerido) it.destinoSugerido = corta(destinoCurto(x.destinoSugerido), 300);
  }
  if (acao === 'erro') { const c = classificarErro(x.erro); Object.assign(it, { erro: corta(x.erro, 300), erroTipo: c.tipo, erroTitulo: c.titulo, oQueFazer: c.oQueFazer }); }
  if (x.naoAplicado) it.naoAplicado = corta(x.naoAplicado, 120);
  return it;
}

function contagemVazia(chave) { return { chave, porAcao: { arquivou: 0, arquivaria: 0, jaArquivado: 0, naoIdentificado: 0, fica: 0, erro: 0 }, porTipo: {}, porCliente: {}, porMotivo: {}, pastasNovas: [] }; }
/** Soma um item (compacto) na contagem do dia ou do mês. */
function somar(c, it) {
  c.porAcao[it.acao] = (c.porAcao[it.acao] || 0) + 1;
  if (it.acao === 'arquivou' || it.acao === 'arquivaria') {
    const t = it.tipo || 'OUTROS';
    c.porTipo[t] = (c.porTipo[t] || 0) + 1;
    if (it.cliente) { const k = it.cliente; const a = c.porCliente[k] || (c.porCliente[k] = { nome: it.clienteNome || '', n: 0 }); a.n++; if (!a.nome && it.clienteNome) a.nome = it.clienteNome; }
    if (it.pastaNova && !c.pastasNovas.includes(it.pastaNova) && c.pastasNovas.length < 50) c.pastasNovas.push(it.pastaNova);
  }
  if ((it.acao === 'naoIdentificado' || it.acao === 'fica') && it.motivo) c.porMotivo[it.motivo] = (c.porMotivo[it.motivo] || 0) + 1;
}
/** A contagem como vai para o banco: os clientes viram a lista dos que mais receberam (e quantos são ao todo). */
function contagemPublicada(c) {
  const clientes = Object.entries(c.porCliente).map(([codigo, v]) => ({ codigo, nome: v.nome, n: v.n })).sort((a, b) => b.n - a.n || a.codigo.localeCompare(b.codigo));
  return { chave: c.chave, porAcao: c.porAcao, porTipo: c.porTipo, porMotivo: c.porMotivo, pastasNovas: c.pastasNovas, clientes: clientes.slice(0, MAX_CLIENTES), totalDeClientes: clientes.length };
}

/** Os arquivos da pasta separados pela situação: chegando (ainda mudando), na fila (prontos), sendo lidos, parados (já decididos). */
function situacaoDaPasta(v, agora) {
  const vistos = v.vistos || [];
  const lendo = new Set(v.lendo || []);
  const pendentes = new Set(v.pendentes || []);
  const aguardando = new Set(v.aguardando || []);   // eventos esperando o documento original (índice de chaves)
  const mapa = v.mapa || new Map();
  const estavelMs = v.estavelMs || 45000;
  const lista = [];
  let chegando = 0, naFila = 0, sendoLidos = 0, parados = 0, esperandoOriginal = 0;
  for (const f of vistos) {
    let s;
    if (lendo.has(f.rel)) { s = 'lendo'; sendoLidos++; }
    else if (aguardando.has(f.rel)) { s = 'original'; esperandoOriginal++; }
    else if (pendentes.has(f.rel)) { s = 'fila'; naFila++; }
    else {
      const m = mapa.get(f.rel);
      const recente = (m && agora - m.desde < estavelMs) || agora - f.mtime < estavelMs;
      if (recente) { s = 'chegando'; chegando++; } else { parados++; continue; }
    }
    lista.push({ rel: f.rel, tam: f.tam, desde: new Date(Math.min(f.mtime || agora, agora)).toISOString(), situacao: s });
  }
  const ordem = { lendo: 0, chegando: 1, fila: 2, original: 3 };
  lista.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.desde.localeCompare(b.desde));
  return {
    naPasta: vistos.length, chegando, naFila, sendoLidos, parados, esperandoOriginal,
    lista: lista.slice(0, MAX_CHEGANDO).map(x => ({ nome: corta(path.win32.basename(x.rel), 140), rel: corta(x.rel, 260), tam: x.tam, desde: x.desde, situacao: x.situacao })),
  };
}

/** Quantas decisões por minuto nos últimos 10 min (as marcas de tempo das decisões). */
function ritmo(marcas, agora) {
  const recentes = marcas.filter(t => agora - t <= JANELA_RITMO_MS);
  if (recentes.length < 2) return 0;
  const desde = Math.max(Math.min(...recentes), agora - JANELA_RITMO_MS);
  const min = Math.max(1, (agora - desde) / 60000);
  return Math.round((recentes.length / min) * 10) / 10;
}

/**
 * A passada: começa quando aparece fila depois de a pasta estar em dia e termina quando a fila zera. total = os já feitos
 * nela + os que ainda faltam (a pasta pode crescer no meio). Devolve a passada nova (ou a mesma).
 */
function avancarPassada(p, faltam, agora) {
  const iso = new Date(agora).toISOString();
  if (!p || p.fim) {
    if (faltam > 0) return { inicio: iso, feitos: 0, total: faltam, fim: null };
    return p || null;
  }
  const q = Object.assign({}, p, { total: p.feitos + faltam });
  if (faltam === 0) q.fim = iso;
  return q;
}

/** Os alertas de agora (o que a página põe no topo, com o que fazer). */
function alertas(estado, agora) {
  const out = [];
  if (estado.situacao === 'sem-drive') out.push({ tipo: 'drive', tom: 'erro', titulo: 'O Google Drive (G:) está fora do ar', texto: 'O robô parou de ler a pasta Claudio Secretario e espera o Drive voltar.', oQueFazer: 'Abra o Google Drive no PC do robô e confira se o G: aparece.' });
  if (estado.situacao === 'esperando' && estado.esperando) out.push({ tipo: 'esperando', tom: 'aviso', titulo: 'Esperando para continuar', texto: estado.esperando.charAt(0).toUpperCase() + estado.esperando.slice(1) + '.', oQueFazer: 'Nada: ele continua sozinho quando a outra execução terminar.' });
  if (estado.erroDoCiclo && agora - Date.parse(estado.erroDoCiclo.em) < 30 * 60000) out.push({ tipo: 'ciclo', tom: 'erro', titulo: 'A última volta do arquivador deu erro', texto: estado.erroDoCiclo.texto, oQueFazer: classificarErro(estado.erroDoCiclo.texto).oQueFazer });
  const lentos = (estado.ultimos || []).filter(x => x.ocr && x.ocr.segundos != null && x.ocr.segundos >= 60 && agora - Date.parse(x.em) < 3600e3).length;
  if (lentos) out.push({ tipo: 'ocr', tom: 'aviso', titulo: lentos === 1 ? 'Um PDF escaneado demorou mais de 1 minuto para ler' : lentos + ' PDFs escaneados demoraram mais de 1 minuto para ler', texto: 'A leitura por OCR é lenta nos escaneados grandes.', oQueFazer: 'Se a fila crescer, peça os PDFs originais em vez dos escaneados.' });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// o acompanhamento (com estado)
// ---------------------------------------------------------------------------------------------------------------------
const hojeLocal = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/**
 * opcoes: { db, controle (a pasta continuo\), origem, log, agora?: () => ms, freioMs? }.
 * Devolve as entradas que o contínuo chama: situacao, varredura, lendo, decisoes, erro, config, ladoALado, parar.
 */
function criar(opcoes) {
  const o = Object.assign({ log: () => {}, agora: () => Date.now(), freioMs: FREIO_MS }, opcoes);
  const arqEstado = path.join(o.controle, 'acompanhamento.json');
  const arqDia = dia => path.join(o.controle, 'arquivados-' + dia + '.jsonl');
  let st = (() => { try { return JSON.parse(fs.readFileSync(arqEstado, 'utf8')); } catch (e) { return null; } })() || {};
  st = Object.assign({ ultimos: [], pendentes: [], erros: [], marcas: [], passada: null, situacao: 'ok', esperando: null, erroDoCiclo: null, pasta: null, config: null, ladoALado: null, hoje: null, mes: null }, st);
  const agora0 = o.agora();
  if (!st.hoje || st.hoje.chave !== hojeLocal(agora0)) st.hoje = contagemVazia(hojeLocal(agora0));
  if (!st.mes || st.mes.chave !== hojeLocal(agora0).slice(0, 7)) st.mes = contagemVazia(hojeLocal(agora0).slice(0, 7));
  // o histórico do dia (as partes): relido do arquivo do PC ao ligar
  let dia = { chave: st.hoje.chave, partes: [[]], sujas: new Set() };
  function carregarDia(chave) {
    dia = { chave, partes: [[]], sujas: new Set() };
    try {
      let tam = 0;
      for (const l of fs.readFileSync(arqDia(chave), 'utf8').split('\n')) {
        if (!l.trim()) continue;
        if (tam + l.length > BYTES_POR_PARTE) { dia.partes.push([]); tam = 0; }
        dia.partes[dia.partes.length - 1].push(JSON.parse(l)); tam += l.length;
      }
    } catch (e) { /* dia novo */ }
    dia.tam = dia.partes[dia.partes.length - 1].reduce((s, x) => s + JSON.stringify(x).length, 0);
  }
  carregarDia(st.hoje.chave);

  let ultimaGravacao = 0, timer = null, avisouErro = false, parado = false, limpar = true;
  const assinatura = () => JSON.stringify([st.pasta && [st.pasta.naPasta, st.pasta.chegando, st.pasta.naFila, st.pasta.sendoLidos, st.pasta.lista.map(x => x.rel + x.situacao)], st.passada]);
  const seguro = (nome, f) => (...a) => { try { if (!parado) f(...a); } catch (e) { o.log('acompanhamento (' + nome + '):', e.message); } };

  function virarDia(t) {
    const h = hojeLocal(t);
    if (st.hoje.chave !== h) { st.hoje = contagemVazia(h); carregarDia(h); limpar = true; }
    if (st.mes.chave !== h.slice(0, 7)) st.mes = contagemVazia(h.slice(0, 7));
  }

  function montar() {
    const t = o.agora();
    return {
      em: new Date(t).toISOString(), maquina: os.hostname(),
      modo: st.config ? st.config.modo : null,
      config: st.config,
      situacao: st.situacao, esperando: st.esperando,
      pasta: st.pasta,
      passada: st.passada,
      ritmo: ritmo(st.marcas, t),
      hoje: contagemPublicada(st.hoje),
      mes: contagemPublicada(st.mes),
      ultimos: st.ultimos,
      pendentes: st.pendentes,
      pendentesTotal: st.pendentesTotal == null ? st.pendentes.length : st.pendentesTotal,
      erros: st.erros,
      alertas: alertas(st, t),
      ladoALado: st.ladoALado,
      historico: { dia: dia.chave, partes: dia.partes.length, itens: dia.partes.reduce((s, p) => s + p.length, 0) },
    };
  }

  async function gravar() {
    timer = null;
    ultimaGravacao = o.agora();
    const painel = montar();
    try { fs.writeFileSync(arqEstado + '.tmp', JSON.stringify(Object.assign({}, st, { marcas: st.marcas.slice(-400) }))); fs.renameSync(arqEstado + '.tmp', arqEstado); } catch (e) { o.log('acompanhamento: não gravei o estado:', e.message); }
    if (!o.db) return;
    try {
      const ref = o.db.collection('robo').doc('arquivadorNovo');
      await ref.set({ painel }, { mergeFields: ['painel'] });
      for (const n of [...dia.sujas]) {
        await ref.collection('dias').doc(dia.chave + '-' + n).set({ dia: dia.chave, parte: n, em: painel.em, itens: dia.partes[n] || [] });
        dia.sujas.delete(n);
      }
      avisouErro = false;
    } catch (e) { if (!avisouErro) { o.log('acompanhamento: não publiquei:', e.message); avisouErro = true; } }
    if (limpar) { limpar = false; await limparAntigos(); }
  }
  /** O histórico de mais de DIAS_GUARDADOS dias: as partes no banco (até 50 por vez) e os arquivos do PC. */
  async function limparAntigos() {
    const limite = hojeLocal(o.agora() - DIAS_GUARDADOS * 864e5);
    try { for (const f of fs.readdirSync(o.controle)) { const m = /^arquivados-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(f); if (m && m[1] < limite) fs.unlinkSync(path.join(o.controle, f)); } } catch (e) { /* segue */ }
    try {
      const col = o.db && o.db.collection('robo').doc('arquivadorNovo').collection('dias');
      if (!col || typeof col.where !== 'function') return;
      const snap = await col.where('dia', '<', limite).limit(50).get();
      for (const d of snap.docs) await d.ref.delete();
    } catch (e) { o.log('acompanhamento: não limpei o histórico antigo:', e.message); }
  }
  /** O freio: no máximo uma gravação a cada freioMs (a mudança no meio espera a próxima). */
  function publicar(jaJa) {
    if (timer || parado) return;
    const espera = jaJa ? 0 : Math.max(0, ultimaGravacao + o.freioMs - o.agora());
    timer = setTimeout(() => { void gravar(); }, espera);
    if (timer.unref) timer.unref();
  }

  return {
    /** ok | sem-drive | esperando (com o motivo) */
    situacao: seguro('situacao', (s, motivo) => {
      const antes = st.situacao + '|' + st.esperando;
      st.situacao = s; st.esperando = s === 'esperando' ? String(motivo || '') : null;
      if (antes !== st.situacao + '|' + st.esperando) publicar();
    }),
    /** o config em vigor (o modo, os tipos em produção, mover os não identificados) */
    config: seguro('config', (cfg) => {
      const c = { modo: cfg.modo, emProducao: !!cfg.emProducao || (cfg.modo === 'producao' && (cfg.tiposProducao || []).length > 0), tiposProducao: (cfg.tiposProducao || []).slice(0, 30), moverNaoIdentificados: !!cfg.moverNaoIdentificados, botaoRotinaAntiga: !!cfg.botaoRotinaAntiga, intervaloMs: cfg.intervaloMs || null, estavelMs: cfg.estavelMs || null, lote: cfg.lote || null };
      if (JSON.stringify(c) !== JSON.stringify(st.config)) { st.config = c; publicar(); }
    }),
    /** a varredura da pasta: { vistos: [{rel,tam,mtime}], mapa, pendentes: [rel], estavelMs } */
    varredura: seguro('varredura', (v) => {
      const t = o.agora();
      virarDia(t);
      const antes = assinatura();
      st.pasta = situacaoDaPasta(Object.assign({ lendo: st.lendoAgora || [] }, v), t);
      st.passada = avancarPassada(st.passada, (v.pendentes || []).length, t);
      // a varredura roda a cada minuto: só grava quando a pasta mudou, ou a cada BATIMENTO_MS (o sinal de vida da página)
      if (assinatura() !== antes || t - ultimaGravacao >= BATIMENTO_MS) publicar();
    }),
    /** o lote que começou agora (os arquivos "sendo lidos") */
    lendo: seguro('lendo', (lote) => {
      st.lendoAgora = (lote || []).slice(0, 50);
      if (st.pasta) {
        const set = new Set(st.lendoAgora);
        for (const x of st.pasta.lista) if (set.has(x.rel)) x.situacao = 'lendo';
        st.pasta.sendoLidos = st.lendoAgora.length;
      }
      publicar();
    }),
    /** as decisões de um lote: os itens de arquivador-novo.planos(res) (sem os CONTEINER) e o modo da execução */
    decisoes: seguro('decisoes', (itens, modoRes) => {
      const t = o.agora();
      virarDia(t);
      const em = new Date(t).toISOString();
      st.lendoAgora = [];
      const linhas = [];
      for (const x of itens || []) {
        if (!x || x.acao === 'CONTEINER' || x.acao === 'AGUARDANDO_ORIGINAL') continue;   // o que espera o original aparece na pasta (Chegando), não no resultado
        const it = itemCompacto(x, modoRes, em, false);
        somar(st.hoje, it); somar(st.mes, it);
        st.marcas.push(t);
        if (st.passada && !st.passada.fim) st.passada.feitos++;
        if (it.acao === 'erro') st.erros.unshift(it);
        else if (it.acao === 'naoIdentificado' || it.acao === 'fica') st.pendentes.unshift(it);
        else st.ultimos.unshift(it);
        const h = itemCompacto(x, modoRes, em, true);
        linhas.push(JSON.stringify(h));
        const s = linhas[linhas.length - 1].length;
        if (dia.tam + s > BYTES_POR_PARTE && dia.partes[dia.partes.length - 1].length) { dia.partes.push([]); dia.tam = 0; }
        dia.partes[dia.partes.length - 1].push(h); dia.tam += s;
        dia.sujas.add(dia.partes.length - 1);
      }
      st.ultimos = st.ultimos.slice(0, MAX_ULTIMOS);
      st.pendentes = st.pendentes.slice(0, MAX_PENDENTES);
      st.erros = st.erros.slice(0, MAX_ERROS);
      st.marcas = st.marcas.filter(m => t - m <= JANELA_RITMO_MS).slice(-2000);
      if (linhas.length) { try { fs.appendFileSync(arqDia(dia.chave), linhas.join('\n') + '\n'); } catch (e) { o.log('acompanhamento: não gravei o histórico do dia:', e.message); } }
      publicar();
    }),
    /** um erro da volta inteira (não de um arquivo) */
    erro: seguro('erro', (texto) => {
      const t = o.agora();
      st.erroDoCiclo = { em: new Date(t).toISOString(), texto: corta(texto, 300) };
      const c = classificarErro(texto);
      st.erros.unshift({ id: 'ciclo-' + t.toString(36), em: st.erroDoCiclo.em, nome: '(a volta do arquivador)', acao: 'erro', erro: st.erroDoCiclo.texto, erroTipo: c.tipo, erroTitulo: c.titulo, oQueFazer: c.oQueFazer, evidencias: [] });
      st.erros = st.erros.slice(0, MAX_ERROS);
      publicar();
    }),
    /** o relatório lado a lado do dia (compararDia) */
    /**
     * A lista "Para resolver" de verdade (23/10/2026: a lista guardava os 80 últimos não identificados, e os
     * reprocessamentos tiravam a maioria da pasta). itens = [{ rel, nome, motivo, confianca, cliente, chave, em, hash }]
     * do que está hoje em NÃO IDENTIFICADOS; o "fica" (na origem) continua enquanto o arquivo estiver lá (existe(rel)).
     */
    naoIdentificados: seguro('naoIdentificados', (itens, existe, aoContar) => {
      const daPasta = (itens || []).map(x => Object.assign(itemCompacto(Object.assign({ acao: 'NAO_IDENTIFICADO' }, x), 'PRODUCAO', x.em || new Date(o.agora()).toISOString(), false), { naPasta: x.naPasta || null }));
      const ficam = st.pendentes.filter(p => p.acao === 'fica' && (!existe || existe(p.rel)));
      const todos = daPasta.concat(ficam).sort((a, b) => String(b.em).localeCompare(String(a.em)));
      const antes = JSON.stringify([st.pendentesTotal, st.pendentes.map(p => p.id)]);
      st.pendentes = todos.slice(0, MAX_PENDENTES);
      st.pendentesTotal = todos.length;
      if (antes !== JSON.stringify([st.pendentesTotal, st.pendentes.map(p => p.id)])) publicar();
      if (aoContar) aoContar(st.pendentesTotal);
    }),
    ladoALado: seguro('ladoALado', (r) => { st.ladoALado = Object.assign({}, r, { exemplos: (r.exemplos || []).slice(0, 20) }); publicar(); }),
    /** grava o que falta agora (ao desligar) */
    parar: async () => { try { if (timer) { clearTimeout(timer); timer = null; } await gravar(); } catch (e) { /* desligando */ } parado = true; },
    /** para os testes */
    _montar: montar, _gravar: gravar, _estado: () => st, _dia: () => dia,
  };
}

module.exports = { criar, MOTIVOS, motivoLegivel, sugestao, evidenciaLegivel, classificarErro, acaoDoItem, itemCompacto, contagemVazia, somar, contagemPublicada, situacaoDaPasta, ritmo, avancarPassada, alertas, destinoCurto, FREIO_MS };
