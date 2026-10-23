// O acompanhamento do arquivador novo (Admin › Arquivador, 22/10/2026): o que o robô do PC publica em
// robo/arquivadorNovo.painel e o histórico do dia em robo/arquivadorNovo/dias/{dia}-{n} (robo/arquivador-acompanhamento.js).
// No banco: arquivadorNovo.firestore.ts (ouve o painel enquanto a página está aberta; o histórico de um dia só quando a aba
// Arquivados pede). Nos exemplos: aqui, com a primeira passada do arquivador em andamento (as datas contadas a partir de
// agora, para a tela sempre parecer viva). Os pedidos ao robô (Para resolver: abrir o arquivo, a prévia, arquivar em…,
// descartar; 23/10/2026) vão em pedidosArquivador; nos exemplos, um robô de mentira responde em instantes.
import { entregas } from '@nads/core';

export interface DocsDoArquivadorNovo {
  carregado: boolean;
  /** a leitura foi negada (quem não é admin) */
  semPermissao: boolean;
  painel: entregas.PainelDoArquivador | null;
}

/** O histórico de um dia (as partes juntas, o mais novo primeiro). */
export interface DiaDoArquivador { dia: string; carregado: boolean; erro: string; itens: entregas.ItemDoArquivador[] }

/** Um pedido novo ao robô (o repositório põe quem pediu e a hora). */
export interface NovoPedidoDoArquivador {
  tipo: entregas.TipoDoPedido; rel: string; hash: string; nome?: string; codigo?: number; tipoDoc?: string; competencia?: string;
}

