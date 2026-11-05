// Fiscal › Relatório › Enviar guias (03/11/2026: "A parte de gmail tem que funcionar assim como o envios do dp, ele sobe o
// arquivo e envia direto via gmail para o cliente, ao enviar o arquivo ele lê e ja coloca os valores na tabela"): o lote do
// DP › Envios para as guias do Fiscal. A tela sobe as guias (lotesFiscal, com o grupo do Relatório: Simples ou Presumido),
// o robô da nuvem lê cada uma com o leitor do arquivador e acha a coluna do Relatório (robo/lote-fiscal.js), a pessoa revisa
// e dispara; o robô manda um e-mail por cliente e competência, grava no Drive e preenche a linha do Relatório
// (controleTributos: só o que está em branco). Interface + a versão de exemplo; a do banco é loteFiscal.firestore.ts.
import { empresas, tarefas as t } from '@nads/core';
import type { RepoControleTributos } from './controleTributos';
import type { ModeloDoEnvio } from './enviosDp';
import type { ArquivoDoLote, EscolhaDoArquivo, LeituraDoArquivo, LoteDp, ResultadoDoLote } from './loteDp';

/** o que o leitor achou na guia: o do lote do DP e a coluna do Relatório ('' = sem coluna) */
export interface LeituraDaGuia extends LeituraDoArquivo { coluna: string }
/** a escolha da revisão; coluna: a do Relatório ('' = sem coluna; sem o campo, vale a do leitor) */
export interface EscolhaDaGuia extends EscolhaDoArquivo { coluna?: string }
/**
 * Como o cliente recebe as guias (04/11/2026: "preciso que quando eu va em enviar guias tenha a opção de impresso ou gmail,
 * impresso cria na rotina do entregas a entrega"): pelo Gmail (o e-mail do robô) ou impresso (o robô põe a entrega na rota
 * do Entregas, com as guias anexadas, e o Relatório fica com Entregue = Impresso).
 */
// e o eContador do Alterdata (04/11/2026: "preciso que coloque a opção econtador do alterdata como envio e tambem preciso que preencha dae e icms na planilha la, enviei 2 dae via impresso e não preencheu"): o robô grava as guias no Drive e o Relatório com Entregue = eContador,
// sem e-mail e sem entrega (a guia vai para o portal do cliente pelo eContador)
export type ViaDaGuia = 'email' | 'impresso' | 'econtador';
/** a via guardada no banco ('' ou outra coisa = Gmail) */
export const viaDaGuia = (v: unknown): ViaDaGuia => (v === 'impresso' || v === 'econtador' ? v : 'email');
export interface GuiaDoLote extends Omit<ArquivoDoLote, 'leitura' | 'escolha'> { leitura: LeituraDaGuia | null; escolha: EscolhaDaGuia | null }
export interface ResultadoDoLoteFiscal extends ResultadoDoLote {
  /** as colunas que o robô preencheu no Relatório (as que estavam em branco); valores: o valor das guias por coluna */
  preenchidos: string[];
  /** a linha do Relatório não foi gravada (o e-mail foi): conferir à mão */
  erroNoRelatorio: string;
  /** como foi: pelo Gmail ou impresso (a entrega na rota do Entregas, entregaId) */
  via: ViaDaGuia;
  entregaId: string;
}
export interface LoteFiscal extends Omit<LoteDp, 'resultados'> {
  grupo: t.GrupoDoControleId;
  resultados: ResultadoDoLoteFiscal[];
  /** a via de cada cliente (o código), gravada no disparo; sem o cliente, Gmail */
  vias: Record<string, ViaDaGuia>;
}
/** um e-mail de guias já enviado (o registro do robô em solicitacoesEmail, tipo envioFiscal): a aba "Enviados" */
export interface EnvioDasGuias {
  id: string;
  codigo: number;
  empresa: string;
  /** a competência da apuração (AAAA-MM) */
  competencia: string;
  grupo: t.GrupoDoControleId;
  para: string[];
  /** os nomes das guias anexadas */
  guias: string[];
  /** as guias gravadas no Drive (o id abre pelo robô, sem o PDF no banco); vazio nos envios de antes de 04/11/2026 */
  guiasDrive: { nome: string; id: string }[];
  enviadoEm: string;
  /** quem pediu o disparo */
  por: string;
  /** impresso: foi para a rota do Entregas (para fica vazio) */
  via: ViaDaGuia;
}

/** O modelo do e-mail das guias (config/envioFiscal): vazio = este, o mesmo do robô (robo/lote-fiscal.js) */
export const MODELO_PADRAO_DAS_GUIAS: ModeloDoEnvio = {
  assunto: 'Guias de impostos · {competencia} · {cliente}',
  texto: 'Olá, {cliente}!\n\nSeguem em anexo as guias de impostos referentes a {mes}. Confira os vencimentos em cada guia.\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nNilma Contabilidade',
};

