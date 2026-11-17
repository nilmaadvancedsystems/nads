// As cartas do Fiscal aos clientes (12/11/2026: "preciso de um envio de carta de balanco para varios clientes para o final do
// ano, e todo mês enviar mandar um cheklist do que ele tem que enviar"), nos modelos do escritório (Balanço.pdf e CHECKLIST
// MENSAL DE DOCUMENTOS.pdf):
//
//   - a Carta de balanço: no fim do ano, o Fiscal escolhe na tela os clientes (os que têm estoque) e o robô manda a cada um
//     um PDF com a Carta de balanço e a Declaração de inventário, assinado com o certificado do escritório. Cada cliente é um
//     pedido na fila de e-mails do robô (solicitacoesEmail, tipo 'cartaBalanco'), como o Mandei;
//   - o Checklist mensal: o robô manda sozinho, no último dia útil do mês, para todos os clientes ativos com e-mail, o
//     checklist no corpo do e-mail (HTML) e o PDF do escritório anexo. O prazo do cliente é o 2º dia útil do mês seguinte.
//
// Tudo puro: as datas, os textos e a situação de cada cliente. O PDF da carta é desenhado em apps/web (cartaDeBalancoPdf.ts,
// no navegador e no robô, pelo robo/gerado/cartas.js); o e-mail, a assinatura digital e a fila ficam no robô
// (robo/cartas-fiscal.js).
import { diaUtil } from '../mandei';

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPETENCIA = /^(20\d{2})-(0[1-9]|1[0-2])$/;

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** '2026-01-10' -> '10/01/2026' ('' se não for data) */
export function dataBr(iso: string): string {
  const m = ISO.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

/** A data como no modelo: '05 de Dezembro de 2025' (o mês com a inicial maiúscula). */
export function dataPorExtenso(d: Date): string {
  const mes = MESES[d.getMonth()];
  return pad2(d.getDate()) + ' de ' + mes.charAt(0).toUpperCase() + mes.slice(1) + ' de ' + d.getFullYear();
}

/** '2026-11' -> 'novembro de 2026' */
export function mesPorExtenso(competencia: string): string {
  const m = COMPETENCIA.exec(String(competencia || ''));
  return m ? MESES[Number(m[2]) - 1] + ' de ' + m[1] : '';
}

/** Troca {campo} pelo valor; o campo que não existe fica como está. */
export function preencher(texto: string, campos: Record<string, string>): string {
  return String(texto || '').replace(/\{(\w+)\}/g, (tudo, k: string) => (k in campos ? campos[k] : tudo));
}

/** O nome que vai no anexo, sem os caracteres que o Windows e o Gmail não aceitam. */
export function nomeDeArquivo(texto: string): string {
  const semControle = [...String(texto || '').normalize('NFC')].map(c => (c.charCodeAt(0) < 32 ? ' ' : c)).join('');
  return semControle.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// ─── Carta de balanço ─────────────────────────────────────────────────────────

/** O prazo de sempre para o cliente mandar o inventário: 10 de janeiro do ano seguinte. */
export function prazoPadraoDoBalanco(ano: number): string {
  return (ano + 1) + '-01-10';
}

/** O ano do balanço que a tela sugere: o deste ano (de outubro em diante) ou o do ano passado (até setembro). */
export function anoSugeridoDoBalanco(hoje: Date): number {
  return hoje.getMonth() >= 9 ? hoje.getFullYear() : hoje.getFullYear() - 1;
}

/** Por que a carta não pode sair com esse ano e esse prazo ('' = pode). */
export function problemaDaCarta(ano: number, prazo: string): string {
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return 'o ano do balanço não é válido';
  const m = ISO.exec(String(prazo || ''));
  if (!m) return 'falta o prazo de entrega do inventário';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isoDe(d) !== prazo) return 'o prazo de entrega não é uma data válida';
  if (prazo <= ano + '-12-31') return 'o prazo de entrega tem que ser depois de 31/12/' + ano;
  if (prazo > (ano + 1) + '-12-31') return 'o prazo de entrega passa do ano seguinte';
  return '';
}

/** O que vai escrito na Carta de balanço e na Declaração de inventário de um cliente. */
export interface DadosDaCarta {
  empresa: string;
  ano: number;
  /** '31/12/2025' */
  inventarioEm: string;
  /** '10/01/2026' */
  prazo: string;
  proximoAno: number;
  /** 'Taiobeiras - MG, 05 de Dezembro de 2025.' */
  localEData: string;
}

export const LOCAL_DA_CARTA = 'Taiobeiras - MG';

/** Os dados da carta: a empresa (o nome do cadastro), o ano do balanço, o prazo (ISO) e o dia em que a carta sai. */
export function dadosDaCarta(o: { empresa: string; ano: number; prazo: string; hoje: Date }): DadosDaCarta {
  return {
    empresa: String(o.empresa || '').replace(/\s+/g, ' ').trim(),
    ano: o.ano,
    inventarioEm: '31/12/' + o.ano,
    prazo: dataBr(o.prazo),
    proximoAno: o.ano + 1,
    localEData: LOCAL_DA_CARTA + ', ' + dataPorExtenso(o.hoje) + '.',
  };
}

/** Um pedaço do parágrafo; o negrito é o do modelo (a empresa, as datas, o formato do arquivo). */
export interface Trecho { texto: string; negrito?: boolean }
/** O parágrafo em texto corrido. */
export const juntar = (trechos: Trecho[]) => trechos.map(t => t.texto).join('');

/** Os parágrafos da Carta de balanço (o texto do modelo, com o ano, o dia do inventário e o prazo). */
export function textoDaCarta(d: DadosDaCarta): { titulo: string; paragrafos: Trecho[][]; votos: string } {
  return {
    titulo: 'CARTA DE BALANÇO',
    paragrafos: [
      [
        { texto: 'Com a finalidade de dar encerramento no movimento econômico de sua empresa, referente ao ano de ' + d.ano +
          ', pedimos para fazer o levantamento do balanço (inventário) em ' + d.inventarioEm + ' e nos fazer a entrega do mesmo no máximo até ' },
        { texto: d.prazo, negrito: true }, { texto: ', em formato eletrônico: ' }, { texto: 'txt ou Excel', negrito: true }, { texto: '.' },
      ],
      [{ texto: 'Caso sua empresa não faça uso de sistema informatizado de gestão de estoque entre em contato conosco para envio de um modelo em Excel padronizado.' }],
    ],
    votos: 'Desejamos-lhe(s) um feliz natal e um ano de ' + d.proximoAno + ' repleto de realizações!',
  };
}

/** Os parágrafos da Declaração de inventário (o cliente preenche o valor, dá ciência e assina). */
export function textoDaDeclaracao(d: DadosDaCarta): { titulo: string; paragrafos: Trecho[][]; fecho: string } {
  return {
    titulo: 'DECLARAÇÃO DE INVENTÁRIO',
    paragrafos: [
      [
        { texto: 'Declaro para os devidos fins a que se fizerem necessários que o valor total do estoque de mercadorias de minha empresa ' },
        { texto: d.empresa, negrito: true }, { texto: ', inventariado em ' }, { texto: d.inventarioEm, negrito: true },
        { texto: ' é de R$____________________________.' },
      ],
      [{ texto: 'Declaro ainda que o detalhamento de produtos em estoque nesta data foi entregue à Nilma Contabilidade em formato digital para a devida contabilização e que o valor total dos produtos em arquivo corresponde fielmente ao valor aqui declarado.' }],
    ],
    fecho: 'Por expressão da verdade e para efeitos legais firmo a presente.',
  };
}

/** O e-mail da carta: {cliente}, {ano}, {prazo} e {proximoAno}. */
export const EMAIL_DA_CARTA = {
  assunto: 'Carta de balanço {ano} · {cliente}',
  texto: 'Olá, {cliente}!\n\nSegue em anexo a Carta de balanço de {ano}, com a Declaração de inventário.\n\n' +
    'Para encerrar o ano da sua empresa, pedimos o levantamento do balanço (inventário) do estoque em 31/12/{ano} e o envio até {prazo}, ' +
    'em formato eletrônico (txt ou Excel). A Declaração de inventário volta preenchida com o valor total do estoque e assinada.\n\n' +
    'Se a sua empresa não usa sistema de estoque, responda este e-mail que mandamos o modelo em Excel.\n\n' +
    'Desejamos um feliz Natal e um {proximoAno} repleto de realizações!\n\nAtenciosamente,\nNilma Contabilidade · Departamento Fiscal',
};

/** O assunto e o texto do e-mail da carta de um cliente. */
export function emailDaCarta(d: DadosDaCarta): { assunto: string; texto: string } {
  const campos = { cliente: d.empresa || 'cliente', ano: String(d.ano), prazo: d.prazo, proximoAno: String(d.proximoAno) };
  return { assunto: preencher(EMAIL_DA_CARTA.assunto, campos), texto: preencher(EMAIL_DA_CARTA.texto, campos) };
}

/** 'Carta de balanço 2025 - MARISFRUTAS LTDA.pdf' */
export function nomeDoPdfDaCarta(empresa: string, ano: number): string {
  const quem = nomeDeArquivo(empresa).slice(0, 60);
  return 'Carta de balanço ' + ano + (quem ? ' - ' + quem : '') + '.pdf';
}

/** O pedido na fila de e-mails do robô (solicitacoesEmail) para a carta de um cliente. */
export interface PedidoDaCarta {
  tipo: 'cartaBalanco';
  status: 'pendente';
  departamento: 'fiscal';
  origem: 'nads';
  codigo: string;
  empresa: string;
  ano: number;
  prazo: string;
  /** o teste vai só para o escritório, com o nome deste cliente na carta */
  teste: boolean;
  criadoEm: string;
  criadoPor: string;
  criadoPorEmail: string;
  criadoPorUid: string;
}

export function pedidoDaCarta(o: {
  codigo: number | string; empresa: string; ano: number; prazo: string; teste?: boolean;
  quem: { nome: string; email: string; uid: string }; agora: Date;
}): PedidoDaCarta {
  const problema = problemaDaCarta(o.ano, o.prazo);
  if (problema) throw new Error(problema);
  const codigo = String(o.codigo ?? '').trim();
  if (!/^\d+$/.test(codigo)) throw new Error('o cliente está sem código');
  return {
    tipo: 'cartaBalanco', status: 'pendente', departamento: 'fiscal', origem: 'nads',
    codigo, empresa: String(o.empresa || '').trim().slice(0, 200), ano: o.ano, prazo: o.prazo, teste: o.teste === true,
    criadoEm: o.agora.toISOString(), criadoPor: String(o.quem.nome || '').slice(0, 100),
    criadoPorEmail: String(o.quem.email || '').trim().toLowerCase(), criadoPorUid: String(o.quem.uid || ''),
  };
}

/** Um pedido de carta (ou um registro do checklist) como a tela lê de solicitacoesEmail. */
export interface RegistroDoEnvio {
  id: string;
  tipo: string;
  status: string;
  codigo: string;
  empresa?: string;
  ano?: number;
  competencia?: string;
  teste?: boolean;
  para?: string[];
  criadoEm?: string;
  enviadoEm?: string;
  erro?: string;
}

export type SituacaoDoEnvio = 'fila' | 'enviada' | 'erro';
export interface SituacaoDoCliente { situacao: SituacaoDoEnvio; em: string; erro: string; para: string[] }

const situacaoDe = (status: string): SituacaoDoEnvio | null =>
  status === 'enviado' ? 'enviada' : status === 'erro' ? 'erro' : status === 'pendente' || status === 'processando' || status === 'enviando' ? 'fila' : null;

/**
 * A situação de cada cliente (pelo código) nos envios de um tipo: o pedido mais novo vale, menos quando um mais velho já
 * foi enviado (a carta enviada não "volta" a erro por uma segunda tentativa). Os testes ficam de fora.
 * filtro: o ano da carta ou a competência do checklist.
 */
export function situacaoPorCliente(registros: RegistroDoEnvio[], tipo: string, filtro: { ano?: number; competencia?: string }): Record<string, SituacaoDoCliente> {
  const saida: Record<string, SituacaoDoCliente> = {};
  const lista = registros
    .filter(r => r && r.tipo === tipo && !r.teste && (filtro.ano === undefined || r.ano === filtro.ano) && (filtro.competencia === undefined || r.competencia === filtro.competencia))
    .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  for (const r of lista) {
    const s = situacaoDe(r.status);
    if (!s) continue;
    const codigo = String(r.codigo || '');
    if (saida[codigo]?.situacao === 'enviada') continue;
    saida[codigo] = { situacao: s, em: (s === 'enviada' ? r.enviadoEm : r.criadoEm) || '', erro: s === 'erro' ? String(r.erro || '') : '', para: Array.isArray(r.para) ? r.para : [] };
  }
  return saida;
}

/** Quem pode ir no envio: o marcado que não está na fila nem já recebeu (o erro pode ir de novo). */
export function podeMandarDeNovo(s: SituacaoDoCliente | undefined): boolean {
  return !s || s.situacao === 'erro';
}

// ─── Checklist mensal ─────────────────────────────────────────────────────────

/** Um bloco do checklist: o título, uma nota curta, os grupos de itens e a observação (o texto do PDF do escritório). */
export interface SecaoDoChecklist {
  titulo: string;
  nota?: string;
  grupos: { titulo?: string; itens: string[] }[];
  /** parágrafos soltos (a retirada de lucros explica a regra antes dos itens) */
  paragrafos?: string[];
  obs?: string;
}

export const CHECKLIST_INTRODUCAO = 'Para que possamos realizar corretamente a apuração de impostos, envio das declarações e evitar multas ou notificações fiscais, é indispensável o envio mensal das informações da empresa dentro do prazo.';

export const CHECKLIST: SecaoDoChecklist[] = [
  {
    titulo: '1) Documentos fiscais (obrigatório todo mês)',
    nota: 'Enviar sempre:',
    grupos: [
      { titulo: 'Vendas', itens: ['Notas fiscais de saída emitidas (arquivos XML)', 'Cupons fiscais / relatórios do PDV', 'Relatório de faturamento mensal (quando houver sistema)'] },
      { titulo: 'Compras', itens: ['Notas fiscais de entrada (mercadorias e insumos) (arquivos XML)', 'Conhecimentos de transporte (frete) (arquivos XML)'] },
      { titulo: 'Serviços', itens: ['Notas fiscais de serviços prestados', 'Notas fiscais de serviços tomados (ex.: contador, manutenção, marketing, fretes, etc.)'] },
    ],
  },
  {
    titulo: '2) Contas e despesas da empresa',
    nota: 'Importante para contabilidade e conferências.',
    grupos: [{ itens: ['Conta de energia elétrica', 'Conta de água', 'Telefone e internet', 'Aluguel (recibo ou contrato, quando houver)', 'Demais despesas da empresa pagas no mês'] }],
    obs: 'As contas de consumo (água, energia elétrica, telefone, internet ou similares) devem estar em nome da empresa. Caso não estejam, deverá ser realizada a devida alteração de titularidade.',
  },
  {
    titulo: '3) Movimentação financeira',
    nota: 'Um dos itens mais importantes. Enviar:',
    grupos: [{ itens: ['Extratos bancários de TODAS as contas da empresa (PDF e OFX)', 'Comprovantes de pagamentos', 'Comprovantes de recebimentos (PIX, transferências, cartões)', 'Faturas de cartão de crédito empresarial'] }],
  },
  {
    titulo: '3.1) Retirada de lucros dos sócios — informação obrigatória (a partir de 2026)',
    paragrafos: [
      'Com as novas regras trazidas pela Reforma Tributária (Lei nº 15.270/2025), a Receita Federal passou a acompanhar mensalmente as retiradas de lucros realizadas pelos sócios das empresas.',
      'A partir de 2026, retiradas de lucros que ultrapassarem R$ 50.000,00 no mesmo mês estão sujeitas à retenção de 10% de Imposto de Renda. Essa informação deve ser declarada ao Fisco pela EFD-Reinf, sujeita a multas caso haja omissão.',
      'Base legal: Lei nº 15.270/2025 (Reforma Tributária); Instrução Normativa RFB nº 2.043/2021 (EFD-Reinf); art. 57 da Lei nº 12.873/2013 (penalidades por omissão ou atraso de informações).',
    ],
    nota: 'Ao final de cada mês, enviar ao escritório:',
    grupos: [{ itens: ['Valor retirado por cada sócio', 'Data de cada retirada realizada'] }],
    obs: 'Informar mesmo quando a retirada for por PIX, transferência ou dinheiro. Caso haja previsão de retirada de valores maiores que R$ 50.000,00, entre em contato com o escritório antes da retirada, para orientação tributária adequada.',
  },
  {
    titulo: '4) Impostos e guias',
    nota: 'Caso pagos diretamente pela empresa (enviar sempre com o comprovante de pagamento):',
    grupos: [{ itens: ['DAS', 'FGTS', 'INSS', 'ICMS', 'Parcelamentos', 'PIS', 'COFINS', 'IRPJ', 'CSLL'] }],
  },
  {
    titulo: '5) Folha de pagamento (se possuir funcionários)',
    grupos: [{ itens: ['Admissões e demissões ocorridas no mês', 'Férias', 'Atestados médicos', 'Rescisões', 'Pró-labore dos sócios'] }],
    obs: 'Informar imediatamente ao escritório qualquer contratação ou desligamento antes de acontecer.',
  },
  {
    titulo: '6) Situações especiais (enviar quando ocorrer)',
    nota: 'Avisar o escritório sempre que houver:',
    grupos: [{ itens: ['Compra ou venda de veículo', 'Compra ou venda de máquinas/equipamentos', 'Empréstimos ou financiamentos', 'Abertura de conta bancária', 'Alteração de endereço', 'Alteração de atividade', 'Entrada ou saída de sócio'] }],
  },
];

export const CHECKLIST_ATENCAO = 'O envio fora do prazo pode impedir a entrega correta das obrigações fiscais (SPED, DCTFWeb, EFD-Reinf, etc.), podendo gerar multas para a empresa. Sem o recebimento das informações no prazo, o escritório não consegue garantir a apuração correta dos impostos.';

/** O último dia útil do mês da competência (sem fim de semana nem feriado nacional): o dia em que o checklist sai. */
export function diaDoChecklist(competencia: string): string {
  const m = COMPETENCIA.exec(competencia);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]), 0);
  while (!diaUtil(d)) d.setDate(d.getDate() - 1);
  return isoDe(d);
}