export interface RepoArquivadorNovo {
  readonly exemplos: boolean;
  /** os clientes e os tipos do formulário "Arquivar em…" (lê na primeira vez que pedem) */
  cadastroDoFormulario(): entregas.CadastroDoFormulario;
  /** cria o pedido ao robô do PC; devolve o id (o pedido é acompanhado até a resposta) */
  pedir(p: NovoPedidoDoArquivador): Promise<string>;
  /** o pedido e a resposta do robô (null enquanto não chegou) */
  pedido(id: string): entregas.PedidoDoArquivador | null;
  /** o arquivo aberto: junta as partes que o robô gravou */
  conteudo(id: string, partes: number): Promise<Uint8Array>;
  docs(): DocsDoArquivadorNovo;
  /** começa a ouvir o painel (enquanto a página está aberta); devolve como parar */
  acompanhar(): () => void;
  /** o histórico de um dia ('AAAA-MM-DD'): pede ao banco na primeira vez; o de hoje é relido quando o painel avisa que cresceu */
  dia(dia: string): DiaDoArquivador;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** 'AAAA-MM-DD' de hoje (no fuso do computador, como o robô). */
export function hojeLocal(agora = Date.now()): string {
  const d = new Date(agora);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------------------------------------------------------------------------------------------------------------------
// os exemplos
// ---------------------------------------------------------------------------------------------------------------------
const CLIENTES: readonly [string, string][] = [
  ['58', 'COMÉRCIO EXEMPLO LTDA'], ['292', 'INDÚSTRIA EXEMPLO S/A'], ['62', 'AGROPECUÁRIA EXEMPLO LTDA'], ['380', 'LEONARDO EXEMPLO ME'],
  ['141', 'TRANSPORTES EXEMPLO LTDA'], ['205', 'ADEMILSON EXEMPLO CRUZ'], ['356', 'A7 VEÍCULOS EXEMPLO LTDA'], ['462', '3M FLORESTAL EXEMPLO LTDA'],
  ['512', 'PADARIA EXEMPLO EIRELI'], ['544', 'CONSTRUTORA ALFA EXEMPLO'], ['564', 'CONSTRUTORA ALFA EXEMPLO FILIAL'], ['573', 'FARMÁCIA EXEMPLO LTDA'],
  ['575', 'MERCADO EXEMPLO LTDA'], ['591', 'CLÍNICA EXEMPLO S/S'], ['593', 'OFICINA BETA EXEMPLO ME'],
];
/** os modelos de arquivo: o nome, o tipo das regras, a pasta dentro do cliente, as evidências e a confiança */
const MODELOS: readonly { nome: string; tipo: string; pasta: string; final: string; ev: string[]; conf: number; ocr?: boolean }[] = [
  { nome: '35261012345678000190550010000{n}1.xml', tipo: 'XML NF-e', pasta: 'FISCAL\\XML\\NF-e\\2026\\10\\EMITIDAS', final: 'NFe {n} 10-2026.xml', ev: ['CNPJ/CPF do XML é de um cliente só', 'Emitida (emitente da chave = cliente)'], conf: 98 },
  { nome: 'NFCe_{n}.xml', tipo: 'XML NFC-e', pasta: 'FISCAL\\XML\\NFC-e\\2026\\10', final: 'NFCe {n} 10-2026.xml', ev: ['CNPJ/CPF do XML é de um cliente só'], conf: 98 },
  { nome: 'extrato sicoob setembro.pdf', tipo: 'EXTRATO', pasta: 'CONTÁBIL\\EXTRATOS\\2026\\09\\BANCÁRIOS\\SICOOB', final: 'EXTRATO SICOOB 09-2026.pdf', ev: ['Título "Extrato de conta corrente" → tipo EXTRATO', 'Conta 52.166-3 já arquivada só deste cliente', 'Competência pelo nome do arquivo'], conf: 97 },
  { nome: 'comprovante pagamento {n}.pdf', tipo: 'COMPROVANTE', pasta: 'CONTÁBIL\\EXTRATOS\\2026\\10\\COMPROVANTES\\SICOOB', final: 'COMPROVANTE {n} 10-2026.pdf', ev: ['Título "Comprovante de pagamento" → tipo COMPROVANTE', 'CNPJ/CPF do documento é de um cliente só'], conf: 95 },
  { nome: 'DAS 09-2026.pdf', tipo: 'DAS', pasta: 'FISCAL\\IMPOSTOS\\2026\\09. DAS', final: 'DAS 09-2026.pdf', ev: ['Título "Documento de Arrecadação do Simples Nacional" → tipo DAS', 'CNPJ/CPF do documento é de um cliente só'], conf: 99 },
  { nome: 'darf irpj 3t.pdf', tipo: 'DARF', pasta: 'FISCAL\\IMPOSTOS\\2026\\09. DARF', final: 'DARF IRPJ 09-2026.pdf', ev: ['Título "Documento de Arrecadação de Receitas Federais" → tipo DARF', 'Contribuinte = 1º CNPJ/CPF do documento'], conf: 96 },
  { nome: 'guia fgts outubro.pdf', tipo: 'FGTS', pasta: 'DEPARTAMENTO PESSOAL\\IMPOSTOS\\FGTS\\2026\\10', final: 'FGTS 10-2026.pdf', ev: ['Título "Guia do FGTS Digital" → tipo FGTS', 'CNPJ/CPF do documento é de um cliente só'], conf: 97 },
  { nome: 'dae icms.pdf', tipo: 'DAE', pasta: 'FISCAL\\IMPOSTOS\\2026\\09. DAE', final: 'DAE ICMS 09-2026.pdf', ev: ['Título "Documento de Arrecadação Estadual" → tipo DAE', 'Razão social escrita no documento'], conf: 90 },
  { nome: 'SPED EFD {n}.txt', tipo: 'SPED FISCAL', pasta: 'FISCAL\\SPED FISCAL\\2026\\09', final: 'SPED FISCAL 09-2026.txt', ev: ['Registro 0000 do SPED (CNPJ e período)'], conf: 99 },
  { nome: 'balancete 09-2026.xlsx', tipo: 'BALANCETE', pasta: 'CONTÁBIL\\REGISTRO DE LIVROS\\2026', final: 'BALANCETE 09-2026.xlsx', ev: ['Nome do arquivo do Alterdata (código e mês)'], conf: 92 },
  { nome: 'extrato itau.ofx', tipo: 'EXTRATO OFX', pasta: 'CONTÁBIL\\EXTRATOS\\2026\\09\\BANCÁRIOS\\ITAU', final: 'EXTRATO ITAU 09-2026.ofx', ev: ['Conta 12345-6 confirmada no cadastro de contas'], conf: 97 },
  { nome: 'nota escaneada {n}.pdf', tipo: 'NF-e PDF', pasta: 'FISCAL\\DOCUMENTOS FISCAIS\\RECEBIDOS\\2026\\10', final: 'NFe {n} 10-2026.pdf', ev: ['Texto lido por OCR (leitura 81%): certeza limitada a 90%', 'Recebida (emitente da chave ≠ cliente)'], conf: 88, ocr: true },
];

function itemDeExemplo(i: number, em: string, acao: entregas.AcaoDoArquivador = 'arquivou'): entregas.ItemDoArquivador {
  const m = MODELOS[i % MODELOS.length];
  const [cod, nome] = CLIENTES[(i * 7 + 3) % CLIENTES.length];
  const n = String(1000 + ((i * 37) % 900));
  const pastaCliente = cod + ' - ' + nome;
  const final = m.final.replace('{n}', n);
  return {
    id: 'ex-' + i, em, nome: m.nome.replace('{n}', n), rel: '2026-10\\' + m.nome.replace('{n}', n), acao, tipo: m.tipo, cliente: cod, clienteNome: nome,
    confianca: m.conf, destino: pastaCliente + '\\' + m.pasta + '\\' + final, nomeFinal: final,
    copias: [], pastaNova: '', evidencias: [...m.ev], ocr: m.ocr ? { confianca: 81, segundos: 14, erro: '' } : null, dentroDe: i % 9 === 4 ? 'xmls-outubro.zip' : '',
    motivo: '', motivoTexto: '', sugestao: '', destinoSugerido: '', erro: '', erroTipo: '', erroTitulo: '', oQueFazer: '', naoAplicado: '', hash: '', naPasta: '',
  };
}

const PENDENTES: readonly Partial<entregas.ItemDoArquivador>[] = [
  // o do print do Vitor (23/10/2026)
  { nome: '2026-2151 BRAZILIAN.pdf', tipo: 'DAS', motivo: 'VOCABULARIO_AUSENTE', motivoTexto: 'Faltou um dado do documento', sugestao: 'Não leu um dado necessário (o tributo, a chave, o emissor ou o número). Arquive à mão.', evidencias: ['Título "Documento de Arrecadação do Simples Nacional" → tipo DAS', 'Razão social escrita no documento', 'Período de apuração não lido'], confianca: 50, cliente: '568', clienteNome: 'BRAZILIAN EXEMPLO LTDA' },
  { nome: 'nota servico prefeitura.pdf', tipo: 'NFS-e PDF', motivo: 'CLIENTE_NAO_LOCALIZADO', motivoTexto: 'CNPJ não cadastrado', sugestao: 'Nenhum CNPJ ou CPF do documento é de cliente. Se for de um cliente novo, cadastre o CNPJ no Cadastro do nads; se não for de cliente, tire o arquivo da pasta.', evidencias: ['Título "Nota Fiscal de Serviço Eletrônica" → tipo NFS-e', 'Nenhum CNPJ/CPF do documento é de cliente'], confianca: 30 },
  { nome: 'DAS 09-2026 (1).pdf', tipo: 'DAS', motivo: 'CLIENTE_AMBIGUO', motivoTexto: 'Duas empresas possíveis', sugestao: 'Escolha entre 544 e 564 e mova o arquivo para a pasta do certo.', evidencias: ['Título "Documento de Arrecadação do Simples Nacional" → tipo DAS', 'Candidatos 544, 564'], confianca: 50, cliente: '544', clienteNome: 'CONSTRUTORA ALFA EXEMPLO' },
  { nome: 'IMG_20261021_0932.jpg', tipo: '', motivo: 'FORMATO_SEM_REGRA', motivoTexto: 'Formato sem regra', sugestao: 'Imagem, Word e afins não têm regra automática. Arquive à mão.', evidencias: ['Extensão .jpg sem regra determinística (imagem, Word, etc.)'], confianca: 0 },
  { nome: 'scan0042.pdf', tipo: 'PDF', motivo: 'CONTEUDO_SEM_TEXTO', motivoTexto: 'Escaneado sem leitura', sugestao: 'É uma imagem sem texto e a leitura (OCR) não bastou. Peça o PDF original ao cliente ou arquive à mão.', evidencias: ['PDF sem camada de texto (escaneado)', 'Texto lido por OCR (leitura 41%): certeza limitada a 80%'], confianca: 0 },
  { nome: 'comprovante pix.pdf', tipo: 'COMPROVANTE', motivo: 'CONFIANCA_ABAIXO_DO_LIMIAR', motivoTexto: 'Pouca certeza', sugestao: 'Sugestão do robô: 512 - PADARIA EXEMPLO EIRELI\\CONTÁBIL\\EXTRATOS\\2026\\10\\COMPROVANTES\\NUBANK\\COMPROVANTE 10-2026.pdf. Se estiver certa, mova para lá.', destinoSugerido: '512 - PADARIA EXEMPLO EIRELI\\CONTÁBIL\\EXTRATOS\\2026\\10\\COMPROVANTES\\NUBANK\\COMPROVANTE 10-2026.pdf', evidencias: ['Título "Comprovante de transferência" → tipo COMPROVANTE', 'Só a pasta de origem (subpasta 512)', 'Banco pelo nome do arquivo'], confianca: 80, cliente: '512', clienteNome: 'PADARIA EXEMPLO EIRELI' },
  { nome: 'guias setembro.pdf', tipo: 'DARF', motivo: 'PDF_COMPOSTO_NAO_SEPARADO', motivoTexto: 'PDF com vários documentos', sugestao: 'O PDF junta várias guias ou documentos. Separe as páginas e ponha de volta na pasta.', evidencias: ['4 páginas com o título DARF: o robô não separa PDF'], confianca: 50, acao: 'fica' },
  { nome: 'extrato.pdf', tipo: 'EXTRATO', motivo: 'COMPETENCIA_AUSENTE', motivoTexto: 'Sem a competência', sugestao: 'Não achou o mês do documento. Ponha o mês no nome do arquivo (ex.: 01-2026) ou arquive à mão.', evidencias: ['Título "Extrato" → tipo EXTRATO', 'Conta 9.871-2 já arquivada só deste cliente'], confianca: 60, cliente: '141', clienteNome: 'TRANSPORTES EXEMPLO LTDA' },
  { nome: 'xml cancelamento.xml', tipo: 'XML NF-e', motivo: 'CLIENTE_AMBIGUO', motivoTexto: 'Duas empresas possíveis', sugestao: 'É de outro estabelecimento (matriz ou filial) de 573: cadastre o CNPJ dele ou mova à mão.', evidencias: ['Raiz do CNPJ de 573 com outro estabelecimento (matriz/filial sem cadastro próprio)'], confianca: 40 },
  { nome: 'boleto condominio.pdf', tipo: 'PDF', motivo: 'TIPO_NAO_RECONHECIDO', motivoTexto: 'Tipo de documento desconhecido', sugestao: 'O robô ainda não conhece este documento. Arquive à mão; se for comum, peça a regra.', evidencias: ['Nenhum título conhecido no cabeçalho'], confianca: 30, cliente: '205', clienteNome: 'ADEMILSON EXEMPLO CRUZ' },
];

function vazioDoItem(): entregas.ItemDoArquivador {
  return { id: '', em: '', nome: '', rel: '', acao: 'naoIdentificado', tipo: '', cliente: '', clienteNome: '', confianca: null, destino: '', nomeFinal: '', copias: [], pastaNova: '', evidencias: [], ocr: null, dentroDe: '',
    motivo: '', motivoTexto: '', sugestao: '', destinoSugerido: '', erro: '', erroTipo: '', erroTitulo: '', oQueFazer: '', naoAplicado: '', hash: '', naPasta: '' };
}

/** O painel de exemplo: a primeira passada (a pilha antiga da pasta) em andamento, em produção. */
export function painelDeExemplo(agora = Date.now()): entregas.PainelDoArquivador {
  const ha = (min: number) => new Date(agora - min * 60000).toISOString();
  const ultimos = Array.from({ length: 24 }, (_, i) => itemDeExemplo(i, ha(i * 0.4 + 0.2), i === 5 || i === 13 ? 'jaArquivado' : 'arquivou'));
  ultimos[2] = { ...ultimos[2], pastaNova: ultimos[2].cliente + ' - ' + ultimos[2].clienteNome, evidencias: [...ultimos[2].evidencias, 'Pasta do cliente criada: o CNPJ do documento confere com o cadastro'] };
  // a NFS-e dos honorários: na pasta do escritório e uma cópia na do tomador (decisão do Vitor, 21/10/2026)
  ultimos[6] = {
    ...ultimos[6], nome: 'NFSe 000412 COMERCIO EXEMPLO.pdf', rel: '2026-10\\NFSe 000412 COMERCIO EXEMPLO.pdf', tipo: 'NFS-e PDF', cliente: '284', clienteNome: 'NILMA CONTABILIDADE',
    destino: '284 - NILMA CONTABILIDADE\\FINANCEIRO\\NOTAS EMITIDAS\\2026\\10\\NFSe 000412 10-2026.pdf', nomeFinal: 'NFSe 000412 10-2026.pdf', confianca: 97,
    copias: ['58 - COMÉRCIO EXEMPLO LTDA\\FISCAL\\DOCUMENTOS FISCAIS\\RECEBIDOS\\2026\\10\\NFSe 000412 10-2026.pdf'],
    evidencias: ['Título "Nota Fiscal de Serviço Eletrônica" → tipo NFS-e', 'Emitida pelo escritório: na pasta dele e uma cópia na do tomador (58)'],
  };
  const pendentes = PENDENTES.map((p, i) => ({ ...vazioDoItem(), ...p, id: 'pen-' + i, em: ha(3 + i * 11), rel: '2026-10\\' + p.nome,
    naPasta: p.acao === 'fica' ? '' : 'NÃO IDENTIFICADOS\\20261022-NOVO\\2026-10\\' + p.nome, hash: 'exemplo' + i }));
  const erros: entregas.ItemDoArquivador[] = [
    { ...vazioDoItem(), id: 'er-1', em: ha(8), acao: 'erro', nome: 'Planilha de vendas.xlsx', rel: '2026-10\\Planilha de vendas.xlsx', erro: "EBUSY: resource busy or locked, open 'G:\\Meu Drive\\Claudio Secretario\\2026-10\\Planilha de vendas.xlsx'", erroTipo: 'travado', erroTitulo: 'Arquivo travado', oQueFazer: 'Feche o arquivo no programa que o abriu (ou espere o Drive terminar de sincronizar). O robô tenta de novo sozinho.' },
    { ...vazioDoItem(), id: 'er-2', em: ha(52), acao: 'erro', nome: 'nf 4471.pdf', rel: '2026-10\\nf 4471.pdf', erro: 'leitura do PDF: Invalid PDF structure', erroTipo: 'corrompido', erroTitulo: 'Arquivo corrompido', oQueFazer: 'O arquivo não abre (corrompido ou com senha). Peça de novo ao cliente.' },
    { ...vazioDoItem(), id: 'er-3', em: ha(140), acao: 'erro', nome: 'escaneado 120 paginas.pdf', rel: '2026-09\\escaneado 120 paginas.pdf', erro: 'OCR: tempo esgotado depois de 180 s', erroTipo: 'ocr', erroTitulo: 'A leitura (OCR) falhou ou demorou demais', oQueFazer: 'O PDF escaneado é grande ou ruim. Peça o PDF original; se acontecer com muitos, avise.' },
  ];
  const porTipo = { 'XML NF-e': 412, 'XML NF-e EVENTOS': 38, 'XML NFC-e': 286, EXTRATO: 96, 'EXTRATO OFX': 22, COMPROVANTE: 141, DAS: 64, DEFIS: 3, DARF: 47, FGTS: 39, DAE: 18, 'SPED FISCAL': 21, SINTEGRA: 6, BALANCETE: 15, 'NF-e PDF': 32 };
  const arquivouHoje = Object.values(porTipo).reduce((s, n) => s + n, 0);
  const clientesHoje = CLIENTES.map(([codigo, nome], i) => ({ codigo, nome, n: Math.max(4, Math.round(arquivouHoje / (i + 2.2) / 2.1)) })).sort((a, b) => b.n - a.n);
  const contagem = (chave: string, f: number, extra: Partial<entregas.ContagemDoArquivador>): entregas.ContagemDoArquivador => ({
    chave,
    porAcao: { arquivou: Math.round(arquivouHoje * f), arquivaria: 0, jaArquivado: Math.round(54 * f), naoIdentificado: Math.round(8 * f), fica: Math.round(1 * f), erro: Math.round(3 * f) },
    porTipo: Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, Math.round(v * f)])),
    porMotivo: { CLIENTE_NAO_LOCALIZADO: Math.round(4 * f), CLIENTE_AMBIGUO: Math.round(2 * f), CONTEUDO_SEM_TEXTO: Math.round(1 * f), CONFIANCA_ABAIXO_DO_LIMIAR: Math.round(1 * f), PDF_COMPOSTO_NAO_SEPARADO: Math.round(1 * f) },
    pastasNovas: [], clientes: clientesHoje.map(c => ({ ...c, n: Math.round(c.n * f) })), totalDeClientes: Math.round(41 * Math.min(f, 3.4)),
    ...extra,
  });
  const lista: entregas.ArquivoNaPasta[] = [
    ...['comprovante pagamento 1442.pdf', 'NFCe_8812.xml', 'extrato bradesco.pdf'].map((nome, i) => ({ nome, rel: '2026-10\\' + nome, tam: 84000 + i * 9000, desde: ha(3 + i), situacao: 'lendo' as const })),
    ...['DAS 10-2026.pdf', 'fotos da nota.zip'].map((nome, i) => ({ nome, rel: '2026-10\\' + nome, tam: 52000 + i * 410000, desde: ha(0.3 + i * 0.2), situacao: 'chegando' as const })),
    ...['35261099887766000155550010000123451.xml', 'darf pis cofins.pdf', 'SPED EFD 0925.txt', 'extrato caixa.ofx', 'balancete 09-2026.xlsx', 'contrato giro.pdf'].map((nome, i) => ({ nome, rel: '2026-09\\' + nome, tam: 14000 + i * 23000, desde: ha(60 * 26 + i * 13), situacao: 'fila' as const })),
  ];
  const t = (h: number, m: number) => new Date(new Date(agora).setHours(h, m, 0, 0)).toISOString();
  return {
    em: ha(0.4), maquina: 'DPTO-FISCAL-004',
    config: { modo: 'producao', emProducao: true, tiposProducao: ['todos'], moverNaoIdentificados: true, botaoRotinaAntiga: false, intervaloMs: 60000, estavelMs: 45000, lote: 40 },
    situacao: 'ok', esperando: '',
    pasta: { naPasta: 15918 + 2 + 3, chegando: 2, naFila: 15915, sendoLidos: 3, parados: 9, esperandoOriginal: 0, lista },
    passada: { inicio: t(13, 5), feitos: 1240, total: 1240 + 15918, fim: '' },
    ritmo: 38.4,
    hoje: contagem(hojeLocal(agora), 1, { pastasNovas: ['593 - OFICINA BETA EXEMPLO ME', '591 - CLÍNICA EXEMPLO S/S'] }),
    mes: contagem(hojeLocal(agora).slice(0, 7), 1, { pastasNovas: ['593 - OFICINA BETA EXEMPLO ME', '591 - CLÍNICA EXEMPLO S/S'] }),
    ultimos, pendentes, erros,
    alertas: [{ tipo: 'ocr', tom: 'aviso', titulo: 'Um PDF escaneado demorou mais de 1 minuto para ler', texto: 'A leitura por OCR é lenta nos escaneados grandes.', oQueFazer: 'Se a fila crescer, peça os PDFs originais em vez dos escaneados.' }],
    ladoALado: {
      dia: hojeLocal(agora - 864e5), rotinaArquivou: 214, iguais: 188, pastaIgualNomeDiferente: 14, diferentes: 5, novoNaoIdentificou: 4, novoNaoViu: 3,
      exemplos: [
        { tipo: 'DIFERENTE', nome: 'extrato conta poupanca.pdf', antigo: 'G:\\Meu Drive\\2026\\58 - COMÉRCIO EXEMPLO LTDA\\CONTÁBIL\\EXTRATOS\\2026\\09\\BANCÁRIOS\\SICOOB\\EXTRATO POUPANCA 09-2026.pdf', novo: 'G:\\Meu Drive\\2026\\58 - COMÉRCIO EXEMPLO LTDA\\CONTÁBIL\\EXTRATOS\\2026\\09\\APLICAÇÕES\\SICOOB\\APLICACAO 09-2026.pdf' },
        { tipo: 'NI', nome: 'scan0039.pdf', antigo: 'G:\\Meu Drive\\2026\\205 - ADEMILSON EXEMPLO CRUZ\\CONTÁBIL\\OUTROS DOCUMENTOS\\scan0039.pdf', novo: 'CONTEUDO_SEM_TEXTO' },
      ],
    },
    historico: { dia: hojeLocal(agora), partes: 2, itens: 1240 },
  };
}

