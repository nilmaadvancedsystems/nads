// A Área do Cliente vista pelo escritório (Vitor, 16/10/2026): os links secretos de cada empresa, os chamados que os clientes
// abrem e o que eles mandaram. O contrato dos dados é docs/area-do-cliente/contrato.md. Aqui ficam a interface, as regras
// pequenas (o token, o endereço, o texto do WhatsApp) e a versão de exemplo, em memória; a do banco é areaCliente.firestore.ts.
import type { areaCliente as ac } from '@nads/core';

/** O endereço da Área do Cliente (o site do cliente, fora do nads). */
export const ENDERECO_DA_AREA = 'https://cliente.nilmacontabilidade.com/cliente/';

/** O link de uma empresa como o nads o enxerga (areasClientePorEmpresa/{codigo}): para onde o token aponta. */
export interface LinkDaEmpresa {
  codigo: number;
  /** 40 hexadecimais aleatórios */
  token: string;
  /** ISO: de quando é este link (gerado ou trocado) */
  atualizadoEm: string;
}

/** Uma mensagem do chamado como a equipe guarda: o autor do escritório é o nome da pessoa (o cliente só vê "Escritório"). */
export interface MensagemNaEquipe { de: 'cliente' | 'escritorio'; autor: string; texto: string; em: string }

/** chamados/{id}: o chamado por dentro. */
export interface ChamadoNaEquipe {
  id: string;
  token: string;
  codigos: number[];
  empresa: string;
  tipo: ac.TipoDeChamado;
  titulo: string;
  situacao: ac.SituacaoDoChamado;
  mensagens: MensagemNaEquipe[];
  criadoEm: string;
  atualizadoEm: string;
}

/** areaClienteRecebidos/{id}: um arquivo que o cliente mandou (o robô guarda no Drive do cliente). */
export interface RecebidoDoCliente {
  id: string;
  token: string;
  codigo: number;
  empresa: string;
  nome: string;
  tipo: ac.TipoDeEnvio;
  /** em bytes */
  tamanho: number;
  /** o caminho no Drive, para ler (ex.: "292 › 2026 › Bancos") */
  pastaDrive: string;
  recebidoEm: string;
}

/** Uma coleção ao vivo: `erro` diz por que não leu (regra do banco), e a lista fica vazia. */
export interface ListaAoVivo<T> { carregada: boolean; lista: readonly T[]; erro: string }

export interface EmpresaDoLink { codigo: number; nome: string }

