// As regras puras da Área do Cliente no robô (16/10/2026): o PORTE, com os mesmos nomes de função e de campo, das
// projeções do core (packages/core/src/areaCliente: guias.ts, chamados.ts, envios.ts, vencimentos.ts, agenda.ts) e do
// pedaço de tarefas/regras/execucao.ts que a agenda usa (etapaNoMes).
//
// Por que um porte e não o core: o robô é CommonJS sem TypeScript. O Node 24 até carrega os .ts do core que não importam
// nada (guias, chamados, envios, vencimentos), mas agenda.ts importa '../tarefas/regras/execucao' sem extensão, que puxa
// a lista de empresas, a planilha do DP e as rotinas — e isso o Node não resolve. Para não depender disso em produção,
// a lógica está aqui; o teste (teste-area-cliente.js) carrega o core de verdade e compara, para o porte não se afastar.
//
// Os DADOS não são copiados: a lista de empresas (regime) e a planilha do DP (obrigações) são lidas dos arquivos do core
// (lerListaDoCore, lerDpDoCore). O robô roda dentro do repositório (robo/ ao lado de packages/).
const crypto = require('crypto');

const dois = n => String(n).padStart(2, '0');
const texto = v => (typeof v === 'string' ? v : '');

// =====================================================================================================================
// guias.ts
// =====================================================================================================================

/** "1.917,42" ou "917,42" → 1917.42; NaN quando não é um valor. */
function valorEmReais(t) {
  const limpo = String(t ?? '').replace(/[^\d,.-]/g, '');
  if (!limpo) return NaN;
  return Number(limpo.replace(/\./g, '').replace(',', '.'));
}

/** 'dd/mm/aaaa' → Date (meia-noite local); null se não for uma data. */
function dataDoVencimento(vencimento) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(vencimento);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
}

/** A situação pela data: antes do vencimento "a vencer", no dia "vence hoje", depois "vencida". */
function situacaoDaGuia(vencimento, hoje) {
  const v = dataDoVencimento(vencimento);
  if (!v) return 'a vencer';
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return v.getTime() > h ? 'a vencer' : v.getTime() === h ? 'vence hoje' : 'vencida';
}

/** A guia do FGTS pronta tem aviso: espera o "Liberar" do escritório antes de aparecer para o cliente. */
function guiaPrecisaLiberar(p) {
  return p.status === 'pronto' && p.modo === 'emitir' && !!String(p.aviso ?? '').trim();
}

/** A guia do FGTS que o cliente vê (lista branca). Ensaio nunca sai; com aviso, só liberada. */
function guiaDoFgts(pedido, hoje, liberada = false) {
  if (pedido.status !== 'pronto' || pedido.modo !== 'emitir') return null;
  if (guiaPrecisaLiberar(pedido) && !liberada) return null;
  const valor = valorEmReais(pedido.valor);
  if (!Number.isFinite(valor) || !dataDoVencimento(pedido.vencimento) || !/^\d{4}-\d{2}$/.test(pedido.competencia)) return null;
  const numero = String(pedido.numeroGuia ?? '').trim();
  return {
    id: pedido.id,
    tipo: 'FGTS',
    competencia: pedido.competencia,
    vencimento: pedido.vencimento,
    valor,
    ...(numero ? { numero } : {}),
    situacao: situacaoDaGuia(pedido.vencimento, hoje),
    temPdf: !!String(pedido.pdfNome ?? '').trim(),
  };
}

// =====================================================================================================================
// chamados.ts
// =====================================================================================================================

const TIPOS_DE_CHAMADO = [
  { valor: 'admissao', rotulo: 'Contratar um funcionário', dica: 'Admissão' },
  { valor: 'ferias', rotulo: 'Férias', dica: 'Marcar ou tirar uma dúvida sobre férias' },
  { valor: 'demissao', rotulo: 'Desligar um funcionário', dica: 'Demissão' },
  { valor: 'duvida', rotulo: 'Tirar uma dúvida', dica: 'Qualquer pergunta para o escritório' },
  { valor: 'documento', rotulo: 'Pedir um documento', dica: 'Certidão, declaração, segunda via…' },
  { valor: 'outro', rotulo: 'Outro assunto', dica: 'O que não se encaixa nos outros' },
];
const TIPOS_CH = new Set(TIPOS_DE_CHAMADO.map(t => t.valor));
const SITUACOES_CH = new Set(['aberto', 'em andamento', 'respondido', 'concluido']);
const MAIOR_TEXTO_DO_CHAMADO = 4000;

/** O chamado que o cliente vê: lista branca; o autor do escritório vira "Escritório"; nota interna não sai. */
function chamadoDoCliente(c) {
  return {
    id: c.id,
    tipo: TIPOS_CH.has(c.tipo) ? c.tipo : 'outro',
    titulo: c.titulo,
    situacao: SITUACOES_CH.has(c.situacao) ? c.situacao : 'aberto',
    mensagens: c.mensagens.filter(m => !m.interna).map(m => {
      const doCliente = m.de === 'cliente';
      return { de: doCliente ? 'cliente' : 'escritorio', autor: doCliente ? 'Você' : 'Escritório', texto: m.texto, em: m.em };
    }),
  };
}