/** O histórico de exemplo de um dia: os arquivos do painel e mais uns, com os não identificados e os erros no meio. */
export function diaDeExemplo(dia: string, agora = Date.now()): entregas.ItemDoArquivador[] {
  const p = painelDeExemplo(agora);
  const hoje = dia === hojeLocal(agora);
  const base = hoje ? agora : Date.parse(dia + 'T18:00:00');
  const mais = Array.from({ length: hoje ? 96 : 60 }, (_, i) => itemDeExemplo(i + (hoje ? 24 : 300), new Date(base - (hoje ? 12 : 0) * 60000 - i * 3.1 * 60000).toISOString(), i % 17 === 9 ? 'jaArquivado' : 'arquivou'));
  return (hoje ? [...p.ultimos, ...p.pendentes, ...p.erros, ...mais] : [...mais, ...p.pendentes.slice(0, 3).map(x => ({ ...x, id: x.id + '-' + dia, em: new Date(base - 200 * 60000).toISOString() }))])
    .sort((a, b) => b.em.localeCompare(a.em));
}

// o robô de mentira dos exemplos: o conteúdo do arquivo aberto e o destino da prévia (só para ver a tela; o de verdade
// sai das regras do robô)
const PASTA_DE_EXEMPLO: Record<string, (c: string) => string> = {
  DAS: c => 'FISCAL\\SIMPLES NACIONAL\\01. DAS\\' + c + '.pdf',
  DARF: c => 'FISCAL\\SIMPLES NACIONAL\\16. DARF\\' + c + ' - DARF.pdf',
  DAE: c => 'FISCAL\\SIMPLES NACIONAL\\02. DAE\\' + c + ' - DAE.pdf',
  FGTS: c => 'SOCIETÁRIO\\IMPOSTOS\\FGTS\\' + c.slice(3) + '\\' + c + '.pdf',
  EXTRATO: c => 'CONTÁBIL\\EXTRATOS\\' + c.slice(3) + '\\' + c.slice(0, 2) + '\\BANCÁRIOS\\SICOOB\\' + c + '.pdf',
  NOTA_RECEBIDA: c => 'FISCAL\\SIMPLES NACIONAL\\03. DOCUMENTOS FISCAIS\\RECEBIDOS\\' + c + ' - nota.pdf',
  OUTROS: c => 'CONTÁBIL\\OUTROS DOCUMENTOS\\' + c.slice(-4) + '\\arquivo.pdf',
};
const TIPOS_DE_EXEMPLO: entregas.TipoDoFormulario[] = [
  { id: 'AUTO', rotulo: 'Pelo conteúdo (o robô escolhe o tipo)', precisa: null }, { id: 'DAS', rotulo: 'DAS (Simples Nacional)', precisa: 'mes' },
  { id: 'DARF', rotulo: 'DARF (Receita Federal)', precisa: 'mes' }, { id: 'DAE', rotulo: 'DAE (estadual)', precisa: 'mes' }, { id: 'DAM', rotulo: 'DAM (municipal)', precisa: 'mes' },
  { id: 'FGTS', rotulo: 'FGTS', precisa: 'mes' }, { id: 'NOTA_RECEBIDA', rotulo: 'Nota fiscal recebida (NF-e, NFS-e, CT-e)', precisa: 'mes' },
  { id: 'NOTA_EMITIDA', rotulo: 'Nota fiscal emitida (NF-e, NFS-e, NFC-e)', precisa: 'mes' }, { id: 'EXTRATO', rotulo: 'Extrato bancário', precisa: 'mes' },
  { id: 'COMPROVANTE', rotulo: 'Comprovante de pagamento', precisa: 'mes' }, { id: 'FOLHA', rotulo: 'Folha de pagamento', precisa: 'mes' },
  { id: 'DEFIS', rotulo: 'DEFIS', precisa: 'ano' }, { id: 'DIRF', rotulo: 'DIRF', precisa: 'ano' }, { id: 'BALANCETE', rotulo: 'Balancete e livros contábeis', precisa: 'ano' },
  { id: 'DOC_CONSTITUTIVO', rotulo: 'Contrato social e documentos constitutivos', precisa: null }, { id: 'OUTROS', rotulo: 'Outros documentos (contábil)', precisa: 'ano' },
];

