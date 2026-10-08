// O SIEG no Fiscal (Vitor, 06/10/2026: "integre a API do SIEG ao app"). O robô do PC do escritório
// (Entregas/scripts/sieg.js) conta as notas de cada cliente na madrugada (siegContagens) e, quando a etapa pede, baixa as
// saídas do mês e grava os números por série e as canceladas (siegSaidas). Aqui: os tipos e a conferência da sequência.
import type { Nota, NotaServico } from '../../conferencia/tipos';

export type TipoDeNota = 'NFe' | 'NFCe' | 'NFSe' | 'CTe' | 'CFe';
export const TIPOS_DE_NOTA: readonly { id: TipoDeNota; rotulo: string }[] = [
  { id: 'NFe', rotulo: 'NF-e' }, { id: 'NFCe', rotulo: 'NFC-e' }, { id: 'NFSe', rotulo: 'NFS-e' }, { id: 'CTe', rotulo: 'CT-e' }, { id: 'CFe', rotulo: 'CF-e' },
];

/** siegContagens/{codigo}_{AAAA-MM}: quantas notas o cliente emitiu e recebeu no mês, por tipo. */
export interface ContagemSieg {
  codigo: string;
  competencia: string;
  /** ISO: quando o robô contou */
  em: string;
  emitidas: Record<TipoDeNota, number>;
  recebidas: Record<TipoDeNota, number>;
}

/** Uma série de notas de saída: os números que existem no SIEG e os cancelados. */
export interface SerieDeSaida { modelo: string; serie: string; numeros: number[]; canceladas: number[]; valor: number }

/** Um item de NF-e/NFC-e no XML. */
export interface ItemDoXml { ncm: string; cfop: string; cst: string; cest: string; valor: number }

/** Uma nota lida do XML do SIEG (o resumo; o arquivo fica na pasta do cliente no Drive). */
export interface NotaDoSieg {
  tipo: 'NF-e' | 'NFC-e' | 'CT-e' | 'NFS-e';
  chave: string; numero: string; serie: string;
  /** dd/mm/aaaa */
  data: string;
  emitente: { doc: string; nome: string };
  destinatario: { doc: string; nome: string };
  valor: number;
  cancelada?: boolean;
  itens?: ItemDoXml[];
  cfop?: string;
  /** NFS-e */
  nbs?: string; descricao?: string; retencoes?: { imposto: string; valor: number }[];
}

/** siegNotas/{codigo}_{AAAA-MM}: o "Baixar XMLs do SIEG" (07/10/2026): onde os XMLs foram salvos e o resumo das notas. */
export interface NotasSieg {
  codigo: string; competencia: string; em: string;
  /** Claudio Secretario/AAAA-MM/<cliente> */
  pasta: string;
  arquivos: number; novos: number;
  emitidas: NotaDoSieg[]; recebidas: NotaDoSieg[];
  /** o resumo passou do tamanho de um documento: saíram os itens */
  itensCortados?: boolean;
}

/** siegSaidas/{codigo}_{AAAA-MM}: as saídas do mês (NF-e e NFC-e), série por série. */
export interface SaidasSieg { codigo: string; competencia: string; em: string; series: SerieDeSaida[] }

export const totalDe = (r: Record<TipoDeNota, number>): number => TIPOS_DE_NOTA.reduce((s, t) => s + (r[t.id] || 0), 0);

export interface ConferenciaDaSerie {
  rotulo: string;
  primeira: number;
  ultima: number;
  /** quantas notas autorizadas (sem as canceladas) */
  autorizadas: number;
  canceladas: number[];
  /** os números entre a primeira e a última que não estão no SIEG (os buracos) */
  faltando: number[];
  valor: number;
}

export interface ConferenciaDeSaidas {
  series: ConferenciaDaSerie[];
  autorizadas: number;
  canceladas: number;
  faltando: number;
  valor: number;
  /** sem buraco nenhum na numeração */
  ok: boolean;
}

const rotuloDoModelo = (m: string) => (m === '65' ? 'NFC-e' : m === '55' ? 'NF-e' : 'Modelo ' + m);

/**
 * A sequência das saídas: série por série, da primeira à última nota do mês, os números que faltam (o buraco pode ser nota
 * não enviada ao SIEG, inutilizada ou emitida fora) e as canceladas. Lista no máximo `maximo` buracos por série.
 */
