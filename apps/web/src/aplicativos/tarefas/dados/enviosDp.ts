// DP › Envios (27/10/2026: "uma aba de envios, onde vai ser enviado para o gmail do cliente arquivos que já foram
// arquivados nas pastas dos clientes… com um clique de botão num formato padrão via VM do google"): o robô da nuvem
// lista os documentos do DP de cada mês que estão na pasta do cliente (robo/envios-do-dp.js, dpArquivos/{AAAA-MM}); a
// tela escolhe e pede o envio (solicitacoesEmail, tipo envioDp); o robô baixa do Drive e manda pela caixa do escritório
// aos e-mails do cadastro. Interface + a versão de exemplo; a do banco é enviosDp.firestore.ts.
import { empresas } from '@nads/core';

/** um documento do DP do mês na pasta do cliente */
export interface ArquivoDoDp {
  /** o id do arquivo no Drive */
  id: string;
  nome: string;
  /** a pasta onde está, a partir da pasta do cliente ("DEPARTAMENTO PESSOAL/10/FGTS") */
  pasta: string;
  /** em bytes */
  tamanho: number;
}

export interface EnvioDoDp {
  id: string;
  codigo: string;
  empresa: string;
  competencia: string;
  /** pendente (na fila), processando (com o robô), enviado, erro */
  status: string;
  erro: string;
  /** os e-mails para onde foi */
  para: string[];
  /** os nomes dos arquivos que foram */
  enviados: string[];
  /** os ids dos arquivos pedidos (da lista do mês; vazio = todos, como o robô faz) */
  arquivos: string[];
  criadoEm: string;
  criadoPor: string;
  enviadoEm: string;
}

/**
 * O modelo do e-mail (config/envioDp, 28/10/2026: "que nem o de emissão do financeiro"): o assunto e o texto, com {cliente},
 * {competencia} ("10/2026") e {mes} ("outubro de 2026"); vazio = o padrão. O mesmo padrão do robô (robo/envios-do-dp.js).
 */
export interface ModeloDoEnvio { assunto: string; texto: string }
export const MODELO_PADRAO_DO_ENVIO: ModeloDoEnvio = {
  assunto: 'Documentos do Departamento Pessoal · {competencia} · {cliente}',
  texto: 'Olá, {cliente}!\n\nSeguem em anexo os documentos do Departamento Pessoal referentes a {mes}.\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nNilma Contabilidade',
};

export interface RepoEnviosDp {
  exemplos: boolean;
  /** o modelo do e-mail como está no banco (vazio = o padrão) */
  modelo(): { carregado: boolean } & ModeloDoEnvio;
  gravarModelo(m: ModeloDoEnvio): Promise<void>;
  /** os documentos do DP do mês, por código do cliente (o que o robô achou nas pastas) */
  arquivos(competencia: string): { carregados: boolean; porCodigo: ReadonlyMap<string, readonly ArquivoDoDp[]> };
  /**
   * os envios do mês: o mais novo de cada cliente (porCodigo) e todos os do cliente no mês (todosPorCodigo, para saber se
   * todos os arquivos já foram: "Enviar só este" manda um; 30/10/2026)
   */
  envios(competencia: string): { carregados: boolean; porCodigo: ReadonlyMap<string, EnvioDoDp>; todosPorCodigo: ReadonlyMap<string, readonly EnvioDoDp[]> };
  /** tudo o que já foi pedido para o cliente, de todos os meses, o mais novo primeiro (28/10/2026: "ver o que já foi enviado") */
  historico(codigo: number, chegou: (lista: EnvioDoDp[]) => void): () => void;
  /** pede ao robô o e-mail com estes arquivos (os ids da lista do mês) */
  enviar(dados: { codigo: number; empresa: string; competencia: string; arquivos: readonly string[] }): Promise<void>;
  assinar(f: () => void): () => void;
  versao(): number;
}