/** Um PDF de uma página, com o texto, para o "Abrir o arquivo" dos exemplos. */
function pdfDeExemplo(linhas: string[]): Uint8Array {
  const limpa = (l: string) => l.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()\\]/g, '');
  const texto = linhas.map((l, i) => 'BT /F1 ' + (i ? 12 : 16) + ' Tf 60 ' + (760 - i * 26) + ' Td (' + limpa(l) + ') Tj ET').join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + texto.length + ' >>\nstream\n' + texto + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n';
  const pos: number[] = [];
  objs.forEach((o, i) => { pos.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = pdf.length;
  pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return new TextEncoder().encode(pdf);
}

export function criarArquivadorNovoMemoria(): RepoArquivadorNovo {
  // os que o admin já resolveu nos exemplos saem da lista (o painel de exemplo é refeito a cada minuto)
  const resolvidos = new Set<string>();
  const comResolvidos = (p: entregas.PainelDoArquivador): entregas.PainelDoArquivador => {
    const pendentes = p.pendentes.filter(x => !resolvidos.has(x.naPasta || x.rel));
    return { ...p, pendentes, pendentesTotal: pendentes.length };
  };
  let docs: DocsDoArquivadorNovo = { carregado: true, semPermissao: false, painel: comResolvidos(painelDeExemplo()) };
  const dias = new Map<string, DiaDoArquivador>();
  const pedidos = new Map<string, entregas.PedidoDoArquivador>();
  const conteudos = new Map<string, Uint8Array>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const clientes: entregas.ClienteDoFormulario[] = [...CLIENTES, ['568', 'BRAZILIAN EXEMPLO LTDA'], ['413', 'BRAZILIAN FORESTRY EXEMPLO LTDA'], ['284', 'NILMA CONTABILIDADE']]
    .map(([c, n]) => ({ codigo: Number(c), nome: n, temPasta: c !== '593' })).sort((a, b) => a.codigo - b.codigo);
  const nomeDe = (codigo?: number) => clientes.find(c => c.codigo === codigo)?.nome || 'CLIENTE';
  const responder = (id: string, p: entregas.PedidoDoArquivador) => { pedidos.set(id, p); mudou(); };
  const tirarDaLista = (rel: string) => { resolvidos.add(rel); docs = { ...docs, painel: docs.painel && comResolvidos(docs.painel) }; };
  return {
    exemplos: true,
    docs: () => docs,
    acompanhar() {
      const r = setInterval(() => { docs = { ...docs, painel: comResolvidos(painelDeExemplo()) }; mudou(); }, 60 * 1000);
      return () => clearInterval(r);
    },
    dia(dia) {
      let d = dias.get(dia);
      if (!d) { d = { dia, carregado: true, erro: '', itens: diaDeExemplo(dia) }; dias.set(dia, d); }
      return d;
    },
    cadastroDoFormulario: () => ({ carregado: true, em: new Date().toISOString(), clientes, tipos: TIPOS_DE_EXEMPLO }),
    async pedir(n) {
      const id = 'ex-pedido-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const base: entregas.PedidoDoArquivador = { id, tipo: n.tipo, status: 'pendente', erro: '', resposta: null, arquivo: null };
      responder(id, base);
      setTimeout(() => responder(id, { ...base, status: 'trabalhando' }), 400);
      setTimeout(() => {
        const nome = n.nome || n.rel.split('\\').pop() || 'arquivo';
        if (n.tipo === 'abrir') {
          const ehTexto = /\.(xml|txt|ofx|csv)$/i.test(nome);
          const bytes = ehTexto ? new TextEncoder().encode('<?xml version="1.0"?>\n<!-- exemplo: o conteúdo de ' + nome + ' -->\n<nfeProc><NFe/></nfeProc>\n')
            : pdfDeExemplo(['Exemplo: ' + nome, 'Este e o arquivo que esta em', 'NAO IDENTIFICADOS (dados de exemplo).', 'No banco, o robo do PC manda o arquivo de verdade.']);
          conteudos.set(id, bytes);
          responder(id, { ...base, status: 'pronto', arquivo: { nome, mime: ehTexto ? 'text/xml' : 'application/pdf', tamanho: bytes.length, partes: 1 } });
          return;
        }
        if (n.tipo === 'descartar') {
          tirarDaLista(n.rel);
          responder(id, { ...base, status: 'feito', resposta: { acao: 'DESCARTAR', destino: 'QUARENTENA\\' + nome, nomeFinal: nome, situacao: '', pastaNova: '', copias: [], motivo: '', evidencias: ['descartado no nads (exemplo)'], cliente: '', clienteNome: '', tipo: 'DESCARTE' } });
          return;
        }
        const tipo = TIPOS_DE_EXEMPLO.find(t => t.id === n.tipoDoc);
        const comp = n.competencia ? (n.competencia.length === 7 ? n.competencia.slice(5) + '-' + n.competencia.slice(0, 4) : n.competencia) : '';
        if (!tipo || (tipo.precisa && !comp) || (tipo.precisa === 'mes' && comp.length !== 7)) {
          responder(id, { ...base, status: 'erro', erro: tipo ? 'o tipo ' + tipo.rotulo + ' precisa ' + (tipo.precisa === 'ano' ? 'do ano' : 'do mês (MM/AAAA)') : 'escolha o tipo' });
          return;
        }
        if (tipo.id === 'AUTO') { responder(id, { ...base, status: 'erro', erro: 'as regras não chegaram a um destino para este cliente (exemplo): escolha o tipo' }); return; }
        const pasta = n.codigo + ' - ' + nomeDe(n.codigo);
        const montar = PASTA_DE_EXEMPLO[tipo.id] || ((c: string) => 'CONTÁBIL\\OUTROS DOCUMENTOS\\' + c.slice(-4) + '\\' + nome);
        const destino = pasta + '\\' + montar(comp || '2026');
        const resposta: entregas.RespostaDoPedido = {
          acao: 'ARQUIVAR', destino, nomeFinal: destino.split('\\').pop() || nome, situacao: 'NOVO', pastaNova: n.codigo === 593 ? pasta : '', copias: [], motivo: '',
          evidencias: ['decidido por você no nads: ' + pasta + ' · ' + tipo.rotulo + (comp ? ' · ' + comp : '') + ' (exemplo)'], cliente: String(n.codigo), clienteNome: nomeDe(n.codigo), tipo: tipo.id,
        };
        if (n.tipo === 'previa') { responder(id, { ...base, status: 'pronto', resposta }); return; }
        tirarDaLista(n.rel);
        responder(id, { ...base, status: 'feito', resposta });
      }, n.tipo === 'previa' ? 900 : 1600);
      return id;
    },
    pedido: id => pedidos.get(id) || null,
    conteudo: async id => conteudos.get(id) || new Uint8Array(),
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
