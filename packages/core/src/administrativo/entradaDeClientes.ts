// A entrada de um cliente no escritório (Vitor, 13/11/2026, o Administrativo: "um fluxo completo de uma entrada de cliente no
// escritorio"). O cliente chega pedindo um orçamento, um enquadramento, para mudar de contabilidade ou abrir a empresa: a
// ficha pré-cadastral é a entrevista (com os requisitos do cliente ideal: "sabe tirar extratos, tem um setor financeiro"); dela
// sai o orçamento (o arquivo para mandar ao cliente); aprovado, os documentos (o nads guarda cada um na pasta do cliente no
// Drive, a da empresa e a de cada sócio do quadro societário); no fim, o cadastro, com os responsáveis do Fiscal e do Contábil.
// Só as regras: quem guarda é o repositório (dados/administrativo).

export type Motivo = 'orcamento' | 'enquadramento' | 'troca' | 'abertura' | 'outro';
export const MOTIVOS: readonly { valor: Motivo; rotulo: string }[] = [
  { valor: 'orcamento', rotulo: 'Orçamento' },
  { valor: 'troca', rotulo: 'Mudar de contabilidade' },
  { valor: 'abertura', rotulo: 'Abrir a empresa' },
  { valor: 'enquadramento', rotulo: 'Enquadramento' },
  { valor: 'outro', rotulo: 'Outro' },
];

export type Regime = 'mei' | 'simples' | 'presumido' | 'real' | 'nao-sabe';
export const REGIMES: readonly { valor: Regime; rotulo: string }[] = [
  { valor: 'mei', rotulo: 'MEI' },
  { valor: 'simples', rotulo: 'Simples Nacional' },
  { valor: 'presumido', rotulo: 'Lucro Presumido' },
  { valor: 'real', rotulo: 'Lucro Real' },
  { valor: 'nao-sabe', rotulo: 'Não sabe / a definir' },
];

export type Atividade = 'servico' | 'comercio' | 'industria' | 'rural' | 'misto';
export const ATIVIDADES: readonly { valor: Atividade; rotulo: string }[] = [
  { valor: 'servico', rotulo: 'Serviço' },
  { valor: 'comercio', rotulo: 'Comércio' },
  { valor: 'industria', rotulo: 'Indústria' },
  { valor: 'rural', rotulo: 'Produtor rural' },
  { valor: 'misto', rotulo: 'Comércio e serviço' },
];

/** Os requisitos do cliente ideal (Vitor: "sabe tirar extratos, tem um setor financeiro, etc"). */
export type IdRequisito = 'extratos' | 'financeiro' | 'sistema' | 'prazo' | 'certificado' | 'contaPj' | 'digital';
export const REQUISITOS_DO_CLIENTE_IDEAL: readonly { id: IdRequisito; rotulo: string }[] = [
  { id: 'extratos', rotulo: 'Sabe tirar os extratos bancários' },
  { id: 'financeiro', rotulo: 'Tem um setor (ou uma pessoa) do financeiro' },
  { id: 'sistema', rotulo: 'Usa um sistema de gestão (notas, estoque, contas)' },
  { id: 'prazo', rotulo: 'Costuma mandar os documentos no prazo' },
  { id: 'certificado', rotulo: 'Tem certificado digital' },
  { id: 'contaPj', rotulo: 'Separa a conta da empresa da conta pessoal' },
  { id: 'digital', rotulo: 'Aceita trabalhar pelo digital (e-mail, WhatsApp, área do cliente)' },
];
/** sim, não ou ainda não respondeu (null) */
export type Resposta = boolean | null;

export interface Socio { nome: string; cpf: string; /** a participação no capital, em % */ participacao: number; administrador: boolean }

export interface Ficha {
  contato: string;
  telefone: string;
  email: string;
  /** a razão social, ou o nome da empresa que vai abrir */
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  motivo: Motivo;
  regime: Regime;
  atividade: Atividade;
  /** o faturamento médio por mês (R$) */
  faturamento: number;
  funcionarios: number;
  notasPorMes: number;
  bancos: number;
  contabilidadeAtual: string;
  requisitos: Partial<Record<IdRequisito, Resposta>>;
  socios: Socio[];
  observacoes: string;
}

