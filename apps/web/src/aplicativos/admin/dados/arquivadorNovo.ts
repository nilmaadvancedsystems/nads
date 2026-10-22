// O acompanhamento do arquivador novo (Admin › Arquivador, 22/10/2026): o que o robô do PC publica em
// robo/arquivadorNovo.painel e o histórico do dia em robo/arquivadorNovo/dias/{dia}-{n} (robo/arquivador-acompanhamento.js).
// No banco: arquivadorNovo.firestore.ts (ouve o painel enquanto a página está aberta; o histórico de um dia só quando a aba
// Arquivados pede). Nos exemplos: aqui, com a primeira passada do arquivador em andamento (as datas contadas a partir de
// agora, para a tela sempre parecer viva).
import { entregas } from '@nads/core';

export interface DocsDoArquivadorNovo {
  carregado: boolean;
  /** a leitura foi negada (quem não é admin) */
  semPermissao: boolean;
  painel: entregas.PainelDoArquivador | null;
}

/** O histórico de um dia (as partes juntas, o mais novo primeiro). */
export interface DiaDoArquivador { dia: string; carregado: boolean; erro: string; itens: entregas.ItemDoArquivador[] }

export interface RepoArquivadorNovo {
  readonly exemplos: boolean;
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
    motivo: '', motivoTexto: '', sugestao: '', destinoSugerido: '', erro: '', erroTipo: '', erroTitulo: '', oQueFazer: '', naoAplicado: '',
  };
}

const PENDENTES: readonly Partial<entregas.ItemDoArquivador>[] = [
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
    motivo: '', motivoTexto: '', sugestao: '', destinoSugerido: '', erro: '', erroTipo: '', erroTitulo: '', oQueFazer: '', naoAplicado: '' };
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
  const pendentes = PENDENTES.map((p, i) => ({ ...vazioDoItem(), ...p, id: 'pen-' + i, em: ha(3 + i * 11), rel: '2026-10\\' + p.nome }));
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

export function criarArquivadorNovoMemoria(): RepoArquivadorNovo {
  let docs: DocsDoArquivadorNovo = { carregado: true, semPermissao: false, painel: painelDeExemplo() };
  const dias = new Map<string, DiaDoArquivador>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  return {
    exemplos: true,
    docs: () => docs,
    acompanhar() {
      const r = setInterval(() => { docs = { ...docs, painel: painelDeExemplo() }; ver++; for (const f of ouvintes) f(); }, 60 * 1000);
      return () => clearInterval(r);
    },
    dia(dia) {
      let d = dias.get(dia);
      if (!d) { d = { dia, carregado: true, erro: '', itens: diaDeExemplo(dia) }; dias.set(dia, d); }
      return d;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