export interface RepoLoteFiscal {
  exemplos: boolean;
  /** os lotes de guias de quem está no nads (os dois grupos), o mais novo primeiro */
  lotes(): { carregados: boolean; lista: LoteFiscal[] };
  /** as guias de um lote, ao vivo */
  arquivos(lote: string, chegou: (lista: GuiaDoLote[]) => void): () => void;
  /** sobe as guias (em pedaços) e entrega o lote ao robô; devolve o id do lote */
  subir(grupo: t.GrupoDoControleId, arquivos: readonly { nome: string; bytes: Uint8Array }[], andamento: (feitos: number, total: number) => void): Promise<string>;
  /** a escolha da revisão (null tira a escolha e volta ao que o leitor achou) */
  escolher(lote: string, arquivo: string, escolha: EscolhaDaGuia | null): Promise<void>;
  /** tira do lote ou põe de volta */
  tirar(lote: string, arquivo: string, fora: boolean): Promise<void>;
  /** grava a via de cada cliente (o código) no lote, antes do disparo */
  definirVias(lote: string, vias: Record<string, ViaDaGuia>): Promise<void>;
  /** pede o disparo ao robô */
  disparar(lote: string): Promise<void>;
  /** exclui o lote ainda não enviado (marca 'cancelado'; o robô apaga o lote, as guias e os pedaços) */
  excluir(lote: string): Promise<void>;
  /** o PDF de uma guia do lote, pelos pedaços que a tela subiu (só existem até o e-mail sair: o robô apaga depois) */
  bytesDaGuia(lote: string, arquivo: string): Promise<Uint8Array>;
  /** os e-mails de guias já enviados na competência da apuração (os dois grupos), ao vivo; os lotes somem em 3 dias, estes ficam */
  enviados(competencia: string): { carregados: boolean; lista: EnvioDasGuias[] };
  /** o modelo do e-mail como está no banco (vazio = o padrão) */
  modelo(): { carregado: boolean } & ModeloDoEnvio;
  gravarModelo(m: ModeloDoEnvio): Promise<void>;
  assinar(f: () => void): () => void;
  versao(): number;
}

// nos exemplos, o tipo e o tributo pelo nome do arquivo; sem nada no nome, um por vez dos do grupo
const PELO_NOME: readonly [RegExp, string, string][] = [
  [/\bDAS\b|SIMPLES/, 'DAS', ''], [/\bPIS\b/, 'DARF', 'PIS'], [/COFINS/, 'DARF', 'COFINS'], [/IRPJ/, 'DARF', 'IRPJ'], [/CSLL/, 'DARF', 'CSLL'],
  [/IRRF/, 'DARF', 'IRRF'], [/ICMS|\bDAE\b/, 'DAE', 'ICMS'], [/\bISS\b|\bDAM\b/, 'DAM', 'ISS'],
];
const DA_VEZ: Record<t.GrupoDoControleId, readonly [string, string][]> = {
  sn: [['DAS', '']], lp: [['DARF', 'PIS'], ['DARF', 'COFINS'], ['DARF', 'IRPJ'], ['DARF', 'CSLL'], ['DAE', 'ICMS'], ['DAM', 'ISS']],
};

