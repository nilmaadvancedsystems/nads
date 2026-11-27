// A Área do Cliente vista pelo escritório (Vitor, 16/10/2026): os links secretos de cada empresa, os chamados que os clientes
// abrem e o que eles mandaram. O contrato dos dados é docs/area-do-cliente/contrato.md. Aqui ficam a interface, as regras
// pequenas (o token, o endereço, o texto do WhatsApp) e a versão de exemplo, em memória; a do banco é areaCliente.firestore.ts.
import { areaCliente as ac } from '@nads/core';

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

/**
 * Uma pessoa da empresa cliente com senha na Área do Cliente (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por pessoa"; docs/acessorias/desenho-senha-por-pessoa.md):
 * areaClientePessoas/{id}, uma ficha por pessoa e empresa (o código, não o link: trocar o link não tira a senha). O robô
 * da nuvem cria o login e responde na ficha (situacao, erro).
 */
export interface PessoaComSenha {
  id: string;
  codigo: number;
  nome: string;
  email: string;
  ativo: boolean;
  /** 'esperando' = o robô ainda não criou o login; 'pronto' = já entra; 'erro' = o robô não conseguiu (erro diz por quê) */
  situacao: 'esperando' | 'pronto' | 'erro';
  erro: string;
  criadoEm: string;
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
  /** a nota que o cliente deu na concluída (o robô grava) (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento; frase do dono: "Seguir") */
  avaliacao: { nota: number; comentario: string; em: string } | null;
  /** os passos marcados do pedido do DP ({ nome: ISO }; 23/11/2026, ficha processos-visiveis) */
  passos: Record<string, string>;
  /** (26/11/2026: "eu tenho que ter como aprovar pelo nads") a admissão no sistema de folha (RH NET), que o robô grava */
  rhnet?: { situacao: string; id: number; erro: string; erroLiberacao?: string } | null;
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
  /** o nome final do arquivo na pasta (o robô não repete nome: "extrato (2).pdf"); '' nos antigos: vale o nome (26/11/2026, a prévia nos Recebidos) */
  arquivoDrive: string;
  recebidoEm: string;
  /** o comprovante mandado pela guia: de que guia é ("Comprovante do FGTS 10/2026"); '' nos outros (plano do Acessórias, 18/11/2026, ficha comprovante-da-guia, parte B; frase do dono: "Seguir") */
  guia: string;
  /** a recusa do escritório, quando o robô já tratou (22/11/2026, Documentos do cliente) */
  recusa?: { motivo: string; por: string; em: string };
}

/** Uma coleção ao vivo: `erro` diz por que não leu (regra do banco), e a lista fica vazia. */
export interface ListaAoVivo<T> { carregada: boolean; lista: readonly T[]; erro: string }

/** O comunicado como a tela escreve (sem id, quem publicou e a hora: o repositório põe). */
export type RascunhoDoComunicado = Pick<ac.Comunicado, 'titulo' | 'texto' | 'alvo' | 'publicarEm' | 'ate'>;

export interface EmpresaDoLink { codigo: number; nome: string }

/** logosDasEmpresas/{codigo} (12/11/2026): a logo que a Área do Cliente mostra no topo, como data URL (PNG/JPG/WebP). */
export interface LogoDaEmpresa { codigo: number; logo: string; atualizadoEm: string }

/** Quando o cliente abriu (baixou) uma guia na Área do Cliente (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura): areaClienteLeituras, só o robô grava. */
export interface LeituraDaGuia { token: string; guiaId: string; tipo: string; competencia: string; primeiraEm: string; ultimaEm: string; vezes: number }

