// DP › Envios › Lote (28/10/2026: "uma opção onde eu subo um lote de arquivos, esses arquivos são lidos e organizados para
// dispará-los em lote, após a disparada eles salvam no drive e alimentam o sistema com valores de folha, fgts etc"): a tela
// sobe os arquivos (lotesDp), o robô da nuvem lê cada um com o leitor do arquivador (robo/lote-dp.js), a pessoa revisa e
// dispara; o robô manda um e-mail por cliente, grava no Drive e responde no próprio lote. Interface + a versão de exemplo;
// a do banco é loteDp.firestore.ts.
import { empresas } from '@nads/core';

/** o que o leitor do arquivador achou no arquivo */
export interface LeituraDoArquivo {
  /** ARQUIVAR (identificado) ou NAO_IDENTIFICADO, FICA… */
  acao: string;
  motivo: string;
  cliente: number | null;
  clienteNome: string;
  /** FGTS, DARF, FOLHA… ('' = não reconhecido) */
  tipo: string;
  /** da DARF: INSS, IRRF… */
  tributo: string;
  /** AAAA-MM ('' = não lida) */
  competencia: string;
  /** da guia: 'R$1234,56' */
  valor: string;
  /** da guia: 'DD-MM-AAAA' */
  vencimento: string;
  nomeFinal: string;
  /** as pastas a partir do Meu Drive: [ano, pasta do cliente, ...caminho] */
  destino: string[];
  /** o PDF não tem texto (escaneado): o leitor não leu nada */
  semTexto: boolean;
}

export interface EscolhaDoArquivo { cliente: number; tipo: string; competencia: string }

export interface ArquivoDoLote {
  id: string;
  nome: string;
  tamanho: number;
  /** enviando (subindo), pendente (esperando a leitura), lido, erro */
  status: string;
  erro: string;
  leitura: LeituraDoArquivo | null;
  /** o que a pessoa escolheu na revisão (vale sobre a leitura) */
  escolha: EscolhaDoArquivo | null;
  /** tirado do lote */
  fora: boolean;
}

export interface ResultadoDoLote {
  chave: string;
  codigo: number;
  competencia: string;
  /** enviado ou erro */
  status: string;
  erro: string;
  para: string[];
  enviadoEm: string;
  arquivos: string[];
  salvos: { nome: string; pasta: string; jaEstava: boolean; erro: string }[];
  /** os valores do mês para o sistema: fgts, darf (do INSS) e folha */
  valores: Record<string, number>;
}

export interface LoteDp {
  id: string;
  /** enviando, pendente, lendo, lido, disparar, disparando, disparado, erro */
  status: string;
  criadoEm: string;
  criadoPor: string;
  total: number;
  lidos: number;
  erro: string;
  disparadoPor: string;
  resultados: ResultadoDoLote[];
}

export interface RepoLoteDp {
  exemplos: boolean;
  /** os lotes de quem está no nads, o mais novo primeiro */
  lotes(): { carregados: boolean; lista: LoteDp[] };
  /** os arquivos de um lote, ao vivo */
  arquivos(lote: string, chegou: (lista: ArquivoDoLote[]) => void): () => void;
  /** sobe os arquivos (em pedaços) e entrega o lote ao robô; devolve o id do lote */
  subir(arquivos: readonly { nome: string; bytes: Uint8Array }[], andamento: (feitos: number, total: number) => void): Promise<string>;
  /** a escolha da revisão (null tira a escolha e volta ao que o leitor achou) */
  escolher(lote: string, arquivo: string, escolha: EscolhaDoArquivo | null): Promise<void>;
  /** tira do lote ou põe de volta */
  tirar(lote: string, arquivo: string, fora: boolean): Promise<void>;
  /** pede o disparo ao robô */
  disparar(lote: string): Promise<void>;
  assinar(f: () => void): () => void;
  versao(): number;
}

/** O que o leitor acha, nos exemplos: pelo nome do arquivo (FGTS, DARF, folha) e um cliente do DP. */
function leituraDeExemplo(nome: string, k: number): LeituraDoArquivo {
  const n = nome.toUpperCase();
  const cli = empresas.CLIENTES_DO_DP[(k * 7) % empresas.CLIENTES_DO_DP.length];
  const tipo = /FGTS/.test(n) ? 'FGTS' : /DARF|DCTF/.test(n) ? 'DARF' : /FOLHA|HOLERITE|RECIBO/.test(n) ? 'FOLHA' : '';
  if (!tipo || k % 6 === 5) {
    return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', cliente: null, clienteNome: '', tipo, tributo: '', competencia: '', valor: '', vencimento: '', nomeFinal: '', destino: [], semTexto: k % 6 === 5 };
  }
  const valor = tipo === 'FOLHA' ? '' : 'R$' + (120 + k * 37) + ',' + String(10 + k).slice(-2);
  return {
    acao: 'ARQUIVAR', motivo: '', cliente: cli.codigo, clienteNome: cli.nome, tipo, tributo: tipo === 'DARF' ? 'INSS' : '', competencia: '2026-10',
    valor, vencimento: valor ? '20-11-2026' : '', nomeFinal: tipo === 'FGTS' ? 'FGTS 10-2026.pdf' : nome,
    destino: ['2026', cli.codigo + ' - ' + cli.nome, 'DEPARTAMENTO PESSOAL', '10', tipo], semTexto: false,
  };
}