/** Confere o que o cliente digitou ao abrir um chamado; devolve o erro em português, ou '' se está bom. */
function erroDoNovoChamado(tipo, t) {
  if (!TIPOS_CH.has(tipo)) return 'Escolha o assunto.';
  if (!t.trim()) return 'Conte o que você precisa.';
  if (t.length > MAIOR_TEXTO_DO_CHAMADO) return 'O texto está muito grande. Resuma um pouco.';
  return '';
}

/** O título do chamado: a primeira linha do texto, curta. */
function tituloDoChamado(tipo, t) {
  const linha = t.trim().split(/\r?\n/)[0] || '';
  const base = (TIPOS_DE_CHAMADO.find(x => x.valor === tipo) || {}).rotulo || 'Chamado';
  return linha ? (linha.length > 60 ? linha.slice(0, 57).trimEnd() + '…' : linha) : base;
}

/** O cliente pode responder enquanto o chamado não foi concluído. */
function chamadoAceitaResposta(c) {
  return c.situacao !== 'concluido';
}

// =====================================================================================================================
// envios.ts
// =====================================================================================================================

const TIPOS_DE_ENVIO = [
  { valor: 'extrato', rotulo: 'Extrato do banco' },
  { valor: 'nota', rotulo: 'Nota fiscal' },
  { valor: 'comprovante', rotulo: 'Comprovante' },
  { valor: 'outro', rotulo: 'Outro documento' },
];
const TIPOS_EN = new Set(TIPOS_DE_ENVIO.map(t => t.valor));
const EXTENSOES_ACEITAS = ['pdf', 'jpg', 'jpeg', 'png', 'xml', 'zip'];
/** 700 KB (716800 bytes): o mesmo teto das regras do banco para areaClienteEnvios.tamanho */
const MAIOR_ENVIO = 700 * 1024;
const LIMITE_DO_ENVIO = '700 KB';
const MIME_DO_ENVIO = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', xml: 'application/xml', zip: 'application/zip' };

/** O mime pela extensão do nome; '' quando a extensão não é aceita. */
function mimeDoEnvio(nome) {
  return MIME_DO_ENVIO[(nome.split('.').pop() || '').toLowerCase()] ?? '';
}

/** Confere um arquivo; devolve o erro em português, ou '' se está bom. */
function erroDoEnvio(arquivo) {
  const ext = (arquivo.nome.split('.').pop() || '').toLowerCase();
  if (!EXTENSOES_ACEITAS.includes(ext)) return arquivo.nome + ': só aceitamos PDF, JPG, PNG, XML e ZIP.';
  if (arquivo.tamanho <= 0) return arquivo.nome + ': o arquivo está vazio.';
  if (arquivo.tamanho > MAIOR_ENVIO) return arquivo.nome + ': passa de ' + LIMITE_DO_ENVIO + '. Mande um arquivo menor.';
  return '';
}

/** O recibo que o cliente vê: lista branca de campos. */
function reciboDoEnvio(e) {
  return { id: e.id, nome: e.nome, tipo: TIPOS_EN.has(e.tipo) ? e.tipo : 'outro', tamanho: e.tamanho, recebidoEm: e.recebidoEm };
}

// =====================================================================================================================
// vencimentos.ts (a tabela A CONFERIR pelo escritório: mude no core e aqui; o teste confere que estão iguais)
// =====================================================================================================================

const VENCIMENTOS = [
  { id: 'das', etapa: 'fiscal-simples', nome: 'DAS do Simples Nacional', dia: 20, mesesDepois: 1, ajuste: 'antecipa', conferir: 'DAS: o escritório antecipa; a regra oficial prorroga para o dia útil seguinte' },
  { id: 'das-mei', etapa: 'fiscal-mei', nome: 'DAS do MEI', dia: 20, mesesDepois: 1, ajuste: 'antecipa', conferir: 'PRECISA CONFERIR: o DAS-MEI não estava na lista do Vitor; mesma regra do DAS' },
  { id: 'icms', etapa: 'fiscal-icms', nome: 'ICMS (imposto estadual)', dia: 9, mesesDepois: 1, ajuste: 'posterga', conferir: 'PRECISA CONFERIR: dia 9 e o que fazer no fim de semana (aqui: posterga)' },
  { id: 'iss', etapa: 'fiscal-iss', nome: 'ISS (imposto da prefeitura)', dia: 10, mesesDepois: 1, ajuste: 'posterga', conferir: 'PRECISA CONFERIR: dia 10 e o fim de semana variam por município' },
  { id: 'pis-cofins', etapa: 'fiscal-piscofins', nome: 'PIS e COFINS', dia: 25, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'pis-cofins', etapa: 'fiscal-piscofins-real', nome: 'PIS e COFINS', dia: 25, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'irpj-csll', etapa: 'fiscal-irpj-csll', nome: 'IRPJ e CSLL do trimestre', dia: 'ultimo-util', mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'irpj-csll-estimativa', etapa: 'fiscal-irpj-csll-real', nome: 'IRPJ e CSLL (estimativa do mês)', dia: 'ultimo-util', mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'esocial', etapa: 'dp-s1299', nome: 'Fechamento da folha no eSocial', dia: 15, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'dctfweb', etapa: 'dp-dctfweb', nome: 'DCTFWeb (declaração da folha)', dia: 15, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'darf-inss', etapa: 'dp-darf', nome: 'DARF do INSS da folha', dia: 20, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'fgts', etapa: 'dp-fgts', nome: 'FGTS', dia: 20, mesesDepois: 1, ajuste: 'antecipa' },
];
const POR_ETAPA = new Map(VENCIMENTOS.map(v => [v.etapa, v]));