/** O que o leitor acha, nos exemplos: o tipo pelo nome do arquivo e um cliente do regime do grupo; a apuração é a do mês passado. */
function leituraDeExemplo(nome: string, k: number, grupo: t.GrupoDoControleId): LeituraDaGuia {
  const n = nome.toUpperCase();
  const regime = grupo === 'sn' ? 'Simples' : 'Presumido';
  const doGrupo = empresas.EMPRESAS.filter(e => e.codigo != null && e.regime === regime);
  const cli = doGrupo[(k * 7) % doGrupo.length];
  const achado = PELO_NOME.find(([re]) => re.test(n));
  const [tipo, tributo] = achado ? [achado[1], achado[2]] : DA_VEZ[grupo][k % DA_VEZ[grupo].length];
  if (k % 6 === 5) {
    return { acao: 'NAO_IDENTIFICADO', motivo: 'CONTEUDO_SEM_TEXTO', cliente: null, clienteNome: '', tipo: '', tributo: '', competencia: '', valor: '', vencimento: '', nomeFinal: '', destino: [], semTexto: true, coluna: '' };
  }
  const hoje = new Date();
  const competencia = t.somarMesesDaCompetencia(hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0'), -1);
  const mm = competencia.slice(5) + '-' + competencia.slice(0, 4);
  const venc = '20-' + t.somarMesesDaCompetencia(competencia, 1).slice(5) + '-' + t.somarMesesDaCompetencia(competencia, 1).slice(0, 4);
  const valor = 'R$' + (180 + k * 53) + ',' + String(10 + k).slice(-2);
  const pasta = grupo === 'sn' ? ['FISCAL', 'SIMPLES NACIONAL', tipo === 'DAS' ? '01. DAS' : tipo === 'DAE' ? '02. DAE' : tipo === 'DAM' ? '08. DAM' : '16. DARF']
    : ['FISCAL', 'LUCRO PRESUMIDO', tipo === 'DARF' ? '05. DARF' : tipo === 'DAE' ? '06. DAE' : tipo === 'DAM' ? '10. DAM' : '03. DOCUMENTOS FISCAIS'];
  return {
    acao: 'ARQUIVAR', motivo: '', cliente: cli.codigo, clienteNome: cli.nome, tipo, tributo, competencia, valor, vencimento: venc,
    nomeFinal: tipo === 'DAS' ? mm + '.pdf' : mm + ' - ' + tipo + ' ' + tributo + ' - VALOR ' + valor + ' - VENCIMENTO ' + venc + '.pdf',
    destino: [competencia.slice(0, 4), cli.codigo + ' - ' + cli.nome, ...pasta], semTexto: false, coluna: t.colunaDaGuia(grupo, tipo, tributo),
  };
}

/** a coluna que vale da guia: a escolhida na revisão sobre a do leitor (a de fora do grupo fica sem coluna) */
export function colunaQueVale(a: GuiaDoLote, grupo: t.GrupoDoControleId): string {
  const c = a.escolha && typeof a.escolha.coluna === 'string' ? a.escolha.coluna : a.leitura?.coluna || '';
  return t.grupoDoControle(grupo).colunas.some(x => x.id === c) ? c : '';
}
/** 'R$1234,56' (o valor lido na guia) → 1234.56; null sem valor */
export function valorDaGuia(v: string | undefined): number | null {
  const m = /(\d[\d.]*),(\d{2})/.exec(v || '');
  return m ? Number(m[1].replace(/\./g, '') + '.' + m[2]) : null;
}

/**
 * Os exemplos (sem banco): a leitura pelo nome do arquivo e o disparo andam sozinhos; o disparo preenche o Relatório de
 * exemplo (o controle de tributos na memória) com a mesma regra do robô: só o que está em branco.
 */
export function criarLoteFiscalMemoria(controle: () => RepoControleTributos): RepoLoteFiscal {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const lotes: LoteFiscal[] = [];
  const arquivos = new Map<string, GuiaDoLote[]>();
  const bytes = new Map<string, Uint8Array>();
  let modelo: ModeloDoEnvio = { assunto: '', texto: '' };
  const agora = () => new Date().toISOString();
  const doLote = (id: string) => arquivos.get(id) || [];
  const mudarLote = (id: string, m: Partial<LoteFiscal>) => { const k = lotes.findIndex(l => l.id === id); if (k >= 0) lotes[k] = { ...lotes[k], ...m }; mudou(); };
  const mudarArquivo = (id: string, a: string, m: Partial<GuiaDoLote>) => { arquivos.set(id, doLote(id).map(x => (x.id === a ? { ...x, ...m } : x))); mudou(); };
  return {
    exemplos: true,
    lotes: () => ({ carregados: true, lista: [...lotes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)) }),
    arquivos(id, chegou) {
      const mandar = () => chegou(doLote(id));
      ouvintes.add(mandar);
      mandar();
      return () => { ouvintes.delete(mandar); };
    },
    async subir(grupo, lista, andamento) {
      const id = 'ex-guias-' + Date.now();
      lotes.push({ id, grupo, status: 'pendente', criadoEm: agora(), criadoPor: 'exemplo', total: lista.length, lidos: 0, erro: '', disparadoPor: '', resultados: [], vias: {} });
      lista.forEach((a, k) => bytes.set(id + '/' + k, a.bytes));
      arquivos.set(id, lista.map((a, k) => ({ id: String(k), nome: a.nome, tamanho: a.bytes.length, status: 'pendente', erro: '', leitura: null, escolha: null, fora: false })));
      andamento(lista.length, lista.length);
      mudou();
      setTimeout(() => mudarLote(id, { status: 'lendo' }), 500);
      setTimeout(() => {
        arquivos.set(id, doLote(id).map((a, k) => ({ ...a, status: 'lido', leitura: leituraDeExemplo(a.nome, k, grupo) })));
        mudarLote(id, { status: 'lido', lidos: lista.length });
      }, 1800);
      return id;
    },
    async escolher(id, a, escolha) { mudarArquivo(id, a, { escolha }); },
    async tirar(id, a, fora) { mudarArquivo(id, a, { fora }); },
    async definirVias(id, vias) { mudarLote(id, { vias: { ...vias } }); },
    async excluir(id) {
      const k = lotes.findIndex(l => l.id === id);
      if (k >= 0) lotes.splice(k, 1);
      arquivos.delete(id);
      mudou();
    },
    async disparar(id) {
      const lote = lotes.find(l => l.id === id);
      if (!lote) return;
      mudarLote(id, { status: 'disparando', disparadoPor: 'exemplo' });
      setTimeout(() => {
        const porChave = new Map<string, GuiaDoLote[]>();
        for (const a of doLote(id)) {
          const codigo = a.escolha && a.escolha.cliente > 0 ? a.escolha.cliente : a.leitura?.cliente;
          const comp = a.escolha?.competencia || a.leitura?.competencia;
          if (a.fora || codigo == null || !comp) continue;
          const chave = codigo + '_' + comp;
          porChave.set(chave, [...(porChave.get(chave) || []), a]);
        }
        const dia = agora().slice(0, 10);
        const ja = new Map(lote.resultados.map(r => [r.chave, r]));
        const resultados: ResultadoDoLoteFiscal[] = [...porChave].map(([chave, itens]) => {
          const antes = ja.get(chave);
          if (antes?.status === 'enviado') return antes;
          const [cod, comp] = chave.split('_');
          const codigo = Number(cod);
          const valores: Record<string, number> = {};
          for (const i of itens) {
            const c = colunaQueVale(i, lote.grupo);
            const v = valorDaGuia(i.leitura?.valor);
            if (c && v != null) valores[c] = Math.round(((valores[c] || 0) + v) * 100) / 100;
          }
          const via = viaDaGuia(lote.vias[String(codigo)]);
          const erro = via === 'email' && codigo % 9 === 0 ? 'o cliente não tem e-mail no cadastro' : '';
          let preenchidos: string[] = [];
          if (!erro) {
            // a linha do Relatório de exemplo, como o robô faz: só o que está em branco
            const repo = controle();
            const linha = repo.doMes(comp).linhas.get(codigo) || t.linhaEmBranco(comp, codigo, lote.grupo);
            preenchidos = Object.keys(valores).filter(c => !(linha.valores[c] || '').trim());
            const textos = Object.fromEntries(Object.entries(valores).map(([c, v]) => [c, t.valorDoControle(v.toFixed(2).replace('.', ','))]));
            // impresso: o valor e o Entregue = Impresso; a data fica para quando a entrega for confirmada na rota
            const nova = t.preencherComSugestao(linha, { valores: textos, data: via === 'email' ? dia : '', email: via === 'email' });
            void repo.salvarLinha(via === 'email' ? nova : { ...nova, entregue: nova.entregue || via });
          }
          return {
            chave, codigo, competencia: comp, status: erro ? 'erro' : 'enviado', erro, para: via === 'email' ? ['financeiro@exemplo.com.br'] : [], via, entregaId: via === 'impresso' ? 'ex-entrega-' + chave : '', enviadoEm: agora(), arquivos: itens.map(i => i.leitura?.nomeFinal || i.nome),
            salvos: erro ? [] : itens.map(i => ({ nome: i.leitura?.nomeFinal || i.nome, pasta: (i.leitura?.destino || []).join('/'), jaEstava: false, erro: i.leitura?.destino.length ? '' : 'sem a pasta no Drive' })),
            valores, preenchidos, erroNoRelatorio: '',
          };
        });
        mudarLote(id, { status: 'disparado', resultados });
      }, 2000);
    },
    async bytesDaGuia(id, a) {
      const b = bytes.get(id + '/' + a);
      if (!b) throw new Error('a guia não está mais no lote');
      return b;
    },
    enviados(competencia) {
      const lista: EnvioDasGuias[] = lotes.flatMap(l => l.resultados.filter(r => r.status === 'enviado' && r.competencia === competencia).map(r => ({
        id: l.id + '|' + r.chave, codigo: r.codigo, empresa: empresas.EMPRESAS.find(x => x.codigo === r.codigo)?.nome || '', competencia: r.competencia, grupo: l.grupo,
        para: r.para, guias: r.arquivos, guiasDrive: r.salvos.map((x, k) => ({ nome: x.nome, id: 'ex-' + l.id + '-' + k })), enviadoEm: r.enviadoEm, por: l.disparadoPor, via: r.via,
      })));
      return { carregados: true, lista: lista.sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm)) };
    },
    modelo: () => ({ carregado: true, ...modelo }),
    async gravarModelo(m) { modelo = { assunto: m.assunto.trim(), texto: m.texto.trim() }; mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