/** Os exemplos (sem banco): a leitura pelo nome do arquivo e o disparo andam sozinhos. */
export function criarLoteDpMemoria(): RepoLoteDp {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const lotes: LoteDp[] = [];
  const arquivos = new Map<string, ArquivoDoLote[]>();
  const agora = () => new Date().toISOString();
  const doLote = (id: string) => arquivos.get(id) || [];
  const mudarLote = (id: string, m: Partial<LoteDp>) => { const k = lotes.findIndex(l => l.id === id); if (k >= 0) lotes[k] = { ...lotes[k], ...m }; mudou(); };
  const mudarArquivo = (id: string, a: string, m: Partial<ArquivoDoLote>) => { arquivos.set(id, doLote(id).map(x => (x.id === a ? { ...x, ...m } : x))); mudou(); };
  return {
    exemplos: true,
    lotes: () => ({ carregados: true, lista: [...lotes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)) }),
    arquivos(id, chegou) {
      const mandar = () => chegou(doLote(id));
      ouvintes.add(mandar);
      mandar();
      return () => { ouvintes.delete(mandar); };
    },
    async subir(lista, andamento) {
      const id = 'ex-lote-' + Date.now();
      lotes.push({ id, status: 'pendente', criadoEm: agora(), criadoPor: 'exemplo', total: lista.length, lidos: 0, erro: '', disparadoPor: '', resultados: [] });
      arquivos.set(id, lista.map((a, k) => ({ id: String(k), nome: a.nome, tamanho: a.bytes.length, status: 'pendente', erro: '', leitura: null, escolha: null, fora: false })));
      andamento(lista.length, lista.length);
      mudou();
      setTimeout(() => mudarLote(id, { status: 'lendo' }), 500);
      setTimeout(() => {
        arquivos.set(id, doLote(id).map((a, k) => ({ ...a, status: 'lido', leitura: leituraDeExemplo(a.nome, k) })));
        mudarLote(id, { status: 'lido', lidos: lista.length });
      }, 1800);
      return id;
    },
    async escolher(id, a, escolha) { mudarArquivo(id, a, { escolha }); },
    async tirar(id, a, fora) { mudarArquivo(id, a, { fora }); },
    async disparar(id) {
      mudarLote(id, { status: 'disparando', disparadoPor: 'exemplo' });
      setTimeout(() => {
        const porChave = new Map<string, ArquivoDoLote[]>();
        for (const a of doLote(id)) {
          const codigo = a.escolha?.cliente ?? a.leitura?.cliente;
          const comp = a.escolha?.competencia || a.leitura?.competencia;
          if (a.fora || codigo == null || !comp) continue;
          const chave = codigo + '_' + comp;
          porChave.set(chave, [...(porChave.get(chave) || []), a]);
        }
        const resultados: ResultadoDoLote[] = [...porChave].map(([chave, itens]) => {
          const [cod, comp] = chave.split('_');
          const valores: Record<string, number> = {};
          for (const i of itens) {
            const v = Number(String(i.leitura?.valor || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
            if (v && i.leitura?.tipo === 'FGTS') valores.fgts = (valores.fgts || 0) + v;
            if (v && i.leitura?.tipo === 'DARF') valores.darf = (valores.darf || 0) + v;
          }
          return {
            chave, codigo: Number(cod), competencia: comp, status: Number(cod) % 9 === 0 ? 'erro' : 'enviado', erro: Number(cod) % 9 === 0 ? 'o cliente não tem e-mail no cadastro' : '',
            para: ['financeiro@exemplo.com.br'], enviadoEm: agora(), arquivos: itens.map(i => i.nome),
            salvos: itens.map(i => ({ nome: i.nome, pasta: (i.leitura?.destino || []).join('/'), jaEstava: false, erro: '' })), valores,
          };
        });
        mudarLote(id, { status: 'disparado', resultados });
      }, 2000);
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