function vencimentoDaEtapa(etapa) { return POR_ETAPA.get(etapa) ?? null; }
const fimDeSemana = d => d.getDay() === 0 || d.getDay() === 6;
function isoDaData(d) { return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }
function diaUtilAnterior(d) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (fimDeSemana(r)) r.setDate(r.getDate() - 1);
  return r;
}
function proximoDiaUtil(d) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (fimDeSemana(r)) r.setDate(r.getDate() + 1);
  return r;
}
function ultimoDiaUtilDoMes(ano, mes) { return diaUtilAnterior(new Date(ano, mes, 0)); }

/** O vencimento de uma linha da tabela para uma competência 'aaaa-mm', em 'aaaa-mm-dd'; null se a competência for inválida. */
function vencimentoNaCompetencia(v, competencia) {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return null;
  const mes0 = Number(m[2]) - 1 + v.mesesDepois;
  const ano = Number(m[1]) + Math.floor(mes0 / 12);
  const mes = (mes0 % 12) + 1;
  if (Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  if (v.dia === 'ultimo-util') return isoDaData(ultimoDiaUtilDoMes(ano, mes));
  const data = new Date(ano, mes - 1, v.dia);
  return isoDaData(v.ajuste === 'antecipa' ? diaUtilAnterior(data) : proximoDiaUtil(data));
}
function vencimentoDaEtapaNoMes(etapa, competencia) {
  const v = vencimentoDaEtapa(etapa);
  return v ? vencimentoNaCompetencia(v, competencia) : null;
}

// =====================================================================================================================
// tarefas/regras/execucao.ts (etapaNoMes) e as restrições das etapas da agenda (tarefas/rotinas/fiscal.ts e dp.ts)
// =====================================================================================================================

/** As etapas das rotinas que estão na tabela de vencimentos, com as restrições copiadas das rotinas (o teste confere). */
const ROTINAS_DA_AGENDA = {
  fiscal: {
    departamento: 'fiscal',
    etapas: [
      { id: 'fiscal-simples', regimes: ['Simples'] },
      { id: 'fiscal-icms', regimes: ['Presumido', 'Real'] },
      { id: 'fiscal-iss', regimes: ['Presumido', 'Real'] },
      { id: 'fiscal-piscofins', regimes: ['Presumido'] },
      { id: 'fiscal-piscofins-real', regimes: ['Real'] },
      { id: 'fiscal-irpj-csll', regimes: ['Presumido'], meses: [3, 6, 9, 12] },
      { id: 'fiscal-irpj-csll-real', regimes: ['Real'] },
      { id: 'fiscal-mei', regimes: ['MEI'] },
    ],
  },
  dp: {
    departamento: 'dp',
    etapas: [
      { id: 'dp-s1299', obrigacaoDp: 's1299' },
      { id: 'dp-dctfweb', obrigacaoDp: 'dctfweb' },
      { id: 'dp-darf', obrigacaoDp: 'darf' },
      { id: 'dp-fgts', obrigacaoDp: 'fgts' },
    ],
  },
};
const RESTRITAS = new Map([...ROTINAS_DA_AGENDA.fiscal.etapas, ...ROTINAS_DA_AGENDA.dp.etapas].map(e => [e.id, e]));

/** A etapa existe nesta competência pelo mês do ano (Etapa.meses)? */
function etapaNoMesDoAno(etapa, competencia) {
  const mes = Number(competencia.slice(5, 7));
  return !etapa.meses || !mes || etapa.meses.includes(mes);
}

/**
 * A etapa faz parte da rotina deste mês? Igual ao core, só que o regime e o cliente do DP chegam pelo `contexto`
 * ({ regime, dp: { obrigacoes, reinfAutorizada } | null }) em vez das listas globais do core. Regime desconhecido: entra;
 * fora da planilha do DP: entra (como no core).
 */
function etapaNoMes(ex, etapa, contexto) {
  if (ex && Array.isArray(ex.retiradas) && ex.retiradas.includes(etapa)) return false;
  const e = RESTRITAS.get(etapa);
  if (e && ex) {
    const regime = (contexto && contexto.regime) || '';
    if (e.regimes && regime && !e.regimes.includes(regime)) return false;
    if (!etapaNoMesDoAno(e, ex.competencia)) return false;
    const dp = e.obrigacaoDp ? (contexto && contexto.dp) || null : null;
    if (dp && e.obrigacaoDp === 'envio' && !dp.obrigacoes.length) return false;
    if (dp && e.obrigacaoDp === 'reinf' && !dp.reinfAutorizada) return false;
    if (dp && e.obrigacaoDp && e.obrigacaoDp !== 'envio' && e.obrigacaoDp !== 'reinf' && !dp.obrigacoes.includes(e.obrigacaoDp)) return false;
  }
  return true;
}

function execucaoNova(empresa, codigo, competencia, departamento) {
  return { empresa, codigo, competencia, departamento, etapas: {} };
}

// =====================================================================================================================
// agenda.ts
// =====================================================================================================================

/**
 * A agenda de UMA rotina numa competência (só as etapas da tabela de vencimentos). 'feita' → feito; 'dispensada' → não
 * se aplica; o resto → a fazer. Daqui não sai id de etapa, quem fez, observação nem objeção.
 */
function agendaDaExecucao(execucao, rotina, empresa, competencia, contexto) {
  const ex = execucao ?? execucaoNova(empresa.nome, empresa.codigo, competencia, rotina.departamento);
  const itens = [];
  for (const etapa of rotina.etapas) {
    const linha = vencimentoDaEtapa(etapa.id);
    if (!linha || !etapaNoMes(ex, etapa.id, contexto)) continue;
    const vence = vencimentoNaCompetencia(linha, competencia);
    if (!vence) continue;
    const estado = (ex.etapas || {})[etapa.id];
    const situacao = estado?.situacao === 'feita' ? 'feito' : estado?.situacao === 'dispensada' ? 'nao se aplica' : 'a fazer';
    itens.push({ id: linha.id, nome: linha.nome, vence, situacao, ...(situacao === 'feito' && estado?.em ? { feitoEm: estado.em } : {}) });
  }
  return itens;
}

/** A competência que vence no mês: 'aaaa-mm' do mês anterior. */
function competenciaDoMesDeVencimento(mes) {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  const d = new Date(Number(m[1]), Number(m[2]) - 2, 1);
  return d.getFullYear() + '-' + dois(d.getMonth() + 1);
}

/** Junta as agendas num mês só: a mais próxima primeiro. */
function agendaDoMes(mes, ...listas) {
  const itens = listas.flat().sort((a, b) => a.vence.localeCompare(b.vence) || a.nome.localeCompare(b.nome));
  return { mes, itens };
}

// =====================================================================================================================
// O que é só do robô (não existe no core): o link, as caixas de entrada, o espelho
// =====================================================================================================================

const tokenValido = t => typeof t === 'string' && /^[0-9a-f]{40}$/.test(t);
const LIMITE_CHAMADOS_POR_DIA = 20;
const LIMITE_ENVIOS_POR_DIA = 50;
const PEDACO_PDF = 700 * 1024;
const REGIMES = ['Simples', 'MEI', 'Presumido', 'Real', 'Isentas', 'Física', 'Domésticas'];
const OBRIGACOES_DP = ['recibos', 'folha', 's1200', 's1210', 's1299', 'dctfweb', 'darf', 'fgts', 'econsignado'];

/** O instante do banco como ISO (Timestamp do Firestore, Date ou o texto gravado). */
function instante(v) {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
  return '';
}

/** 'aaaa-mm' de uma data e o mês anterior / seguinte. */
const competenciaDe = d => d.getFullYear() + '-' + dois(d.getMonth() + 1);
function mesesDepois(comp, n) {
  const [a, m] = comp.split('-').map(Number);
  return competenciaDe(new Date(a, m - 1 + n, 1));
}
/** A agenda olha a competência atual e a anterior (a anterior é a que vence neste mês). */
function competenciasDaAgenda(hoje) {
  const atual = competenciaDe(hoje);
  return [mesesDepois(atual, -1), atual];
}

/** O slug do core (formatos.slug): o id do cadastro do nads. */
function slug(nome) {
  return String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'empresa';
}

// ---------- os dados do core, lidos do arquivo (sem copiar) ----------

/** empresas/lista.ts → Map(código → { nome, regime }). */
function lerListaDoCore(conteudo) {
  const m = new Map();
  const re = /\{\s*codigo:\s*(\d+),\s*nome:\s*("(?:[^"\\]|\\.)*"),\s*regime:\s*("(?:[^"\\]|\\.)*")\s*\}/g;
  let x;
  while ((x = re.exec(conteudo))) m.set(Number(x[1]), { nome: JSON.parse(x[2]), regime: JSON.parse(x[3]) });
  return m;
}

/** empresas/dp.ts (as LINHAS da planilha do DP) → Map(código → { obrigacoes, reinfAutorizada }). */
function lerDpDoCore(conteudo) {
  const m = new Map();
  const ini = conteudo.indexOf('const LINHAS');
  if (ini < 0) return m;
  const fim = conteudo.indexOf('\n];', ini);
  for (const linha of conteudo.slice(ini, fim < 0 ? undefined : fim).split('\n')) {
    const t = linha.trim().replace(/,$/, '');
    if (!/^\[\d+,/.test(t)) continue;
    let l;
    try { l = JSON.parse(t); } catch (e) { continue; }
    const bits = String(l[6] || '');
    m.set(Number(l[0]), { obrigacoes: OBRIGACOES_DP.filter((_, i) => bits[i] === '1'), reinfAutorizada: l[5] === 1 });
  }
  return m;
}

/**
 * O regime que vale (o mesmo caminho do nads, tarefas/dados/fonte.ts): o do cadastro do nads; sem ele, o do Entregas
 * (o enquadramento; sem ele, a Receita quando diz Simples ou MEI); sem ele, o da lista do escritório. '' = não se sabe.
 */
function regimeQueVale({ cadastro, entregas, lista }) {
  const doCadastro = cadastro ? texto(cadastro.regime) || texto(cadastro.nova && cadastro.nova.regime) : '';
  if (REGIMES.includes(doCadastro)) return doCadastro;
  if (entregas) {
    const e = texto(entregas.enquadramento);
    if (REGIMES.includes(e)) return e;
    const r = entregas.receita && typeof entregas.receita === 'object' ? entregas.receita : null;
    if (r && r.mei === true) return 'MEI';
    if (r && r.simples === true) return 'Simples';
  }
  return lista ? texto(lista.regime) : '';
}

// ---------- o resumo ----------

/** O resumo do link (lista branca): as empresas, o contato do escritório e a hora. */
function resumoDoCliente(empresas, escritorio, atualizadoEm) {
  const contato = {};
  for (const k of ['telefone', 'email', 'whatsapp']) if (texto(escritorio && escritorio[k]).trim()) contato[k] = escritorio[k].trim();
  return {
    empresas: empresas.map(e => ({ codigo: Number(e.codigo), nome: String(e.nome || ''), cnpj: String(e.cnpj || '').replace(/\D/g, '') })),
    escritorio: contato,
    atualizadoEm,
  };
}

// ---------- as guias do FGTS do link ----------

/**
 * As guias do FGTS que o link mostra: dos pedidos prontos e de emitir das empresas do link, dos últimos `meses` meses;
 * por empresa e competência vale o pedido mais recente (uma reemissão substitui a guia velha). Com aviso, só liberada
 * (pedidosFgts.liberadoCliente == true).
 */
function guiasDoFgtsDoLink(pedidos, codigos, hoje, meses = 12) {
  const doLink = new Set(codigos.map(c => String(c)));
  const desde = mesesDepois(competenciaDe(hoje), -meses);
  const quando = p => instante(p.fimEm) || instante(p.criadoEm) || '';
  const ultimo = new Map();
  for (const p of pedidos) {
    if (!p || !doLink.has(String(p.codigo)) || p.status !== 'pronto' || p.modo !== 'emitir') continue;
    if (!/^\d{4}-\d{2}$/.test(String(p.competencia)) || p.competencia < desde) continue;
    const k = String(p.codigo) + '|' + p.competencia;
    const atual = ultimo.get(k);
    if (!atual || quando(p) > quando(atual)) ultimo.set(k, p);
  }
  const guias = [];
  for (const p of ultimo.values()) {
    const g = guiaDoFgts(p, hoje, p.liberadoCliente === true);
    if (g) guias.push(g);
  }
  return guias.sort((a, b) => a.id.localeCompare(b.id));
}

/** O que identifica o PDF de uma guia (sem a situação, que muda todo dia): mudou isto, o PDF é outro. */
function assinaturaDoPdf(g) {
  return hashDoEspelho({ id: g.id, competencia: g.competencia, numero: g.numero || '', valor: g.valor, vencimento: g.vencimento });
}

/** O PDF em pedaços de base64 (até 700 KB cada, múltiplo de 4): [{ base64, n, total }], n de 0. */
function pedacosDoPdf(base64, tamanho = PEDACO_PDF) {
  const b64 = String(base64 || '');
  const t = Math.max(4, Math.floor(tamanho / 4) * 4);
  const total = Math.max(1, Math.ceil(b64.length / t));
  return Array.from({ length: total }, (_, n) => ({ base64: b64.slice(n * t, (n + 1) * t), n, total }));
}

// ---------- a agenda do link ----------

/**
 * A agenda do link, um item por mês do VENCIMENTO. Cada empresa: { codigo, nome, regime, dp, execucoes } com
 * execucoes[competencia][departamento] = a execução (rotinas/…) ou null. Um departamento entra quando há execução dele
 * na competência ou quando se sabe que a empresa é dele (fiscal: o regime é conhecido; DP: está na planilha do DP) —
 * para o cliente não ver FGTS de quem o escritório não faz a folha. Link com várias empresas: o id e o nome do item
 * levam a empresa (senão "DAS do Simples" aparece duas vezes sem dizer de quem).
 */
function agendaDoLink(empresas, competencias) {
  const varias = empresas.length > 1;
  const porMes = new Map();
  for (const comp of competencias) porMes.set(mesesDepois(comp, 1), []);
  for (const emp of empresas) {
    for (const comp of competencias) {
      const execs = (emp.execucoes && emp.execucoes[comp]) || {};
      const contexto = { regime: emp.regime || '', dp: emp.dp || null };
      for (const dep of ['fiscal', 'dp']) {
        const ex = execs[dep] || null;
        const entra = !!ex || (dep === 'fiscal' ? !!emp.regime : !!emp.dp);
        if (!entra) continue;
        for (const item of agendaDaExecucao(ex, ROTINAS_DA_AGENDA[dep], { nome: emp.nome, codigo: emp.codigo }, comp, contexto)) {
          const final = varias ? Object.assign({}, item, { id: item.id + '-' + emp.codigo, nome: item.nome + ' · ' + String(emp.nome || emp.codigo).slice(0, 40) }) : item;
          const mes = final.vence.slice(0, 7);
          if (!porMes.has(mes)) porMes.set(mes, []);
          porMes.get(mes).push(final);
        }
      }
    }
  }
  return [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, itens]) => agendaDoMes(mes, itens));
}