export interface RepoAreaCliente {
  exemplos: boolean;
  /** os links gerados, um por empresa (pedir já começa a ouvir) */
  links(): ListaAoVivo<LinkDaEmpresa>;
  chamados(): ListaAoVivo<ChamadoNaEquipe>;
  recebidos(): ListaAoVivo<RecebidoDoCliente>;
  /** os comunicados aos clientes (22/11/2026, ficha comunicados; o dono: "pode fazer tudo") */
  comunicados(): ListaAoVivo<ac.Comunicado>;
  /** grava o comunicado (sem id: um novo); só admin e diretores. Erro em português */
  salvarComunicado(c: RascunhoDoComunicado, id?: string): Promise<void>;
  apagarComunicado(id: string): Promise<void>;
  /** recusa o arquivo com o motivo que o cliente vê (22/11/2026, Documentos do cliente): grava areaClienteRecusas/{id}; o robô faz o resto. Erro em português */
  recusar(id: string, motivo: string): Promise<void>;
  /** gera o link da empresa (se ela já tem, devolve o que existe) */
  gerar(empresa: EmpresaDoLink): Promise<LinkDaEmpresa>;
  /** cria outro token e apaga o antigo: o link velho para de funcionar */
  trocar(empresa: EmpresaDoLink): Promise<LinkDaEmpresa>;
  /** apaga o link: o cliente deixa de ver a área */
  revogar(codigo: number): Promise<void>;
  /** as logos das empresas (a Área do Cliente mostra no topo) */
  logos(): ListaAoVivo<LogoDaEmpresa>;
  /** as guias que os clientes abriram (as dos últimos 4 meses) (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura); erro = a regra do Vitor ainda não saiu */
  leituras(): ListaAoVivo<LeituraDaGuia>;
  /** grava a logo da empresa (o data URL já diminuído e conferido por erroDaLogo) */
  gravarLogo(codigo: number, logo: string): Promise<void>;
  apagarLogo(codigo: number): Promise<void>;
  /** acrescenta a resposta do escritório e passa o chamado para "respondido" */
  responder(chamadoId: string, texto: string): Promise<void>;
  mudarSituacao(chamadoId: string, situacao: ac.SituacaoDoChamado): Promise<void>;
  /** marca (ou desmarca) um passo do pedido do DP; o cliente vê só o atual (23/11/2026, ficha processos-visiveis) */
  marcarPasso(chamadoId: string, passo: string, marcar: boolean): Promise<void>;
  /** as pessoas com senha (todas as empresas; pedir já começa a ouvir) (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por pessoa"; docs/acessorias/desenho-senha-por-pessoa.md) */
  pessoas(): ListaAoVivo<PessoaComSenha>;
  /** cadastra a pessoa na empresa (o robô cria o login); o e-mail repetido na mesma empresa religa a ficha */
  adicionarPessoa(codigo: number, nome: string, email: string): Promise<void>;
  /** tira o acesso da pessoa a esta empresa (o robô derruba as sessões) */
  tirarPessoa(id: string): Promise<void>;
  /** o link pede senha? (areasCliente/{token}.exigeSenha; pedir já começa a ouvir) */
  exigeSenha(token: string): { carregado: boolean; ligado: boolean };
  mudarExigeSenha(token: string, ligado: boolean): Promise<void>;
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
    + 'solicitações e envio de documentos. É um link só seu, não compartilhe com outras pessoas:\n' + endereco;
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
    { passos: {},
      id: 'ex-1', token: tokenDe(462), codigos: [462], empresa: '3M EMPREENDIMENTOS FLORESTAIS LTDA', tipo: 'admissao',
      titulo: 'Contratar um ajudante de campo', situacao: 'aberto', criadoEm: ha(190), atualizadoEm: ha(35), avaliacao: null,
      // a admissão já cadastrada no RH NET, esperando o Liberar para a folha (26/11/2026)
      rhnet: { situacao: 'cadastrado', id: 900001, erro: '', erroLiberacao: 'o RH NET não liberou: O campo PIS é obrigatório. O campo quadro de horário é obrigatório.' },
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Vamos contratar o Marcos como ajudante de campo, começa dia 1º de novembro. O que preciso mandar?', em: ha(190) },
        { de: 'escritorio', autor: 'Camila', texto: 'Oi! Precisamos do RG, CPF, comprovante de residência, carteira de trabalho e o exame admissional.', em: ha(120) },
        { de: 'cliente', autor: 'Você', texto: 'O exame admissional eu faço onde? Já tenho o PCMSO.', em: ha(35) },
      ],
    },
    { passos: {},
      id: 'ex-2', token: tokenDe(356), codigos: [356], empresa: 'A7 COMERCIO DE VEICULOS LTDA', tipo: 'documento',
      titulo: 'Certidão negativa de débitos', situacao: 'respondido', criadoEm: ha(60 * 26), atualizadoEm: ha(60 * 20), avaliacao: null,
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Preciso da certidão negativa federal para uma concorrência.', em: ha(60 * 26) },
        { de: 'escritorio', autor: 'Vitor', texto: 'Emitida e anexada aos Documentos da sua área. Vale por 180 dias.', em: ha(60 * 20) },
      ],
    },
    // a concluída e avaliada (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento; frase do dono: "Seguir")
    { passos: {},
      id: 'ex-3', token: tokenDe(515), codigos: [515], empresa: 'A7 MOBILE LTDA', tipo: 'documento',
      titulo: 'Segunda via do contrato social', situacao: 'concluido', criadoEm: ha(60 * 50), atualizadoEm: ha(60 * 40),
      avaliacao: { nota: 5, comentario: 'Resolveram no mesmo dia, obrigado!', em: ha(60 * 30) },
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Preciso da segunda via do contrato social para o banco.', em: ha(60 * 50) },
        { de: 'escritorio', autor: 'Vitor', texto: 'Está em Documentos, na pasta Societário.', em: ha(60 * 40) },
      ],
    },
  ];
  // um comunicado de exemplo (22/11/2026, ficha comunicados)
  const comunicados: ac.Comunicado[] = [{ id: 'com-1', titulo: 'Recesso de fim de ano', texto: 'O escritório fecha de 24/12 a 02/01. As guias de dezembro saem até o dia 20.', alvo: { todos: true }, publicarEm: '2026-12-01', ate: '2027-01-02', por: 'Vitor', atualizadoEm: '2026-11-22T10:00:00.000Z' }];
  const recebidos: RecebidoDoCliente[] = [
    { id: 'rx-1', token: tokenDe(462), codigo: 462, empresa: '3M EMPREENDIMENTOS FLORESTAIS LTDA', nome: 'extrato-sicoob-setembro.pdf', tipo: 'extrato', tamanho: 482113, pastaDrive: '2026/462 - 3M EMPREENDIMENTOS FLORESTAIS LTDA/ÁREA DO CLIENTE/10', arquivoDrive: 'extrato-sicoob-setembro.pdf', recebidoEm: ha(75), guia: '' },
    { id: 'rx-2', token: tokenDe(515), codigo: 515, empresa: 'A7 MOBILE LTDA', nome: 'nfe-compra-1043.xml', tipo: 'nota', tamanho: 18340, pastaDrive: '2026/515 - A7 MOBILE LTDA/ÁREA DO CLIENTE/11', arquivoDrive: 'nfe-compra-1043.xml', recebidoEm: ha(60 * 6), guia: '' },
    { id: 'rx-3', token: tokenDe(356), codigo: 356, empresa: 'A7 COMERCIO DE VEICULOS LTDA', nome: 'Comprovante DAS 09-2026 - pix.jpg', tipo: 'comprovante', tamanho: 1294870, pastaDrive: '2026/356 - A7 COMERCIO DE VEICULOS LTDA/ÁREA DO CLIENTE/11', arquivoDrive: 'Comprovante DAS 09-2026 - pix.jpg', recebidoEm: ha(60 * 30), guia: 'Comprovante do DAS 09/2026' },
  ];
  const vazio = <T,>(lista: readonly T[]): ListaAoVivo<T> => ({ carregada: true, lista, erro: '' });
  let logos: LogoDaEmpresa[] = [];
  // as pessoas com senha de exemplo (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por pessoa"; docs/acessorias/desenho-senha-por-pessoa.md)
  let pessoas: PessoaComSenha[] = [
    { id: 'px-1', codigo: 462, nome: 'Marcos Dias', email: 'marcos@exemplo.com.br', ativo: true, situacao: 'pronto', erro: '', criadoEm: ha(60 * 48) },
    { id: 'px-2', codigo: 462, nome: 'Ana do RH', email: 'rh@exemplo.com.br', ativo: true, situacao: 'esperando', erro: '', criadoEm: ha(10) },
  ];
  const comSenha = new Set<string>();
  return {
    exemplos: true,
    links: () => vazio(links),
    logos: () => vazio(logos),
    // a guia aberta de exemplo (ficha comprovante-de-leitura)
    leituras: () => vazio([{ token: tokenDe(462), guiaId: 'das-2026-10-462', tipo: 'DAS', competencia: '2026-10', primeiraEm: ha(60 * 20), ultimaEm: ha(60 * 2), vezes: 3 }]),
    async gravarLogo(codigo, logo) { logos = [...logos.filter(l => l.codigo !== codigo), { codigo, logo, atualizadoEm: new Date().toISOString() }]; mudou(); },
    async apagarLogo(codigo) { logos = logos.filter(l => l.codigo !== codigo); mudou(); },
    chamados: () => vazio(chamados),
    recebidos: () => vazio(recebidos),
    comunicados: () => vazio(comunicados),
    async salvarComunicado(c, id) {
      const erro = ac.erroDoComunicado(c);
      if (erro) throw new Error(erro);
      const novo: ac.Comunicado = { ...c, titulo: c.titulo.trim(), texto: c.texto.trim(), id: id || 'com-' + Date.now(), por: 'Você (exemplo)', atualizadoEm: new Date().toISOString() };
      const i = comunicados.findIndex(x => x.id === novo.id);
      if (i >= 0) comunicados[i] = novo; else comunicados.unshift(novo);
    },
    async apagarComunicado(id) { const i = comunicados.findIndex(x => x.id === id); if (i >= 0) comunicados.splice(i, 1); },
    async recusar(id, motivo) {
      const erro = ac.erroDaRecusa(motivo);
      if (erro) throw new Error(erro);
      const r = recebidos.find(x => x.id === id);
      if (r) r.recusa = { motivo: motivo.trim(), por: 'Você (exemplo)', em: new Date().toISOString() };
    },
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
    async marcarPasso(id, passo, marcar) {
      const agora = new Date().toISOString();
      chamados = chamados.map(c => (c.id === id ? { ...c, passos: ac.marcarPasso(c.tipo, c.passos, passo, marcar, agora), atualizadoEm: agora } : c));
      mudou();
    },
    pessoas: () => vazio(pessoas.filter(p => p.ativo)),
    async adicionarPessoa(codigo, nome, email) {
      const e = email.trim().toLowerCase();
      const ja = pessoas.find(p => p.codigo === codigo && p.email === e);
      pessoas = ja ? pessoas.map(p => (p === ja ? { ...p, nome: nome.trim(), ativo: true } : p))
        : [...pessoas, { id: 'px-' + (pessoas.length + 1), codigo, nome: nome.trim(), email: e, ativo: true, situacao: 'esperando', erro: '', criadoEm: new Date().toISOString() }];
      mudou();
    },
    async tirarPessoa(id) { pessoas = pessoas.map(p => (p.id === id ? { ...p, ativo: false } : p)); mudou(); },
    exigeSenha: token => ({ carregado: true, ligado: comSenha.has(token) }),
    async mudarExigeSenha(token, ligado) { if (ligado) comSenha.add(token); else comSenha.delete(token); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