export const fichaVazia = (): Ficha => ({
  contato: '', telefone: '', email: '', razaoSocial: '', cnpj: '', cidade: '', motivo: 'orcamento', regime: 'simples', atividade: 'servico',
  faturamento: 0, funcionarios: 0, notasPorMes: 0, bancos: 1, contabilidadeAtual: '', requisitos: {}, socios: [], observacoes: '',
});

/** O que impede de seguir com a ficha ('' quando pode): quem é, como falar com ele e a empresa. */
export function problemaDaFicha(f: Ficha): string {
  if (!f.contato.trim()) return 'Escreva o nome de quem procurou o escritório.';
  if (!f.telefone.trim() && !f.email.trim()) return 'Ponha um telefone ou um e-mail para falar com o cliente.';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'O e-mail não parece certo.';
  if (!f.razaoSocial.trim()) return 'Escreva o nome da empresa (ou o que ela vai ter).';
  const soma = f.socios.reduce((s, x) => s + (Number(x.participacao) || 0), 0);
  if (f.socios.length && Math.abs(soma - 100) > 0.01) return 'A participação dos sócios precisa somar 100% (está em ' + soma.toLocaleString('pt-BR') + '%).';
  return '';
}

export type Classificacao = 'ideal' | 'bom' | 'atencao';
/** A nota do cliente ideal: quantos requisitos ele cumpre e a classificação (Ideal: 6 ou mais de 7; Bom: 4 ou 5). */
export function notaDoCliente(f: Pick<Ficha, 'requisitos'>): { sim: number; respondidos: number; total: number; classificacao: Classificacao; rotulo: string } {
  const total = REQUISITOS_DO_CLIENTE_IDEAL.length;
  const valores = REQUISITOS_DO_CLIENTE_IDEAL.map(r => f.requisitos[r.id]);
  const sim = valores.filter(v => v === true).length;
  const respondidos = valores.filter(v => v != null).length;
  const classificacao: Classificacao = sim >= 6 ? 'ideal' : sim >= 4 ? 'bom' : 'atencao';
  return { sim, respondidos, total, classificacao, rotulo: classificacao === 'ideal' ? 'Cliente ideal' : classificacao === 'bom' ? 'Bom cliente' : 'Pede atenção' };
}

// ---------------------------------------------------------------------------------------------------------------------
// o orçamento
// ---------------------------------------------------------------------------------------------------------------------

export interface ItemDoOrcamento { descricao: string; /** por mês (R$) */ valor: number }
export interface Orcamento {
  itens: ItemDoOrcamento[];
  /** a taxa única de entrada (a implantação, a abertura da empresa) */
  implantacao: number;
  validadeDias: number;
  observacoes: string;
}

/**
 * Os valores de exemplo da sugestão (o Vitor ajusta depois): o honorário pelo regime, o Departamento Pessoal por
 * funcionário, o volume de notas e a conciliação dos bancos a mais.
 */
export const TABELA_DE_EXEMPLO = {
  regime: { mei: 150, simples: 450, presumido: 900, real: 1500, 'nao-sabe': 450 } as Record<Regime, number>,
  porFuncionario: 45,
  notasAte: [{ ate: 100, valor: 0 }, { ate: 500, valor: 150 }, { ate: Infinity, valor: 300 }],
  porBancoAMais: 40,
  bancosNoPreco: 2,
  abertura: 800,
};

/** A sugestão do orçamento pela ficha (o ponto de partida: tudo se muda na tela). */
export function sugestaoDeOrcamento(f: Ficha): Orcamento {
  const t = TABELA_DE_EXEMPLO;
  const regime = REGIMES.find(r => r.valor === f.regime)?.rotulo || '';
  const itens: ItemDoOrcamento[] = [{ descricao: 'Honorário contábil e fiscal (' + regime + ')', valor: t.regime[f.regime] }];
  if (f.funcionarios > 0) itens.push({ descricao: 'Departamento Pessoal (' + f.funcionarios + (f.funcionarios === 1 ? ' funcionário)' : ' funcionários)'), valor: f.funcionarios * t.porFuncionario });
  const notas = t.notasAte.find(n => f.notasPorMes <= n.ate)?.valor || 0;
  if (notas) itens.push({ descricao: 'Volume de notas (cerca de ' + f.notasPorMes + ' por mês)', valor: notas });
  if (f.bancos > t.bancosNoPreco) itens.push({ descricao: 'Conciliação de ' + (f.bancos - t.bancosNoPreco) + (f.bancos - t.bancosNoPreco === 1 ? ' banco a mais' : ' bancos a mais'), valor: (f.bancos - t.bancosNoPreco) * t.porBancoAMais });
  const implantacao = f.motivo === 'abertura' ? t.abertura : f.motivo === 'troca' ? t.regime[f.regime] : 0;
  return { itens, implantacao, validadeDias: 15, observacoes: '' };
}

