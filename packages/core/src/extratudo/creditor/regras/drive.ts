// O relatório de liquidação ("credliquidação") na pasta da empresa no Drive do escritório.
// Pedido do Vitor (2026-09-29): ao escolher a competência, o Creditor já puxa o arquivo de
//   2026 › <código> - <RAZÃO SOCIAL> › CONTÁBIL › RECEBIMENTO DE CLIENTES
// O Drive é o do app Pendências (projeto Entregas): um robô mantém o mapa das pastas no banco
// (driveIndice) e traz a cópia do arquivo quando alguém pede (aberturasDrive). Aqui só as regras de
// achar o arquivo no mapa; quem fala com o banco é o dados/drive.firestore.ts do Extratudo.
import { nomeNorm } from '../../../formatos';
import { MESES, partesDaCompetencia, type Competencia } from './competencia';

/** Um item do mapa do Drive, do jeito que o robô grava (driveIndice/{pasta}/partes/{n}.itens). */
export interface ItemDrive {
  /** id no Drive */
  i: string;
  /** nome */
  n: string;
  /** id da pasta de cima */
  p: string;
  /** d = pasta, f = arquivo, g = documento do Google */
  t: 'd' | 'f' | 'g';
  /** tamanho (bytes) */
  s?: number;
  /** modificado em (ISO) */
  m?: string;
  x?: string;
}

/** Pasta de cliente no mapa (driveIndice/raiz.clientes). */
export interface PastaDoCliente {
  id: string;
  nomePasta: string;
  codigo: string | number | null;
}

/** A pasta do cliente pelo código do ERP ("292 - FITO…" → 292). */
export function pastaDoCliente(clientes: readonly PastaDoCliente[], codigo: number | null): PastaDoCliente | null {
  if (codigo == null) return null;
  return clientes.find(c => String(c.codigo ?? '').trim() === String(codigo)) || null;
}

/** O caminho dentro da pasta do cliente até o recebimento de clientes. */
export const CAMINHO_RECEBIMENTO = ['CONTÁBIL', 'RECEBIMENTO DE CLIENTES'];

const ehPasta = (it: ItemDrive) => it.t === 'd';
const EXTENSOES = /\.(pdf|xlsx?|csv|txt)$/i;

/** A pasta "RECEBIMENTO DE CLIENTES" do cliente (null = não existe no mapa). */
export function pastaDoRecebimento(itens: readonly ItemDrive[], raizDoCliente: string): ItemDrive | null {
  const filhos = (p: string) => itens.filter(it => it.p === p && ehPasta(it));
  const contabil = filhos(raizDoCliente).find(it => nomeNorm(it.n) === 'contabil');
  if (!contabil) return null;
  return filhos(contabil.i).find(it => /\brecebimentos? (de )?clientes?\b/.test(nomeNorm(it.n))) || null;
}

/** O nome (ou o caminho) fala da competência? "08-2026", "2026/08", "082026", "AGOSTO 2026", "AGO26"… */
export function falaDaCompetencia(texto: string, c: Competencia): boolean {
  const { ano, mes } = partesDaCompetencia(c);
  const t = nomeNorm(texto);
  const aa = String(ano).slice(2);
  const mm = '0?' + mes;
  const nome = nomeNorm(MESES[mes - 1]);
  const anos = '(' + ano + '|' + aa + ')';
  return new RegExp('\\b' + mm + ' ?' + anos + '\\b').test(t)
    || new RegExp('\\b' + ano + ' ?' + mm + '\\b').test(t)
    || new RegExp('\\b(' + nome + '|' + nome.slice(0, 3) + ') ?' + anos + '\\b').test(t)
    || (new RegExp('\\b' + ano + '\\b').test(t) && new RegExp('(^| )(' + mm + '|' + nome + ')( |$)').test(t));
}

export interface ArquivoAchado {
  id: string;
  nome: string;
  /** o caminho a partir de RECEBIMENTO DE CLIENTES ("2026 › 08 › CREDLIQUIDAÇÃO 08-2026.pdf") */
  caminho: string;
  modificado?: string;
  /** o nome tem "credliquid" */
  credliquidacao: boolean;
  /** o nome ou as pastas falam da competência */
  daCompetencia: boolean;
}

