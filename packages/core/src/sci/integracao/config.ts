// A integração com as APIs da SCI (24/11/2026; o dono: "monta o nads para suportar completamente a integracao do sci mesmo
// que nao vamos usar por agora"). Um documento só, config/sci, liga cada parte. TUDO DESLIGADO enquanto ninguém ligar na
// tela (Configurações › Integração SCI): sem o documento, com campo torto ou faltando, vale "desligado".
//
//   areaCliente        — o cartão "No SCI Report" na Área do Cliente (a função guiasDoSciReport busca na hora);
//   publicarGuias      — no Fiscal › Enviar guias, a via "SCI Report" publica de verdade (SCI Report 24h, publicação manual);
//   lerDeVolta         — o robô lê das guias publicadas se o cliente viu e se informou o pagamento;
//   enviarXmls         — depois de cada "Baixar XMLs" do SIEG, o robô manda as notas ao Integra NET;
//   conferirXmls       — e compara o mês do Integra NET com o do SIEG (o que falta no SCI);
//   rhNet              — o robô atende os pedidos do nads ao RH NET (cadastros, admissões e lançamentos; 25/11/2026).
// `empresas`: os códigos do nads com o SCI ligado (a licença do Integra NET é por empresa, e a empresa de teste entra
// sozinha primeiro). Vazia: nenhuma. `relatorios`: o código do relatório (modelo de imposto) do SCI Report de cada guia.
// Os tokens NUNCA ficam aqui: metadado da VM, arquivo do PC fora do git e Secret Manager da função.

/** As guias que o nads lê e o modelo de imposto do SCI Report de cada uma (o escritório cadastra lá e diz o código aqui). */
export const GUIAS_DO_SCI = [
  { chave: 'DAS', rotulo: 'DAS (Simples Nacional)' },
  { chave: 'DARF-PIS', rotulo: 'DARF do PIS' },
  { chave: 'DARF-COFINS', rotulo: 'DARF da COFINS' },
  { chave: 'DARF-IRPJ', rotulo: 'DARF do IRPJ' },
  { chave: 'DARF-CSLL', rotulo: 'DARF da CSLL' },
  // (27/11/2026) o DARF da DCTFWeb (INSS e IRRF da folha) vai no modelo da guia unificada da DCTFWeb
  { chave: 'DARF-DCTFWEB', rotulo: 'DARF da DCTFWeb (INSS/IRRF)' },
  { chave: 'DARF', rotulo: 'DARF (outros)' },
  { chave: 'DAE-ICMS', rotulo: 'DAE do ICMS normal' },
  // (26/11/2026: "Pode separar") o DAE por coluna do Relatório: cada um com o modelo dele no SCI Report
  { chave: 'DAE-ANTECIPACAO', rotulo: 'DAE da antecipação do ICMS' },
  { chave: 'DAE-DIFAL', rotulo: 'DAE do diferencial de alíquota' },
  { chave: 'DAE-ST-ENTRADA', rotulo: 'DAE do ICMS-ST de entrada' },
  { chave: 'DAE-ST-SAIDA', rotulo: 'DAE do ICMS-ST de saída' },
  { chave: 'DAM-ISS', rotulo: 'DAM do ISS' },
  { chave: 'FGTS', rotulo: 'FGTS' },
  { chave: 'OUTRA', rotulo: 'Outras guias' },
] as const;
export type ChaveDaGuiaNoSci = (typeof GUIAS_DO_SCI)[number]['chave'];

export interface ConfigDoSci {
  areaCliente: boolean;
  publicarGuias: boolean;
  lerDeVolta: boolean;
  enviarXmls: boolean;
  conferirXmls: boolean;
  rhNet: boolean;
  /** códigos do nads com o SCI ligado */
  empresas: number[];
  /** chave da guia → código do relatório no SCI Report (4 posições, maiúsculo) */
  relatorios: Partial<Record<ChaveDaGuiaNoSci, string>>;
  /** (27/11/2026: "cria a lista para esconder a guia de teste da área") as publicações do SCI Report (publicadosId) que a
   *  Área do Cliente não mostra (uma guia de teste, uma publicada por engano), já que a API não apaga publicação */
  ocultas: string[];
  atualizadoEm: string;
  atualizadoPor: string;
}

export const CONFIG_DO_SCI_DESLIGADA: ConfigDoSci = {
  areaCliente: false, publicarGuias: false, lerDeVolta: false, enviarXmls: false, conferirXmls: false, rhNet: false, empresas: [], relatorios: {}, ocultas: [], atualizadoEm: '', atualizadoPor: '',
};

const CHAVES = new Set<string>(GUIAS_DO_SCI.map(g => g.chave));

/** O código do relatório como a SCI normaliza: letras e números, maiúsculo, completado com zeros à esquerda até 4. '' se não serve. */
export function codigoDoRelatorio(v: unknown): string {
  const t = String(v ?? '').trim().toUpperCase();
  if (!/^[0-9A-Z]{1,4}$/.test(t)) return '';
  return t.padStart(4, '0');
}

