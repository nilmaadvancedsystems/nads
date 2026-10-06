// O SIEG no Fiscal (Vitor, 06/10/2026: "integre a API do SIEG ao app"). O robô do PC do escritório
// (Entregas/scripts/sieg.js) conta as notas de cada cliente na madrugada (siegContagens) e, quando a etapa pede, baixa as
// saídas do mês e grava os números por série e as canceladas (siegSaidas). Aqui: os tipos e a conferência da sequência.

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
