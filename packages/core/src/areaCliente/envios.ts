// Os envios do cliente na Área do Cliente (Vitor, 16/10/2026): extratos, notas e comprovantes. O cliente só cria na
// caixa de entrada (areaClienteEnvios); o robô valida, guarda no Drive e apaga a caixa; o recibo volta em
// areasCliente/{token}/envios/{id} SÓ com o que sai daqui.

export type TipoDeEnvio = 'extrato' | 'nota' | 'comprovante' | 'outro';

export interface ReciboDeEnvio {
  id: string;
  nome: string;
  tipo: TipoDeEnvio;
  /** em bytes */
  tamanho: number;
  /** ISO */
  recebidoEm: string;
}

/** O envio como o robô o guarda: com o caminho no Drive, a situação do processamento, erro e tentativas (nada disso sai). */
export interface EnvioInterno {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  recebidoEm: string;
}

export const TIPOS_DE_ENVIO: { valor: TipoDeEnvio; rotulo: string }[] = [
  { valor: 'extrato', rotulo: 'Extrato do banco' },
  { valor: 'nota', rotulo: 'Nota fiscal' },
  { valor: 'comprovante', rotulo: 'Comprovante' },
  { valor: 'outro', rotulo: 'Outro documento' },
];

export const EXTENSOES_ACEITAS = ['pdf', 'jpg', 'jpeg', 'png', 'xml', 'zip'];
/** o atributo accept do campo de arquivos */
export const ACEITAR_NO_CAMPO = EXTENSOES_ACEITAS.map(e => '.' + e).join(',');
export const MAIOR_ENVIO = 15 * 1024 * 1024;

const TIPOS = new Set<string>(TIPOS_DE_ENVIO.map(t => t.valor));

/** Confere um arquivo antes de mandar; devolve o erro em português, ou '' se está bom. */
export function erroDoEnvio(arquivo: { nome: string; tamanho: number }): string {
  const ext = (arquivo.nome.split('.').pop() || '').toLowerCase();
  if (!EXTENSOES_ACEITAS.includes(ext)) return arquivo.nome + ': só aceitamos PDF, JPG, PNG, XML e ZIP.';
  if (arquivo.tamanho <= 0) return arquivo.nome + ': o arquivo está vazio.';
  if (arquivo.tamanho > MAIOR_ENVIO) return arquivo.nome + ': passa de 15 MB.';
  return '';
}

/** O recibo que o cliente vê: lista branca de campos. */
export function reciboDoEnvio(e: EnvioInterno): ReciboDeEnvio {
  return { id: e.id, nome: e.nome, tipo: (TIPOS.has(e.tipo) ? e.tipo : 'outro') as TipoDeEnvio, tamanho: e.tamanho, recebidoEm: e.recebidoEm };
}

/** "2,3 MB", "480 KB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