/** config/sci como vale: o que faltar ou vier torto fica desligado. */
export function configDoSci(doc: unknown): ConfigDoSci {
  const d = doc && typeof doc === 'object' && !Array.isArray(doc) ? (doc as Record<string, unknown>) : {};
  const sim = (k: string) => d[k] === true;
  const empresas = Array.isArray(d.empresas) ? [...new Set(d.empresas.map(Number).filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b) : [];
  const relatorios: ConfigDoSci['relatorios'] = {};
  const r = d.relatorios && typeof d.relatorios === 'object' && !Array.isArray(d.relatorios) ? (d.relatorios as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(r)) { const c = codigoDoRelatorio(v); if (CHAVES.has(k) && c) relatorios[k as ChaveDaGuiaNoSci] = c; }
  return {
    areaCliente: sim('areaCliente'), publicarGuias: sim('publicarGuias'), lerDeVolta: sim('lerDeVolta') && sim('publicarGuias'),
    enviarXmls: sim('enviarXmls'), conferirXmls: sim('conferirXmls'), rhNet: sim('rhNet'), empresas, relatorios,
    ocultas: publicacoesDoTexto(Array.isArray(d.ocultas) ? d.ocultas.join(' ') : ''),
    atualizadoEm: typeof d.atualizadoEm === 'string' ? d.atualizadoEm : '', atualizadoPor: typeof d.atualizadoPor === 'string' ? d.atualizadoPor : '',
  };
}

/** O que a tela grava (só as chaves que a regra aceita; quem e quando vão junto). */
export function documentoDaConfigDoSci(c: ConfigDoSci, por: string, agora: Date): Record<string, unknown> {
  const limpa = configDoSci({ ...c, atualizadoEm: '', atualizadoPor: '' });
  return {
    areaCliente: limpa.areaCliente, publicarGuias: limpa.publicarGuias, lerDeVolta: limpa.lerDeVolta, enviarXmls: limpa.enviarXmls, conferirXmls: limpa.conferirXmls, rhNet: limpa.rhNet,
    empresas: limpa.empresas, relatorios: limpa.relatorios, ocultas: limpa.ocultas, atualizadoEm: agora.toISOString(), atualizadoPor: por,
  };
}

/** "583, 602 607" → [583, 602, 607] (a lista de empresas digitada na tela). */
export function empresasDoTexto(texto: string): number[] {
  return [...new Set(String(texto ?? '').split(/[^\d]+/).map(Number).filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

/** "51643495, 51643496" → ['51643495', '51643496'] (os números das publicações escondidas, digitados na tela). */
export function publicacoesDoTexto(texto: string): string[] {
  return [...new Set(String(texto ?? '').split(/[^\d]+/).filter(n => /^\d{1,12}$/.test(n) && Number(n) > 0))].slice(0, 200);
}

/** As guias do SCI Report sem as escondidas (a Área não mostra nem abre o PDF delas). */
export function semAsOcultas<G extends { id: string }>(guias: readonly G[], ocultas: readonly string[]): G[] {
  const fora = new Set(ocultas);
  return guias.filter(g => !fora.has(String(g.id)));
}

/** A empresa está com o SCI ligado? */
export const empresaNoSci = (c: ConfigDoSci, codigo: number | string) => c.empresas.includes(Number(codigo));

/** A chave da guia no SCI pelo tipo e pelo tributo que o leitor de guias do nads devolve (DAS; DARF + PIS; DAE + ICMS…). */
/** A coluna do Relatório do DAE → a chave dele (a antecipação e o arroz são antecipação; o dif. de uso e o do ativo, diferencial). */
const DAE_PELA_COLUNA: Record<string, ChaveDaGuiaNoSci> = {
  'icms-ant': 'DAE-ANTECIPACAO', 'icms-arroz': 'DAE-ANTECIPACAO', 'icms-dif': 'DAE-DIFAL', 'icms-dif-ativo': 'DAE-DIFAL',
  'st-ent': 'DAE-ST-ENTRADA', 'st-sai': 'DAE-ST-SAIDA', icms: 'DAE-ICMS',
};

export function chaveDaGuiaNoSci(tipo: string, tributo: string, coluna = ''): ChaveDaGuiaNoSci {
  const t = String(tipo ?? '').toUpperCase().trim();
  const tr = String(tributo ?? '').toUpperCase().trim();
  if (t === 'DAE' && DAE_PELA_COLUNA[String(coluna ?? '').trim()]) return DAE_PELA_COLUNA[String(coluna).trim()];
  if (t === 'DAS') return 'DAS';
  if (t === 'FGTS') return 'FGTS';
  if (t === 'DARF' && /^(INSS|IRRF|DCTFWEB)\b/.test(tr.replace(/\s+/g, ''))) return 'DARF-DCTFWEB';
  if (t === 'DARF') return (['PIS', 'COFINS', 'IRPJ', 'CSLL'].includes(tr) ? 'DARF-' + tr : 'DARF') as ChaveDaGuiaNoSci;
  if (t === 'DAE' && tr === 'ICMS') return 'DAE-ICMS';
  if (t === 'DAM' && tr === 'ISS') return 'DAM-ISS';
  return 'OUTRA';
}

/** O código do relatório da guia (a chave dela, senão o de "Outras guias"); '' quando o escritório não disse nenhum. */
export function relatorioDaGuia(c: ConfigDoSci, tipo: string, tributo: string, coluna = ''): string {
  const chave = chaveDaGuiaNoSci(tipo, tributo, coluna);
  return c.relatorios[chave] || (chave.startsWith('DARF-') ? c.relatorios.DARF : '') || c.relatorios.OUTRA || '';
}