export function conferirSaidas(s: SaidasSieg, maximo = 200): ConferenciaDeSaidas {
  const series = s.series
    .filter(x => x.numeros.length)
    .map(x => {
      const nums = [...new Set(x.numeros)].sort((a, b) => a - b);
      const tem = new Set(nums);
      const faltando: number[] = [];
      for (let n = nums[0]; n <= nums[nums.length - 1] && faltando.length < maximo; n++) if (!tem.has(n)) faltando.push(n);
      const canceladas = [...new Set(x.canceladas)].sort((a, b) => a - b);
      return {
        rotulo: rotuloDoModelo(x.modelo) + ' · série ' + (x.serie || '0'),
        primeira: nums[0], ultima: nums[nums.length - 1],
        autorizadas: nums.length - canceladas.length, canceladas, faltando, valor: x.valor,
      };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  const faltando = series.reduce((t, x) => t + x.faltando.length, 0);
  return {
    series,
    autorizadas: series.reduce((t, x) => t + x.autorizadas, 0),
    canceladas: series.reduce((t, x) => t + x.canceladas.length, 0),
    faltando,
    valor: Math.round(series.reduce((t, x) => t + x.valor, 0) * 100) / 100,
    ok: faltando === 0,
  };
}

/** Os números em faixas, para mostrar curto: [3,4,5,9] → "3–5, 9". */
export function emFaixas(nums: number[]): string {
  const ord = [...new Set(nums)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < ord.length; i++) {
    let j = i;
    while (j + 1 < ord.length && ord[j + 1] === ord[j] + 1) j++;
    partes.push(j > i ? ord[i] + '–' + ord[j] : String(ord[i]));
    i = j;
  }
  return partes.join(', ');
}

// ---------- os XMLs nas tabelas de verificação (Vitor, 08/10/2026: "usa os dados do xml nas tabelas de verificação") ----------

/** As notas dos XMLs no formato da Conferência: um registro por item da NF-e (NCM, CST, CEST, CFOP) e por NFS-e. */
export interface NotasDoXml { saidas: Nota[]; entradas: Nota[]; prestados: NotaServico[]; tomados: NotaServico[]; itensCortados: boolean }

const ret = (n: NotaDoSieg, imposto: string) => (n.retencoes || []).filter(r => r.imposto === imposto).reduce((t, r) => t + (Number(r.valor) || 0), 0);

/**
 * O resumo do "Baixar XMLs do SIEG" (siegNotas) virado em notas da Conferência, para as mesmas tabelas: NF-e e NFC-e
 * emitidas = saídas, NF-e recebidas = entradas (item por item, o nome é o da outra parte), NFS-e emitidas = prestados e
 * recebidas = tomados (com o NBS, a descrição e as retenções da nota). As canceladas ficam de fora; o CT-e não entra.
 */
export function notasDoXml(x: NotasSieg): NotasDoXml {
  const itens = (n: NotaDoSieg, outra: { doc: string; nome: string }): Nota[] => (n.itens || []).map(i => ({
    cfop: i.cfop, lanc: '', valor: Number(i.valor) || 0, numero: n.numero, nome: outra.nome, data: n.data, desc: '',
    doc: outra.doc, comp: x.competencia, ncm: i.ncm, cst: i.cst, cest: i.cest,
  }));
  const servico = (n: NotaDoSieg, outra: { doc: string; nome: string }): NotaServico => ({
    data: n.data, comp: x.competencia, numero: n.numero, lanc: '', codPart: '', cnpj: outra.doc, nome: outra.nome,
    valor: Number(n.valor) || 0, issRet: ret(n, 'ISS'), inss: ret(n, 'INSS'), irrf: ret(n, 'IRRF'),
    pis: ret(n, 'PIS'), cofins: ret(n, 'COFINS'), csll: ret(n, 'CSLL'), nbs: n.nbs || '', descricao: n.descricao || '',
  });
  const valem = (l: NotaDoSieg[]) => l.filter(n => !n.cancelada);
  const mercadoria = (n: NotaDoSieg) => n.tipo === 'NF-e' || n.tipo === 'NFC-e';
  return {
    saidas: valem(x.emitidas).filter(mercadoria).flatMap(n => itens(n, n.destinatario)),
    entradas: valem(x.recebidas).filter(n => n.tipo === 'NF-e').flatMap(n => itens(n, n.emitente)),
    prestados: valem(x.emitidas).filter(n => n.tipo === 'NFS-e').map(n => servico(n, n.destinatario)),
    tomados: valem(x.recebidas).filter(n => n.tipo === 'NFS-e').map(n => servico(n, n.emitente)),
    itensCortados: !!x.itensCortados,
  };
}

const semZeros = (v: string) => String(v || '').replace(/\D/g, '').replace(/^0+/, '');

/** Uma nota que está no XML e não no relatório do Alterdata. */
export interface NotaQueFalta { numero: string; nome: string; data: string; valor: number; tipo: string }

/**
 * As notas do XML que o Alterdata ainda não tem (pelo número, sem os zeros; mesma lista: saídas com saídas, entradas com
 * entradas). Só NF-e/NFC-e; canceladas não contam.
 */
export function faltamNoAlterdata(doXml: NotaDoSieg[], doAlterdata: readonly Nota[], lado: 'emitidas' | 'recebidas'): NotaQueFalta[] {
  const tem = new Set(doAlterdata.map(n => semZeros(n.numero)));
  const vistas = new Set<string>();
  const faltam: NotaQueFalta[] = [];
  for (const n of doXml) {
    if (n.cancelada || !(n.tipo === 'NF-e' || n.tipo === 'NFC-e')) continue;
    const k = semZeros(n.numero);
    if (!k || tem.has(k) || vistas.has(k + '|' + n.emitente.doc)) continue;
    vistas.add(k + '|' + n.emitente.doc);
    faltam.push({ numero: n.numero, nome: (lado === 'emitidas' ? n.destinatario : n.emitente).nome, data: n.data, valor: Number(n.valor) || 0, tipo: n.tipo });
  }
  return faltam.sort((a, b) => Number(semZeros(a.numero)) - Number(semZeros(b.numero)));
}