/** O prazo do cliente: o 2º dia útil do mês seguinte à competência. */
export function prazoDoChecklist(competencia: string): string {
  const m = COMPETENCIA.exec(competencia);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]), 1);
  let uteis = 0;
  for (;;) {
    if (diaUtil(d) && ++uteis === 2) return isoDe(d);
    d.setDate(d.getDate() + 1);
  }
}

/**
 * Qual checklist sai hoje (hoje: 'AAAA-MM-DD' em Brasília): a competência do mês, a partir do último dia útil dele; antes
 * disso, nenhum (null). Se o robô estava parado no dia, ainda sai nos dias seguintes do mesmo mês (o feriado no fim do mês
 * deixa dias corridos depois do último dia útil); no mês seguinte, não sai mais o do mês passado.
 */
export function checklistDeHoje(hoje: string): string | null {
  const m = ISO.exec(String(hoje || ''));
  if (!m) return null;
  const competencia = m[1] + '-' + m[2];
  return hoje >= diaDoChecklist(competencia) ? competencia : null;
}

/** O e-mail do checklist: {cliente}, {mes} ('novembro de 2026'), {prazo} ('02/12/2026'). */
export const EMAIL_DO_CHECKLIST = {
  assunto: 'Checklist de documentos de {mes} · {cliente}',
  texto: 'Olá, {cliente}!\n\nChegou a hora de reunir os documentos de {mes}. Para que possamos apurar os impostos e entregar as declarações sem multas, envie as informações da empresa até {prazo} (2º dia útil do mês seguinte).\n\n' +
    'Abaixo, o checklist do que mandar; o mesmo checklist vai em PDF, anexo.\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nNilma Contabilidade · Departamento Fiscal',
};