export interface BuscaNoDrive {
  /** o que deu (para a tela) */
  situacao: 'sem-cliente' | 'sem-pasta' | 'nada' | 'achou' | 'varios';
  /** o arquivo escolhido (situação "achou") */
  arquivo: ArquivoAchado | null;
  /** os candidatos, do melhor para o pior (para a pessoa escolher quando não dá para decidir) */
  candidatos: ArquivoAchado[];
}

/**
 * Procura o relatório da competência na pasta RECEBIMENTO DE CLIENTES (e nas pastas dentro dela):
 * 1. arquivo com "credliquid" no nome e a competência no nome ou nas pastas;
 * 2. sem "credliquid", qualquer arquivo lido pelo Creditor com a competência.
 * Um só → achou. Mais de um → o mais novo vai na frente, mas a pessoa escolhe.
 */
export function acharRelatorioNoDrive(itens: readonly ItemDrive[], raizDoCliente: string | null, c: Competencia): BuscaNoDrive {
  if (!raizDoCliente) return { situacao: 'sem-cliente', arquivo: null, candidatos: [] };
  const rec = pastaDoRecebimento(itens, raizDoCliente);
  if (!rec) return { situacao: 'sem-pasta', arquivo: null, candidatos: [] };
  const filhos = new Map<string, ItemDrive[]>();
  for (const it of itens) filhos.set(it.p, [...(filhos.get(it.p) || []), it]);
  const achados: ArquivoAchado[] = [];
  const andar = (pasta: string, caminho: string[]) => {
    for (const it of filhos.get(pasta) || []) {
      if (ehPasta(it)) { andar(it.i, [...caminho, it.n]); continue; }
      if (it.t !== 'f' || !EXTENSOES.test(it.n)) continue;
      const texto = [...caminho, it.n].join(' ');
      achados.push({
        id: it.i, nome: it.n, caminho: [...caminho, it.n].join(' › '), modificado: it.m,
        credliquidacao: /cred ?liquid/.test(nomeNorm(it.n)), daCompetencia: falaDaCompetencia(texto, c),
      });
    }
  };
  andar(rec.i, []);
  const maisNovo = (a: ArquivoAchado, b: ArquivoAchado) => (b.modificado || '').localeCompare(a.modificado || '');
  const cred = achados.filter(a => a.credliquidacao && a.daCompetencia).sort(maisNovo);
  const outros = achados.filter(a => !a.credliquidacao && a.daCompetencia).sort(maisNovo);
  const escolha = cred.length ? cred : outros;
  // os de outras competências ficam no fim da lista, para quem quiser escolher à mão
  const resto = achados.filter(a => !a.daCompetencia).sort((a, b) => Number(b.credliquidacao) - Number(a.credliquidacao) || maisNovo(a, b));
  const candidatos = [...escolha, ...(cred.length ? outros : []), ...resto];
  if (escolha.length === 1) return { situacao: 'achou', arquivo: escolha[0], candidatos };
  if (escolha.length > 1) return { situacao: 'varios', arquivo: null, candidatos };
  return { situacao: 'nada', arquivo: null, candidatos };
}

/** A frase da tela para cada situação. */
export function mensagemDaBusca(b: BuscaNoDrive, competencia: string): string {
  switch (b.situacao) {
    case 'sem-cliente': return 'A empresa não tem pasta no Drive (a pasta do ano precisa de "<código> - <nome>").';
    case 'sem-pasta': return 'A pasta da empresa no Drive não tem CONTÁBIL › RECEBIMENTO DE CLIENTES.';
    case 'nada': return 'Não achei o relatório de ' + competencia + ' em RECEBIMENTO DE CLIENTES' + (b.candidatos.length ? ': escolha um dos arquivos abaixo ou anexe à mão.' : '. Anexe à mão.');
    case 'varios': return 'Achei mais de um arquivo de ' + competencia + ': escolha qual usar.';
    case 'achou': return 'Achei ' + (b.arquivo?.caminho || '') + '.';
  }
}