// ---------- os chamados ----------

/** Confere o pedido da caixa areaClienteChamados. Devolve { erro } ou { pedido } (só os campos que interessam). */
function validarPedidoDeChamado(p) {
  if (!p || typeof p !== 'object') return { erro: 'pedido vazio' };
  if (!tokenValido(p.token)) return { erro: 'token inválido' };
  if (typeof p.texto !== 'string') return { erro: 'sem texto' };
  const e = erroDoNovoChamado(String(p.tipo || ''), p.texto);
  if (e) return { erro: e };
  if (p.titulo != null && (typeof p.titulo !== 'string' || p.titulo.length > 120)) return { erro: 'título inválido' };
  if (p.chamadoId != null && (typeof p.chamadoId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(p.chamadoId))) return { erro: 'chamado inválido' };
  return { pedido: { token: p.token, tipo: p.tipo, texto: p.texto.trim(), titulo: texto(p.titulo).trim(), chamadoId: p.chamadoId || '' } };
}

/** O limite por token por dia: { dia, porToken } (outro dia = zera). */
function cabeNoLimite(contagem, dia, token, limite) {
  const n = contagem && contagem.dia === dia ? (contagem.porToken || {})[token] || 0 : 0;
  return n < limite;
}
function contarNoLimite(contagem, dia, token) {
  const base = contagem && contagem.dia === dia ? contagem.porToken || {} : {};
  return { dia, porToken: Object.assign({}, base, { [token]: (base[token] || 0) + 1 }) };
}