export interface RepoAreaCliente {
  exemplos: boolean;
  /** os links gerados, um por empresa (pedir já começa a ouvir) */
  links(): ListaAoVivo<LinkDaEmpresa>;
  chamados(): ListaAoVivo<ChamadoNaEquipe>;
  recebidos(): ListaAoVivo<RecebidoDoCliente>;
  /** gera o link da empresa (se ela já tem, devolve o que existe) */
  gerar(empresa: EmpresaDoLink): Promise<LinkDaEmpresa>;
  /** cria outro token e apaga o antigo: o link velho para de funcionar */
  trocar(empresa: EmpresaDoLink): Promise<LinkDaEmpresa>;
  /** apaga o link: o cliente deixa de ver a área */
  revogar(codigo: number): Promise<void>;
  /** acrescenta a resposta do escritório e passa o chamado para "respondido" */
  responder(chamadoId: string, texto: string): Promise<void>;
  mudarSituacao(chamadoId: string, situacao: ac.SituacaoDoChamado): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** 20 bytes aleatórios do navegador = 40 hexadecimais (o segredo do link; sem senha, o token é a chave). */
export function novoToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export const tokenValido = (t: string) => /^[0-9a-f]{40}$/.test(t);

export const enderecoDoLink = (token: string) => ENDERECO_DA_AREA + token;

/** O texto pronto do WhatsApp com o link da empresa. */
export function textoDoWhatsApp(empresa: string, endereco: string): string {
  return 'Olá! Aqui é da Nilma Contabilidade. Este é o seu acesso à Área do Cliente da ' + empresa + ': guias, vencimentos, '
    + 'chamados e envio de documentos. É um link só seu, não compartilhe com outras pessoas:\n' + endereco;
}

export const SITUACOES_DO_CHAMADO: readonly ac.SituacaoDoChamado[] = ['aberto', 'em andamento', 'respondido', 'concluido'];

/** Mais recente primeiro. */
export const maisRecente = <T extends { atualizadoEm: string }>(a: T, b: T) => b.atualizadoEm.localeCompare(a.atualizadoEm);

// ─── a versão de exemplo, em memória (nada vai para o banco; some ao recarregar) ────────────────────────────────

const ha = (minutos: number) => new Date(Date.now() - minutos * 60000).toISOString();

const TOKENS_DE_EXEMPLO = [
  '9f2c1a7e4b8d0356ac91e2f7d4b6a80c13e5f792',
  '3b7d90e1c5a4f8268d1e0b93a7c5f4e2d6819a0b',
  '0c4e8a2f6b1d9375e5a3c7f1b9d2048a6e3f5c71',
];

export function criarAreaClienteMemoria(quem: () => string): RepoAreaCliente {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let links: LinkDaEmpresa[] = [
    { codigo: 462, token: TOKENS_DE_EXEMPLO[0], atualizadoEm: ha(60 * 24 * 12) },
    { codigo: 356, token: TOKENS_DE_EXEMPLO[1], atualizadoEm: ha(60 * 24 * 5) },
    { codigo: 515, token: TOKENS_DE_EXEMPLO[2], atualizadoEm: ha(60 * 24) },
  ];
  // a 4ª empresa de exemplo (205) fica sem link, para ver o "Gerar"
  const tokenDe = (codigo: number) => links.find(l => l.codigo === codigo)?.token || '';
  let chamados: ChamadoNaEquipe[] = [
    {
      id: 'ex-1', token: tokenDe(462), codigos: [462], empresa: '3M EMPREENDIMENTOS FLORESTAIS LTDA', tipo: 'admissao',
      titulo: 'Contratar um ajudante de campo', situacao: 'aberto', criadoEm: ha(190), atualizadoEm: ha(35),
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Vamos contratar o Marcos como ajudante de campo, começa dia 1º de novembro. O que preciso mandar?', em: ha(190) },
        { de: 'escritorio', autor: 'Camila', texto: 'Oi! Precisamos do RG, CPF, comprovante de residência, carteira de trabalho e o exame admissional.', em: ha(120) },
        { de: 'cliente', autor: 'Você', texto: 'O exame admissional eu faço onde? Já tenho o PCMSO.', em: ha(35) },
      ],
    },
    {
      id: 'ex-2', token: tokenDe(356), codigos: [356], empresa: 'A7 COMERCIO DE VEICULOS LTDA', tipo: 'documento',
      titulo: 'Certidão negativa de débitos', situacao: 'respondido', criadoEm: ha(60 * 26), atualizadoEm: ha(60 * 20),
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Preciso da certidão negativa federal para uma concorrência.', em: ha(60 * 26) },
        { de: 'escritorio', autor: 'Vitor', texto: 'Emitida e anexada aos Documentos da sua área. Vale por 180 dias.', em: ha(60 * 20) },
      ],
    },
  ];
  const recebidos: RecebidoDoCliente[] = [
    { id: 'rx-1', token: tokenDe(462), codigo: 462, empresa: '3M EMPREENDIMENTOS FLORESTAIS LTDA', nome: 'extrato-sicoob-setembro.pdf', tipo: 'extrato', tamanho: 482113, pastaDrive: '462 › 2026 › Bancos › Sicoob', recebidoEm: ha(75) },
    { id: 'rx-2', token: tokenDe(515), codigo: 515, empresa: 'A7 MOBILE LTDA', nome: 'nfe-compra-1043.xml', tipo: 'nota', tamanho: 18340, pastaDrive: '515 › 2026 › Notas', recebidoEm: ha(60 * 6) },
    { id: 'rx-3', token: tokenDe(356), codigo: 356, empresa: 'A7 COMERCIO DE VEICULOS LTDA', nome: 'comprovante-das-setembro.jpg', tipo: 'comprovante', tamanho: 1294870, pastaDrive: '356 › 2026 › Comprovantes', recebidoEm: ha(60 * 30) },
  ];
  const vazio = <T,>(lista: readonly T[]): ListaAoVivo<T> => ({ carregada: true, lista, erro: '' });
  return {
    exemplos: true,
    links: () => vazio(links),
    chamados: () => vazio(chamados),
    recebidos: () => vazio(recebidos),
    async gerar(e) {
      const ja = links.find(l => l.codigo === e.codigo);
      if (ja) return ja;
      const novo = { codigo: e.codigo, token: novoToken(), atualizadoEm: new Date().toISOString() };
      links = [...links, novo];
      mudou();
      return novo;
    },
    async trocar(e) {
      const novo = { codigo: e.codigo, token: novoToken(), atualizadoEm: new Date().toISOString() };
      links = [...links.filter(l => l.codigo !== e.codigo), novo];
      mudou();
      return novo;
    },
    async revogar(codigo) {
      links = links.filter(l => l.codigo !== codigo);
      mudou();
    },
    async responder(id, texto) {
      const agora = new Date().toISOString();
      chamados = chamados.map(c => (c.id === id
        ? { ...c, situacao: 'respondido' as const, atualizadoEm: agora, mensagens: [...c.mensagens, { de: 'escritorio' as const, autor: quem() || 'Escritório', texto, em: agora }] }
        : c));
      mudou();
    },
    async mudarSituacao(id, situacao) {
      chamados = chamados.map(c => (c.id === id ? { ...c, situacao, atualizadoEm: new Date().toISOString() } : c));
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