export const totalMensal = (o: Pick<Orcamento, 'itens'>) => Math.round(o.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0) * 100) / 100;

export function problemaDoOrcamento(o: Orcamento): string {
  if (!o.itens.length) return 'Ponha ao menos um item no orçamento.';
  if (o.itens.some(i => !i.descricao.trim())) return 'Todo item precisa de uma descrição.';
  if (o.itens.some(i => !(Number(i.valor) >= 0))) return 'Os valores não podem ser negativos.';
  if (totalMensal(o) <= 0) return 'O orçamento está zerado.';
  return '';
}

/** O texto do e-mail do orçamento (o assunto e o corpo; o PDF vai anexo). */
export function emailDoOrcamento(f: Ficha, o: Orcamento, real: (v: number) => string): { assunto: string; corpo: string } {
  const primeiro = f.contato.trim().split(/\s+/)[0] || f.contato.trim();
  return {
    assunto: 'Orçamento de contabilidade — ' + f.razaoSocial.trim(),
    corpo: [
      'Olá, ' + primeiro + '!', '',
      'Obrigado pela conversa. Segue o nosso orçamento para a ' + f.razaoSocial.trim() + ':', '',
      ...o.itens.map(i => '• ' + i.descricao + ': ' + real(i.valor) + ' por mês'),
      '', 'Total mensal: ' + real(totalMensal(o)),
      ...(o.implantacao > 0 ? ['Taxa de entrada (única): ' + real(o.implantacao)] : []),
      '', 'O orçamento vale por ' + o.validadeDias + ' dias. O PDF com os detalhes vai anexo.',
      ...(o.observacoes.trim() ? ['', o.observacoes.trim()] : []),
      '', 'Qualquer dúvida, é só responder este e-mail.', '', 'Nilma Contabilidade',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// os documentos e a pasta no Drive
// ---------------------------------------------------------------------------------------------------------------------

export interface DocumentoPedido {
  id: string;
  rotulo: string;
  /** de qual sócio (o quadro societário); sem, é da empresa */
  socio?: string;
  obrigatorio: boolean;
  /** a subpasta dentro da pasta do cliente */
  pasta: string;
}

const PASTA_DA_EMPRESA = 'SOCIETÁRIO/EMPRESA';
const pastaDoSocio = (nome: string) => 'SOCIETÁRIO/QUADRO SOCIETÁRIO/' + nomeDePasta(nome);
/** o nome em maiúsculas, sem os caracteres que o Drive não aceita */
export const nomeDePasta = (s: string) => s.trim().toUpperCase().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');

/** Os documentos que o cliente manda: os da empresa (conforme o motivo e a ficha) e os de cada sócio. */
export function documentosPedidos(f: Ficha): DocumentoPedido[] {
  const abrindo = f.motivo === 'abertura';
  const empresa: [string, string, boolean][] = [
    ['contrato', abrindo ? 'Minuta do contrato social (se já tiver)' : 'Contrato social e alterações', !abrindo],
    ...(abrindo ? [] : [['cnpj', 'Cartão CNPJ', true] as [string, string, boolean], ['inscricoes', 'Inscrições estadual e municipal', false] as [string, string, boolean]]),
    ['endereco-empresa', abrindo ? 'Comprovante do endereço onde vai funcionar' : 'Comprovante de endereço da empresa', true],
    ...(f.motivo === 'troca' ? [['balancete', 'Último balanço ou balancete da contabilidade anterior', true] as [string, string, boolean], ['pendencias', 'Guias e declarações em aberto', false] as [string, string, boolean]] : []),
    ...(abrindo ? [] : [['extratos', 'Extratos bancários dos últimos 3 meses', true] as [string, string, boolean]]),
    ...(f.funcionarios > 0 ? [['folha', 'Folha de pagamento e a ficha dos funcionários', true] as [string, string, boolean]] : []),
    ['certificado', 'Certificado digital (A1)', false],
  ];
  const socios = f.socios.flatMap(s => [
    { id: 'rg', rotulo: 'RG ou CNH', obrigatorio: true },
    { id: 'cpf', rotulo: 'CPF', obrigatorio: true },
    { id: 'endereco', rotulo: 'Comprovante de endereço', obrigatorio: true },
    { id: 'estado-civil', rotulo: 'Certidão de casamento ou nascimento', obrigatorio: false },
  ].map(d => ({ id: 'socio:' + s.nome + ':' + d.id, rotulo: d.rotulo, socio: s.nome, obrigatorio: d.obrigatorio, pasta: pastaDoSocio(s.nome) })));
  return [...empresa.map(([id, rotulo, obrigatorio]) => ({ id: 'empresa:' + id, rotulo, obrigatorio, pasta: PASTA_DA_EMPRESA })), ...socios];
}

/** A pasta do cliente no Drive do escritório: o ano, o código e o nome ("2026/0412 - PADARIA DO ZE LTDA"). */
export const pastaDoCliente = (ano: number, codigo: number | null, razaoSocial: string) =>
  'Meu Drive/' + ano + '/' + (codigo != null ? String(codigo).padStart(4, '0') + ' - ' : 'NOVO - ') + nomeDePasta(razaoSocial);

/** Os obrigatórios que ainda faltam. */
export const faltando = (pedidos: readonly DocumentoPedido[], recebidos: readonly { documento: string }[]) =>
  pedidos.filter(p => p.obrigatorio && !recebidos.some(r => r.documento === p.id));

// ---------------------------------------------------------------------------------------------------------------------
// o cadastro e a entrada inteira
// ---------------------------------------------------------------------------------------------------------------------

export interface Pessoa { uid: string; nome: string }
export interface Cadastro { codigo: number; razaoSocial: string; cnpj: string; regime: Regime; fiscal: Pessoa | null; contabil: Pessoa | null; dp: Pessoa | null }

/** O próximo código livre (o maior que existe + 1). */
export const proximoCodigo = (codigos: readonly number[]) => (codigos.length ? Math.max(...codigos) : 0) + 1;

export function problemaDoCadastro(c: Cadastro, codigosUsados: readonly number[], temFuncionarios: boolean): string {
  if (!(c.codigo > 0) || !Number.isInteger(c.codigo)) return 'O código precisa ser um número.';
  if (codigosUsados.includes(c.codigo)) return 'O código ' + c.codigo + ' já é de outra empresa.';
  if (!c.razaoSocial.trim()) return 'Escreva a razão social.';
  if (c.cnpj.replace(/\D/g, '') && c.cnpj.replace(/\D/g, '').length !== 14) return 'O CNPJ precisa ter 14 números.';
  if (!c.fiscal) return 'Escolha o responsável do Fiscal.';
  if (!c.contabil) return 'Escolha o responsável do Contábil.';
  if (temFuncionarios && !c.dp) return 'A empresa tem funcionários: escolha o responsável do Departamento Pessoal.';
  return '';
}

export type Etapa = 'ficha' | 'orcamento' | 'aguardando' | 'documentos' | 'cadastro' | 'concluida' | 'recusada';
export const ETAPAS: readonly { valor: Etapa; rotulo: string; tom: 'neutral' | 'warn' | 'info' | 'ok' }[] = [
  { valor: 'ficha', rotulo: 'Ficha', tom: 'neutral' },
  { valor: 'orcamento', rotulo: 'Orçamento', tom: 'warn' },
  { valor: 'aguardando', rotulo: 'Aguardando o cliente', tom: 'info' },
  { valor: 'documentos', rotulo: 'Documentos', tom: 'warn' },
  { valor: 'cadastro', rotulo: 'Cadastro', tom: 'info' },
  { valor: 'concluida', rotulo: 'Cliente cadastrado', tom: 'ok' },
  { valor: 'recusada', rotulo: 'Não fechou', tom: 'neutral' },
];
export const rotuloDaEtapa = (e: Etapa) => ETAPAS.find(x => x.valor === e)?.rotulo || e;

export interface DocumentoRecebido { documento: string; nome: string; tamanho: number; em: string; por: string }
export interface Nota { por: string; em: string; texto: string }

export interface Entrada {
  id: string;
  numero: number;
  etapa: Etapa;
  ficha: Ficha;
  orcamento: Orcamento | null;
  enviadoEm?: string;
  /** a resposta do cliente ao orçamento */
  decisao?: { aprovado: boolean; em: string; observacao: string };
  documentos: DocumentoRecebido[];
  cadastro?: Cadastro;
  criadaPor: string;
  criadaEm: string;
  atualizadaEm: string;
  historico: Nota[];
}

const nota = (por: string, em: string, texto: string): Nota => ({ por, em, texto });

export function nova(id: string, numero: number, por: string, em: string): Entrada {
  return { id, numero, etapa: 'ficha', ficha: fichaVazia(), orcamento: null, documentos: [], criadaPor: por, criadaEm: em, atualizadaEm: em, historico: [nota(por, em, 'Começou a ficha')] };
}

export const comFicha = (e: Entrada, f: Ficha, em: string): Entrada => ({ ...e, ficha: f, atualizadaEm: em });

/** A ficha pronta vira o orçamento (a sugestão, se ainda não tinha). */
export function paraOOrcamento(e: Entrada, por: string, em: string): Entrada {
  const p = problemaDaFicha(e.ficha);
  if (p) throw new Error(p);
  return { ...e, etapa: e.etapa === 'ficha' ? 'orcamento' : e.etapa, orcamento: e.orcamento || sugestaoDeOrcamento(e.ficha), atualizadaEm: em, historico: [...e.historico, nota(por, em, 'Fechou a ficha e montou o orçamento')] };
}

export const comOrcamento = (e: Entrada, o: Orcamento, em: string): Entrada => ({ ...e, orcamento: o, atualizadaEm: em });

export function enviado(e: Entrada, por: string, em: string): Entrada {
  if (!e.orcamento) throw new Error('Monte o orçamento antes.');
  const p = problemaDoOrcamento(e.orcamento);
  if (p) throw new Error(p);
  return { ...e, etapa: 'aguardando', enviadoEm: em, atualizadaEm: em, historico: [...e.historico, nota(por, em, 'Mandou o orçamento ao cliente')] };
}

export function respostaDoCliente(e: Entrada, aprovado: boolean, observacao: string, por: string, em: string): Entrada {
  return { ...e, etapa: aprovado ? 'documentos' : 'recusada', decisao: { aprovado, em, observacao: observacao.trim() }, atualizadaEm: em, historico: [...e.historico, nota(por, em, aprovado ? 'O cliente aprovou o orçamento' : 'O cliente não fechou')] };
}

export function comDocumento(e: Entrada, d: DocumentoRecebido): Entrada {
  return { ...e, documentos: [...e.documentos.filter(x => x.documento !== d.documento), d], atualizadaEm: d.em, historico: [...e.historico, nota(d.por, d.em, 'Recebeu ' + d.nome)] };
}

export const semDocumento = (e: Entrada, documento: string, em: string): Entrada => ({ ...e, documentos: e.documentos.filter(x => x.documento !== documento), atualizadaEm: em });

export function paraOCadastro(e: Entrada, por: string, em: string): Entrada {
  return { ...e, etapa: 'cadastro', atualizadaEm: em, historico: [...e.historico, nota(por, em, 'Foi para o cadastro')] };
}

export function cadastrado(e: Entrada, c: Cadastro, codigosUsados: readonly number[], por: string, em: string): Entrada {
  const p = problemaDoCadastro(c, codigosUsados, e.ficha.funcionarios > 0);
  if (p) throw new Error(p);
  return { ...e, etapa: 'concluida', cadastro: c, atualizadaEm: em, historico: [...e.historico, nota(por, em, 'Cadastrou o cliente com o código ' + c.codigo)] };
}

/** A ordem da lista: as que andam primeiro (a ficha, o orçamento, os documentos, o cadastro), a mais recente em cima. */
export function ordenar<T extends Pick<Entrada, 'etapa' | 'atualizadaEm'>>(lista: readonly T[]): T[] {
  const fim = (e: T) => (e.etapa === 'concluida' || e.etapa === 'recusada' ? 1 : 0);
  return [...lista].sort((a, b) => fim(a) - fim(b) || b.atualizadaEm.localeCompare(a.atualizadaEm));
}