/**
 * O que fazer com um pedido de chamado já conferido. `ctx`: { linkExiste, contagem, dia, espelhoExiste, chamado }.
 * Devolve { acao: 'descartar', motivo } | { acao: 'criar' } | { acao: 'responder' }.
 */
function decidirChamado(v, ctx) {
  if (v.erro) return { acao: 'descartar', motivo: v.erro };
  if (!ctx.linkExiste) return { acao: 'descartar', motivo: 'o link não existe mais' };
  if (!cabeNoLimite(ctx.contagem, ctx.dia, v.pedido.token, LIMITE_CHAMADOS_POR_DIA)) return { acao: 'descartar', motivo: 'passou de ' + LIMITE_CHAMADOS_POR_DIA + ' pedidos hoje' };
  if (v.pedido.chamadoId) {
    // a resposta só vale num chamado que está no espelho DESTE link (a regra do banco exige o mesmo)
    if (!ctx.espelhoExiste || !ctx.chamado) return { acao: 'descartar', motivo: 'o chamado não é deste link' };
    if (!chamadoAceitaResposta(ctx.chamado)) return { acao: 'descartar', motivo: 'o chamado já foi concluído' };
    return { acao: 'responder' };
  }
  return { acao: 'criar' };
}

/** A mensagem do cliente no chamado interno. */
function mensagemDoCliente(t, em) { return { de: 'cliente', autor: 'Cliente', texto: t, em }; }