/** Os exemplos (sem banco): uns documentos inventados para os clientes do DP; o envio anda sozinho. */
export function criarEnviosDpMemoria(): RepoEnviosDp {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const envios = new Map<string, Map<string, EnvioDoDp>>();
  // todos os pedidos (o histórico), na ordem em que foram feitos
  const todos: EnvioDoDp[] = [];
  const listas = new Map<string, Map<string, ArquivoDoDp[]>>();
  let modelo: ModeloDoEnvio = { assunto: '', texto: '' };
  const agora = () => new Date().toISOString();
  function listaDe(competencia: string) {
    if (!listas.has(competencia)) {
      const [ano, mes] = competencia.split('-');
      const m = new Map<string, ArquivoDoDp[]>();
      for (const c of empresas.CLIENTES_DO_DP) {
        if (c.codigo % 5 === 0) continue;
        const cod = String(c.codigo);
        m.set(cod, [
          { id: cod + '-fgts', nome: 'FGTS ' + mes + '-' + ano + '.pdf', pasta: 'DEPARTAMENTO PESSOAL/' + mes + '/FGTS', tamanho: 98000 },
          ...(c.codigo % 3 ? [{ id: cod + '-folha', nome: 'Folha de pagamento ' + mes + '-' + ano + '.pdf', pasta: 'SOCIETÁRIO/FOLHA DE PAGAMENTO/' + ano + '/' + mes, tamanho: 245000 }] : []),
          ...(c.codigo % 2 ? [{ id: cod + '-darf', nome: mes + '-' + ano + ' - DARF INSS - VALOR 1.234,56 - VENCIMENTO 20-' + mes + '-' + ano + '.pdf', pasta: 'FISCAL/SIMPLES NACIONAL/16. DARF', tamanho: 61000 }] : []),
        ]);
      }
      listas.set(competencia, m);
    }
    return listas.get(competencia)!;
  }
  return {
    exemplos: true,
    modelo: () => ({ carregado: true, ...modelo }),
    async gravarModelo(m) { modelo = { ...m }; mudou(); },
    arquivos: competencia => ({ carregados: true, porCodigo: listaDe(competencia) }),
    envios: competencia => {
      const todosPorCodigo = new Map<string, EnvioDoDp[]>();
      for (const e of todos) if (e.competencia === competencia) todosPorCodigo.set(e.codigo, [...(todosPorCodigo.get(e.codigo) || []), e]);
      return { carregados: true, porCodigo: envios.get(competencia) || new Map(), todosPorCodigo };
    },
    historico(codigo, chegou) {
      const mandar = () => chegou(todos.filter(e => e.codigo === String(codigo)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
      ouvintes.add(mandar);
      mandar();
      return () => { ouvintes.delete(mandar); };
    },
    async enviar({ codigo, empresa, competencia, arquivos }) {
      const cod = String(codigo);
      const nomes = (listaDe(competencia).get(cod) || []).filter(a => arquivos.includes(a.id)).map(a => a.nome);
      const base: EnvioDoDp = { id: 'ex-' + cod + '-' + Date.now(), codigo: cod, empresa, competencia, status: 'pendente', erro: '', para: [], enviados: [], arquivos: [...arquivos], criadoEm: agora(), criadoPor: 'exemplo', enviadoEm: '' };
      const doMes = envios.get(competencia) || new Map<string, EnvioDoDp>();
      envios.set(competencia, doMes);
      const por = (m: Partial<EnvioDoDp>) => {
        const novo = { ...(doMes.get(cod)?.id === base.id ? doMes.get(cod)! : base), ...m };
        doMes.set(cod, novo);
        const k = todos.findIndex(e => e.id === base.id);
        if (k >= 0) todos[k] = novo; else todos.push(novo);
        mudou();
      };
      por(base);
      setTimeout(() => por({ status: 'processando' }), 700);
      setTimeout(() => por(codigo % 7 === 0
        ? { status: 'erro', erro: 'o cliente não tem e-mail no cadastro' }
        : { status: 'enviado', enviadoEm: agora(), para: ['financeiro@exemplo.com.br'], enviados: nomes }), 2200);
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