export function camposDoChecklist(competencia: string, cliente: string) {
  return { cliente: String(cliente || '').trim() || 'cliente', mes: mesPorExtenso(competencia), prazo: dataBr(prazoDoChecklist(competencia)) };
}

export function emailDoChecklist(competencia: string, cliente: string): { assunto: string; texto: string } {
  const campos = camposDoChecklist(competencia, cliente);
  return { assunto: preencher(EMAIL_DO_CHECKLIST.assunto, campos), texto: preencher(EMAIL_DO_CHECKLIST.texto, campos) };
}

/** O checklist em texto puro (o corpo do e-mail para quem não abre HTML). */
export function checklistEmTexto(): string {
  const linhas: string[] = [CHECKLIST_INTRODUCAO, ''];
  for (const s of CHECKLIST) {
    linhas.push(s.titulo.toUpperCase());
    for (const p of s.paragrafos || []) linhas.push(p);
    if (s.nota) linhas.push(s.nota);
    for (const g of s.grupos) {
      if (g.titulo) linhas.push(g.titulo + ':');
      for (const i of g.itens) linhas.push('  - ' + i);
    }
    if (s.obs) linhas.push('Obs.: ' + s.obs);
    linhas.push('');
  }
  linhas.push('ATENÇÃO: ' + CHECKLIST_ATENCAO);
  return linhas.join('\n');
}

/** O id do registro do checklist de um cliente num mês (um só: o robô cria com create, e o segundo falha). */
export const idDoChecklist = (competencia: string, codigo: number | string) => 'checklist_' + competencia + '_' + String(codigo);

/** config/checklistMensal: pausado (ligado false) e os clientes que não recebem (os códigos). */
export interface ConfigDoChecklist { ligado: boolean; fora: string[] }

export function configDoChecklist(doc: unknown): ConfigDoChecklist {
  const d = doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {};
  const fora = Array.isArray(d.fora) ? [...new Set(d.fora.map(x => String(x ?? '').trim()).filter(x => /^\d+$/.test(x)))] : [];
  return { ligado: d.ligado !== false, fora };
}