/** O chamado interno novo (chamados/{id}): de quem é (token, códigos, empresa), o assunto e a primeira mensagem. */
function chamadoNovo(pedido, link, empresa, agora) {
  return {
    token: pedido.token,
    codigos: link.codigos.slice(),
    empresa,
    tipo: pedido.tipo,
    titulo: pedido.titulo || tituloDoChamado(pedido.tipo, pedido.texto),
    situacao: 'aberto',
    mensagens: [mensagemDoCliente(pedido.texto, agora)],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/** Respondido e o cliente escreveu de novo: volta para "aberto" (a equipe precisa olhar). */
function situacaoDepoisDoCliente(situacao) { return situacao === 'respondido' ? 'aberto' : situacao || 'aberto'; }

/** O chamado interno como o core espera (mensagens com texto e hora ISO). */
function chamadoInterno(id, x) {
  return {
    id,
    tipo: texto(x.tipo),
    titulo: texto(x.titulo),
    situacao: texto(x.situacao),
    mensagens: (Array.isArray(x.mensagens) ? x.mensagens : [])
      .filter(m => m && typeof m === 'object' && texto(m.texto))
      .map(m => ({ de: texto(m.de), texto: m.texto, em: instante(m.em), autor: texto(m.autor), interna: m.interna === true })),
  };
}

const mesmoConjunto = (a, b) => {
  const x = new Set((a || []).map(Number)), y = new Set((b || []).map(Number));
  return x.size === y.size && [...x].every(v => y.has(v));
};

/**
 * Os links onde um chamado aparece: o dele, se existe; se o link dele foi trocado (o antigo apagado), o link que tem as
 * MESMAS empresas (o "trocar" do nads mantém as empresas). `links`: Map(token → { codigos }).
 */
function linksDoChamado(chamado, links) {
  if (links.has(chamado.token)) return [chamado.token];
  return [...links.entries()].filter(([, l]) => mesmoConjunto(l.codigos, chamado.codigos)).map(([t]) => t);
}

// ---------- os envios ----------

const FAMILIA = { pdf: 'pdf', jpg: 'jpg', jpeg: 'jpg', png: 'png', xml: 'xml', zip: 'zip' };
/** Os mimes que as regras do banco aceitam, por extensão. */
const MIMES_ACEITOS = {
  pdf: ['application/pdf'], jpg: ['image/jpeg'], png: ['image/png'],
  xml: ['application/xml', 'text/xml'], zip: ['application/zip', 'application/x-zip-compressed'],
};

/** O que o arquivo é de verdade, pelos primeiros bytes: 'pdf' | 'jpg' | 'png' | 'zip' | 'xml' | ''. */
function tipoPelosBytes(buf) {
  if (!buf || buf.length < 4) return '';
  if (buf.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  // ZIP com conteúdo (o cabeçalho do primeiro arquivo); o ZIP vazio (PK 05 06) não serve
  if (buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) return 'zip';
  // XML: texto (sem byte zero no começo), com BOM ou espaços antes de "<?xml" ou de uma tag
  const inicio = buf.slice(0, 1024);
  if (inicio.includes(0)) return '';
  let s = inicio.toString('utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  s = s.replace(/^\s+/, '');
  if (s.startsWith('<?xml') || /^<[A-Za-z_]/.test(s)) return 'xml';
  return '';
}

/**
 * Confere o pedido da caixa areaClienteEnvios: token, tipo, nome, extensão, mime declarado (o das regras), tamanho e,
 * por fim, o que o arquivo é pelos primeiros bytes (tem que bater com a extensão). Devolve { erro } ou { envio }.
 */
function validarPedidoDeEnvio(p) {
  if (!p || typeof p !== 'object') return { erro: 'pedido vazio' };
  if (!tokenValido(p.token)) return { erro: 'token inválido' };
  if (!TIPOS_EN.has(p.tipo)) return { erro: 'tipo de documento inválido' };
  const nome = texto(p.nome).trim();
  if (!nome || nome.length > 200) return { erro: 'nome inválido' };
  const tamanho = Number(p.tamanho);
  if (!Number.isInteger(tamanho)) return { erro: 'tamanho inválido' };
  const e = erroDoEnvio({ nome, tamanho });
  if (e) return { erro: e };
  const ext = FAMILIA[(nome.split('.').pop() || '').toLowerCase()];
  if (!(MIMES_ACEITOS[ext] || []).includes(p.mime)) return { erro: 'mime não aceito: ' + texto(p.mime) };
  const b64 = texto(p.base64);
  if (!b64 || b64.length > 960000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { erro: 'arquivo ilegível' };
  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length || buffer.length > MAIOR_ENVIO) return { erro: 'tamanho fora do limite' };
  if (buffer.length !== tamanho) return { erro: 'o tamanho não bate com o arquivo' };
  const real = tipoPelosBytes(buffer);
  if (!real) return { erro: 'o arquivo não é PDF, JPG, PNG, XML nem ZIP' };
  if (real !== ext) return { erro: 'o arquivo é ' + real.toUpperCase() + ', mas o nome diz ' + ext.toUpperCase() };
  return { envio: { token: p.token, nome, tipo: p.tipo, ext: real, mime: MIME_DO_ENVIO[real], buffer, tamanho } };
}

/** O que fazer com um envio conferido. `ctx`: { linkExiste, contagem, dia }. */
function decidirEnvio(v, ctx) {
  if (v.erro) return { acao: 'descartar', motivo: v.erro };
  if (!ctx.linkExiste) return { acao: 'descartar', motivo: 'o link não existe mais' };
  if (!cabeNoLimite(ctx.contagem, ctx.dia, v.envio.token, LIMITE_ENVIOS_POR_DIA)) return { acao: 'descartar', motivo: 'passou de ' + LIMITE_ENVIOS_POR_DIA + ' arquivos hoje' };
  return { acao: 'guardar' };
}

const ROTULO_NO_DRIVE = { extrato: 'Extrato', nota: 'Nota fiscal', comprovante: 'Comprovante', outro: 'Documento' };
const semProibidos = t => String(t || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

/** O nome no Drive: a data, o que é e o nome que o cliente deu (sem caminho nem caractere que o Windows recusa). */
function nomeNoDrive(envio, agora) {
  const d = agora || new Date();
  const carimbo = d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
  const original = semProibidos(String(envio.nome || '').split(/[\\/]/).pop().replace(/\.[A-Za-z0-9]{1,5}$/, '')).slice(0, 80).replace(/^\.+/, '');
  return carimbo + ' - ' + (ROTULO_NO_DRIVE[envio.tipo] || 'Documento') + (original ? ' - ' + original : '') + '.' + envio.ext;
}

// ---------- o espelho: lista branca e "grava só se mudou" ----------

/** Os campos que cada documento do espelho pode ter (nada além disso sai para o cliente). */
const CAMPOS_DO_ESPELHO = {
  resumo: ['empresas', 'escritorio', 'atualizadoEm'],
  empresa: ['codigo', 'nome', 'cnpj'],
  escritorio: ['telefone', 'email', 'whatsapp'],
  guia: ['id', 'tipo', 'competencia', 'vencimento', 'valor', 'numero', 'situacao', 'temPdf'],
  pdf: ['base64', 'n', 'total'],
  agenda: ['mes', 'itens', 'atualizadoEm'],
  item: ['id', 'nome', 'vence', 'situacao', 'feitoEm'],
  chamado: ['id', 'tipo', 'titulo', 'situacao', 'mensagens'],
  mensagem: ['de', 'autor', 'texto', 'em'],
  recibo: ['id', 'nome', 'tipo', 'tamanho', 'recebidoEm'],
};
const DENTRO = { resumo: { empresas: 'empresa', escritorio: 'escritorio' }, agenda: { itens: 'item' }, chamado: { mensagens: 'mensagem' } };

/** Joga erro se o documento tiver um campo fora da lista branca (em qualquer nível). Devolve o próprio documento. */
function conferirListaBranca(tipo, doc) {
  const permitidos = CAMPOS_DO_ESPELHO[tipo];
  if (!permitidos) throw new Error('espelho: tipo desconhecido ' + tipo);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('espelho: ' + tipo + ' não é um objeto');
  for (const k of Object.keys(doc)) {
    if (!permitidos.includes(k)) throw new Error('espelho: campo ' + k + ' não pode sair em ' + tipo);
    const filho = (DENTRO[tipo] || {})[k];
    if (filho) for (const x of [].concat(doc[k])) conferirListaBranca(filho, x);
  }
  return doc;
}

/** JSON com as chaves em ordem (o mesmo conteúdo dá o mesmo texto). */
function estavel(v) {
  if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
/** O hash do conteúdo do espelho, sem a hora (mudar só a hora não é mudança). */
function hashDoEspelho(doc) {
  const resto = Object.assign({}, doc);
  delete resto.atualizadoEm;
  return crypto.createHash('sha1').update(estavel(resto)).digest('hex');
}

module.exports = {
  // core: guias
  valorEmReais, dataDoVencimento, situacaoDaGuia, guiaPrecisaLiberar, guiaDoFgts,
  // core: chamados
  TIPOS_DE_CHAMADO, MAIOR_TEXTO_DO_CHAMADO, chamadoDoCliente, erroDoNovoChamado, tituloDoChamado, chamadoAceitaResposta,
  // core: envios
  TIPOS_DE_ENVIO, EXTENSOES_ACEITAS, MAIOR_ENVIO, LIMITE_DO_ENVIO, MIME_DO_ENVIO, mimeDoEnvio, erroDoEnvio, reciboDoEnvio,
  // core: vencimentos
  VENCIMENTOS, vencimentoDaEtapa, isoDaData, diaUtilAnterior, proximoDiaUtil, ultimoDiaUtilDoMes, vencimentoNaCompetencia, vencimentoDaEtapaNoMes,
  // core: execução e agenda
  ROTINAS_DA_AGENDA, etapaNoMesDoAno, etapaNoMes, execucaoNova, agendaDaExecucao, competenciaDoMesDeVencimento, agendaDoMes,
  // só do robô
  tokenValido, LIMITE_CHAMADOS_POR_DIA, LIMITE_ENVIOS_POR_DIA, PEDACO_PDF, REGIMES, OBRIGACOES_DP,
  instante, competenciaDe, mesesDepois, competenciasDaAgenda, slug,
  lerListaDoCore, lerDpDoCore, regimeQueVale,
  resumoDoCliente, guiasDoFgtsDoLink, assinaturaDoPdf, pedacosDoPdf, agendaDoLink,
  validarPedidoDeChamado, cabeNoLimite, contarNoLimite, decidirChamado, mensagemDoCliente, chamadoNovo, situacaoDepoisDoCliente,
  chamadoInterno, mesmoConjunto, linksDoChamado,
  MIMES_ACEITOS, tipoPelosBytes, validarPedidoDeEnvio, decidirEnvio, nomeNoDrive,
  CAMPOS_DO_ESPELHO, conferirListaBranca, estavel, hashDoEspelho,
};
