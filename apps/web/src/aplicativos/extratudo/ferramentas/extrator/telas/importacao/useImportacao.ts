// ViewModel da Importação do Extrator: duas caixas (extratos bancários e lançamentos contábeis),
// cada uma com vários arquivos de uma vez. Lê cada arquivo no navegador (o arquivo não é guardado),
// pergunta "apenas novas / sobrepor" quando já existe lançamento nas mesmas datas e mostra o
// resultado na mensagem flutuante. Embaixo, os arquivos importados, com Excluir.
import { demo, empresas, extrator as x, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSessao } from '../../casca/sessao';
import { useCadastroDaEmpresa } from '../../dados/repo';
import { useGuardado } from '../../../../../../comum/guardado';

/** 'aaaa-mm' do mês passado (a competência que o escritório trabalha). */
function mesPassado(): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
}

export interface ConfigCaixa {
  lado: x.Lado;
  titulo: string;
  icone: 'landmark' | 'list';
  dica?: string;
  formato: string;
  aceitar: string;
  idArquivo: string;
}

export const CAIXAS: ConfigCaixa[] = [
  {
    lado: 'banco', titulo: 'Extratos bancários', icone: 'landmark', idArquivo: 'fExtrato',
    formato: 'PDF do banco (também aceita OFX e o escaneado: PDF ou foto, pelo OCR)', aceitar: x.EXTENSOES_EXTRATO.join(','),
  },
  {
    lado: 'sistema', titulo: 'Lançamentos contábeis', icone: 'list', idArquivo: 'fSistema',
    formato: 'Razão da conta do banco em Excel, CSV ou PDF', aceitar: x.EXTENSOES_SISTEMA.join(','),
    dica: 'Precisa das colunas de data, histórico e valor (ou débito e crédito). Débito na conta do banco conta como entrada.',
  },
];

/** O que a mensagem flutuante mostra (a View desenha). */
export interface Mensagem {
  tom: 'erro' | 'ok' | 'info';
  titulo: string;
  textos: { texto: string; tom?: 'aviso' }[];
}

const NOME: Record<x.Lado, string> = { banco: 'o extrato', sistema: 'o sistema' };

function novoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function useImportacao() {
  const s = useSessao();
  const { toast, modal } = useRetorno();
  const [params, setParams] = useSearchParams();
  const competenciaDeTeste = /^\d{4}-\d{2}$/.test(params.get('competencia') || '') ? (params.get('competencia') as string) : mesPassado();
  const [escolhidos, setEscolhidos] = useState<Record<x.Lado, File[]>>({ banco: [], sistema: [] });
  const [lendo, setLendo] = useState<x.Lado | null>(null);
  /** a linha de banco que está importando: 'banco|lado' */
  const [lendoLinha, setLendoLinha] = useState<string | null>(null);
  // o extrato sem movimento: quem marca o mês como sem movimento no banco (a Tarefa, pela ponte)
  const aoSemMovimento = useRef<((banco: string, meses: string[]) => void) | null>(null);
  // o arquivo do Drive de cada mês marcado sem movimento pelo extrato ('banco|mes' → o arquivo), para o olhinho do "s/ mov."
  // (Vitor, 19/10/2026: "o sem movimento, aparecer também o olhinho, para ver se é isso mesmo"); o extrato não fica guardado
  const [semMovDoDrive, setSemMovDoDrive] = useGuardado<Record<string, { id: string; nome: string }>>('semmov-drive|' + (s.codigo ?? s.nome), {});
  // os bancos da empresa na competência (uma linha cada), do Cadastro da empresa quando ela tem (Tarefas ›
  // Cadastro); arquivo sem banco = do primeiro banco
  const cad = useCadastroDaEmpresa(s.nome, s.codigo);
  const cadAtual = useRef(cad);
  cadAtual.current = cad;
  const perguntouServicos = useRef(false);
  /**
   * "Esta empresa presta serviços?" na Importação da Tarefa (Vitor, 21/10/2026: saiu da Conferência fiscal, "fica melhor no
   * fluxo"): uma vez, quando o Cadastro da empresa ainda não diz; a resposta vai para o Cadastro (a aba Prestados e a
   * Conferência seguem ela).
   */
  async function perguntarServicos() {
    if (perguntouServicos.current || !cad.cadastro || cad.cadastro.prestaServico != null) return;
    perguntouServicos.current = true;
    const sim = await modal<boolean>({
      obrigatoria: true, icone: 'briefcase', titulo: 'Esta empresa presta serviços?',
      html: 'A empresa <b>' + escapar((s.codigo != null ? s.codigo + ' — ' : '') + s.nome) + '</b> presta serviços? A resposta fica no Cadastro da empresa e decide a aba Prestados.',
      botoes: [{ rotulo: 'Não', valor: false, variante: 'btn-outline' }, { rotulo: 'Sim', valor: true, variante: 'btn-primary' }],
    });
    const atual = cadAtual.current;
    if (!atual.cadastro || atual.cadastro.prestaServico != null) return;
    atual.salvar(empresas.cadastro.definirPrestaServico(atual.cadastro, sim, 'Importação', new Date()));
  }
  const { bancos, primeiro } = x.bancosDaEmpresaNa(s.empresa, cad.cadastro, s.codigo, competenciaDeTeste);
  // (19/10/2026: "o nads está lerdo em outras máquinas") os arquivos de cada banco, lado e mês num índice, montado de novo só
  // quando a empresa muda; o movimento de cada banco e as listas do Drive, também uma vez por versão da empresa
  const indice = useMemo(() => x.indiceDosArquivos(s.empresa, primeiro), [s.empresa, primeiro]);
  const arquivosDe = (banco: string, lado: x.Lado, competencia: string) => indice(banco, lado, competencia);
  // um cache novo quando a empresa, o banco padrão ou o mês mudam (as dependências são a chave do cache)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const movimentos = useMemo(() => new Map<string, x.MovimentoDoExtrato>(), [s.empresa, primeiro, competenciaDeTeste]);
  const extratosSemSaldo = useMemo(() => x.extratosSemSaldoAnterior(s.empresa, primeiro), [s.empresa, primeiro]);
  const extratosParaReler = useMemo(() => x.extratosParaReler(s.empresa), [s.empresa]);
  const extratosParaRelerPeloDrive = useMemo(() => x.extratosParaRelerPeloDrive(s.empresa), [s.empresa]);
  // o mesmo lançamento em dois extratos do mesmo banco (a página da virada do mês nos dois PDFs): a cópia a mais sai, sozinha
  // (Vitor, 26/10/2026: o Stone da 183 com os de 31/01 "duas vezes no extrato")
  const { aplicar } = s;
  useEffect(() => {
    const bancoDe = (a: x.ArquivoImportado) => x.bancoDoArquivo(a, primeiro);
    if (x.tirarSobreposicaoDosExtratos(s.empresa, bancoDe, new Date()).tirados) aplicar(e => x.tirarSobreposicaoDosExtratos(e, bancoDe, new Date()).empresa);
  }, [s.empresa, primeiro, aplicar]);
  const [mensagem, setMensagemBruta] = useState<Mensagem | null>(null);
  const [seqMensagem, setSeq] = useState(0);
  const setMensagem = (m: Mensagem | null) => { setMensagemBruta(m); setSeq(v => v + 1); };
  const fecharMensagem = useCallback(() => setMensagemBruta(null), []);

  function escolher(lado: x.Lado, fs: File[]) {
    setMensagemBruta(null);
    setEscolhidos(e => {
      const nomes = new Set(e[lado].map(f => f.name + f.size));
      return { ...e, [lado]: e[lado].concat(fs.filter(f => !nomes.has(f.name + f.size))) };
    });
  }
  function tirar(lado: x.Lado, i: number) {
    setEscolhidos(e => ({ ...e, [lado]: e[lado].filter((_, k) => k !== i) }));
  }

  async function importar(lado: x.Lado) {
    const fs = escolhidos[lado];
    setMensagemBruta(null);
    if (!fs.length) { setMensagem({ tom: 'erro', titulo: 'Escolha o arquivo', textos: [{ texto: lado === 'banco' ? 'Selecione os PDFs do extrato antes de importar.' : 'Selecione o razão da conta do banco antes de importar.' }] }); return; }
    setLendo(lado);
    const lidos: x.ArquivoLido[] = [];
    for (const f of fs) lidos.push(await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), lado));
    await gravarLidos(lado, lidos);
  }

  /** Importar direto (na linha do banco): escolheu os arquivos, já importa para aquele banco. */
  /** Devolve se importou (o extrato que entrou pode ir para o Drive: useDriveDaLinha.subirAoDrive). */
  /** `mesesDaBusca`: o mês da coluna ou da busca no e-mail, para o extrato sem movimento que não diz o mês. */
  async function importarArquivos(banco: string, lado: x.Lado, fs: File[], mesesDaBusca?: string[]): Promise<boolean> {
    if (!fs.length) return false;
    setMensagemBruta(null);
    setLendoLinha(banco + '|' + lado);
    const lidos: x.ArquivoLido[] = [];
    for (const f of fs) lidos.push(await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), lado));
    const ok = await gravarLidos(lado, lidos, banco, undefined, undefined, mesesDaBusca);
    setLendoLinha(null);
    return ok;
  }

  /**
   * O extrato que veio do Drive (já baixado): lê e importa para aquele banco, lembrando do arquivo de lá. `tentativa`: o
   * arquivo sem nada (sem lançamento e sem o "sem movimento") não grava nem avisa e volta 'vazio', para quem chama tentar o
   * próximo arquivo do mês (Vitor, 19/10/2026, na 450: o "MM-2026 (1).pdf" eram comprovantes e o nads dizia que trouxe).
   */
  async function importarDoDrive(banco: string, arquivo: { id: string; nome: string }, conteudo: ArrayBuffer, mes?: string, tentativa = false): Promise<boolean | 'vazio'> {
    setMensagemBruta(null);
    setLendoLinha(banco + '|banco');
    const lido = await x.lerArquivo(arquivo.nome, new Uint8Array(conteudo), 'banco');
    if (tentativa && !lido.semMovimento && (lido.erro || !lido.lancamentos.length)) { setLendoLinha(null); return 'vazio'; }
    const ok = await gravarLidos('banco', [lido], banco, arquivo, undefined, mes ? [mes] : undefined);
    setLendoLinha(null);
    return ok;
  }

  /** O extrato que chegou por e-mail (08/10/2026): lê e importa para aquele banco (o arquivo não fica guardado). */
  async function importarRecebido(banco: string, nome: string, conteudo: ArrayBuffer, sozinho = false) {
    setMensagemBruta(null);
    setLendoLinha(banco + '|banco');
    const lido = await x.lerArquivo(nome, new Uint8Array(conteudo), 'banco');
    // sozinho (ao abrir a tarefa): sem pergunta — se já houver movimento nas datas, só o que é novo (nunca apaga)
    const ok = await gravarLidos('banco', [lido], banco, undefined, sozinho ? 'novas' : undefined);
    setLendoLinha(null);
    return ok;
  }

  /** O que vem depois de ler: pergunta o modo (se já houver movimento nas datas), importa e avisa. */
  async function gravarLidos(lado: x.Lado, lidos: x.ArquivoLido[], banco?: string, doDrive?: { id: string; nome: string }, modoFixo?: x.ModoImportacao, mesesDaBusca?: string[]): Promise<boolean> {
    // o extrato que diz que não teve movimento ("Nenhuma movimentação encontrada"): marca o mês como sem movimento e avisa
    // (Vitor, 13/10/2026), em vez de "Nada para importar"
    const semMov = lado === 'banco' && banco ? lidos.filter(l => l.semMovimento) : [];
    // o extrato não diz o mês: vale o mês de onde ele veio (a coluna, a busca no e-mail, a pasta do Drive; Vitor, 19/10/2026)
    const doTexto = [...new Set(semMov.flatMap(l => l.semMovimento || []))].sort();
    const meses = doTexto.length ? doTexto : semMov.length ? [...new Set(mesesDaBusca || [])].sort() : [];
    if (semMov.length) {
      if (meses.length && aoSemMovimento.current) aoSemMovimento.current(banco as string, meses);
      // veio do Drive: o arquivo de lá fica para o olhinho do mês
      if (doDrive && meses.length) setSemMovDoDrive(x => ({ ...x, ...Object.fromEntries(meses.map(m => [banco + '|' + m, doDrive])) }));
      lidos = lidos.filter(l => !l.semMovimento);
      const rotulo = meses.map(m => m.slice(5) + '/' + m.slice(0, 4)).join(', ');
      if (!lidos.length) {
        setLendo(null);
        setMensagem({ tom: 'info', titulo: 'Extrato sem movimento' + (rotulo ? ': ' + rotulo : ''), textos: [{ texto: meses.length ? (meses.length === 1 ? 'O mês ficou marcado' : 'Os meses ficaram marcados') + ' como sem movimento neste banco.' : 'O extrato não diz o mês: marque o mês como sem movimento na grade.' }] });
        return meses.length > 0;
      }
    }
    const falhas = lidos.filter(l => l.erro || !l.lancamentos.length);
    const bons = lidos.filter(l => !l.erro && l.lancamentos.length);
    if (!bons.length) {
      setLendo(null);
      setMensagem({ tom: 'erro', titulo: 'Nada para importar', textos: falhas.map(f => ({ texto: f.nome + ': ' + (f.erro || 'nenhum lançamento') })) });
      return false;
    }
    const qtdLida = bons.reduce((t, l) => t + l.lancamentos.length, 0);
    let modo: x.ModoImportacao | 'primeira' = 'primeira';
    // de um banco só: "apenas novas" e "sobrepor" olham só os arquivos daquele banco
    const doBanco = (a: x.ArquivoImportado) => !banco || x.bancoDoArquivo(a, primeiro) === banco;
    const base = banco ? { ...s.empresa, arquivos: s.empresa.arquivos.filter(doBanco) } : s.empresa;
    const existentes = x.jaTemNoPeriodo(base, lado, bons);
    if (existentes && modoFixo) modo = modoFixo;
    else if (existentes) {
      const escolha = await modal<x.ModoImportacao | null>({
        icone: 'upload', titulo: 'Como importar ' + NOME[lado] + '?',
        html: 'Já existem <b>' + existentes + ' lançamento(s)</b> nas datas destes arquivos; os arquivos têm <b>' + qtdLida + '</b>.<br><br>' +
          '<b>Importar apenas novas</b> — mantém o que já está guardado e só acrescenta o que ainda não existe (mesma data, valor e histórico).<br><br>' +
          '<b>Sobrepor o movimento</b> — apaga o que está guardado nessas datas e fica com o que veio nos arquivos.',
        botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Sobrepor o movimento', valor: 'sobrepor', variante: 'btn-danger' }, { rotulo: 'Importar apenas novas', valor: 'novas', variante: 'btn-primary' }],
      });
      if (!escolha) { setLendo(null); toast('Importação cancelada — nada foi alterado.'); return false; }
      modo = escolha;
    }
    // importa sobre a empresa guardada agora (não a desta tela): "Todos pelo Drive" grava um mês atrás do outro
    const feito: { res?: ReturnType<typeof x.importar> } = {};
    s.aplicar(e => {
      const agora = banco ? { ...e, arquivos: e.arquivos.filter(doBanco) } : e;
      const res = x.importar(agora, lado, bons, modo, new Date(), novoId);
      feito.res = res;
      if (!banco) return res.empresa;
      const antes = new Set(agora.arquivos.map(a => a.id));
      const outros = e.arquivos.filter(a => !doBanco(a));
      return { ...res.empresa, arquivos: [...outros, ...res.empresa.arquivos.map(a => (antes.has(a.id) ? a : { ...a, banco, ...(doDrive ? { drive: doDrive } : {}) }))] };
    });
    setLendo(null);
    const res = feito.res;
    if (!res) { setMensagem({ tom: 'erro', titulo: 'A empresa ainda está carregando', textos: [{ texto: 'Espere um instante e tente de novo.' }] }); return false; }
    setEscolhidos(e => ({ ...e, [lado]: [] }));
    const textos: Mensagem['textos'] = [];
    if (res.jaExistiam) textos.push({ texto: res.jaExistiam + ' já estavam guardados e ficaram como estavam.' });
    if (res.substituidos) textos.push({ texto: res.substituidos + ' lançamento(s) que estavam guardados nessas datas foram substituídos.' });
    for (const f of falhas) textos.push({ texto: f.nome + ' ficou de fora: ' + (f.erro || 'nenhum lançamento') + '.', tom: 'aviso' });
    // o escaneado lido pelo OCR (Vitor, 13/10/2026): o reconhecimento pode errar um dígito, então pede para conferir
    const porOcr = bons.filter(l => l.ocr).map(l => l.nome);
    if (porOcr.length) textos.push({ texto: porOcr.join(', ') + ' era imagem e foi lido pelo OCR: confira os valores com o arquivo.', tom: 'aviso' });
    setMensagem({ tom: 'ok', titulo: res.gravados + ' lançamento(s) importado(s)' + (modo === 'sobrepor' ? ' — movimento sobreposto' : ''), textos });
    return true;
  }

  /**
   * PROTÓTIPO: importa um extrato ou razão inventado da competência (a da tarefa, quando vem na URL;
   * senão, o mês passado), pelo mesmo caminho de um arquivo de verdade. O nome do arquivo diz TESTE.
   */
  /** A empresa de teste (Personaly Company): implanta os extratos ou o razão fictícios do período, como se fossem importados. */
  async function implantarDadosDeTeste(banco: string, o: 'extratos' | demo.RazaoDeTeste) {
    const ms = (params.get('meses') || '').split(',').filter(m => /^\d{4}-\d{2}$/.test(m));
    const meses = ms.length ? ms : [competenciaDeTeste];
    const lado: x.Lado = o === 'extratos' ? 'banco' : 'sistema';
    setMensagemBruta(null);
    setLendoLinha(banco + '|' + lado);
    await gravarLidos(lado, o === 'extratos' ? demo.extratosDeTeste(meses) : demo.razaoDeTeste(meses, o), banco);
    setLendoLinha(null);
  }

  async function importarTeste(lado: x.Lado, banco?: string) {
    setMensagemBruta(null);
    setLendo(lado);
    if (banco) setLendoLinha(banco + '|' + lado);
    await gravarLidos(lado, [x.arquivoDeTeste(lado, competenciaDeTeste)], banco);
    setLendoLinha(null);
  }

  /** Os outros meses que os arquivos têm (o extrato ou o razão que o cliente mandou quebrado, de vários meses). */
  const outrosMeses = (arqs: x.ArquivoImportado[], meses: readonly string[]) =>
    [...new Set(arqs.flatMap(a => a.lancamentos.map(l => l.data.slice(0, 7))))].filter(m => !meses.includes(m)).sort();
  const rotuloMes = (m: string) => m.slice(5) + '/' + m.slice(0, 4);

  /**
   * O check verde da linha: exclui o que foi importado daquele banco e lado na competência (pergunta antes). Só o mês: o
   * arquivo de vários meses fica nos outros (Vitor, 21/10/2026: "deixa eu conseguir excluir apenas o mês que selecionei,
   * ao invés de excluir tudo"; no extrato e no razão).
   */
  async function excluirDoBanco(banco: string, lado: x.Lado, competencia = competenciaDeTeste) {
    const arqs = arquivosDe(banco, lado, competencia);
    if (!arqs.length) return;
    const nomeBanco = bancos.find(b => b.id === banco)?.nome || 'banco';
    const ficam = outrosMeses(arqs, [competencia]);
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir a importação?',
      ...(ficam.length ? { html: 'Só <b>' + rotuloMes(competencia) + '</b> sai. ' + (arqs.length === 1 ? 'O arquivo' : 'Os arquivos') + ' também ' + (arqs.length === 1 ? 'tem' : 'têm') + ' ' + ficam.map(rotuloMes).join(', ') + ', que ' + (ficam.length === 1 ? 'fica' : 'ficam') + '.' } : {}),
      botoes: [{ rotulo: 'Excluir', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!ok) return;
    s.aplicar(e => arqs.reduce((acc, a) => x.excluirMesesDoArquivo(acc, a.id, [competencia], new Date()), e));
    setMensagem({ tom: 'ok', titulo: 'Importação excluída', textos: [{ texto: nomeBanco + ' · ' + (lado === 'banco' ? 'extrato' : 'razão') + ' · ' + rotuloMes(competencia) }] });
  }

  /**
   * Em Lote, "Remover todos": exclui o extrato (ou o razão) do banco em todos os meses do período, com uma pergunta só. Só
   * os meses do período: o arquivo que passa dele fica com os meses de fora (21/10/2026).
   */
  async function excluirDoPeriodo(banco: string, lado: x.Lado, meses: string[]) {
    const porId = new Map<string, x.ArquivoImportado>();
    for (const m of meses) for (const a of arquivosDe(banco, lado, m)) porId.set(a.id, a);
    const arqs = [...porId.values()];
    if (!arqs.length) return;
    const nomeBanco = bancos.find(b => b.id === banco)?.nome || 'banco';
    const oQue = lado === 'banco' ? 'extrato' : 'razão';
    const qtd = arqs.reduce((t, a) => t + a.lancamentos.filter(l => meses.includes(l.data.slice(0, 7))).length, 0);
    const ficam = outrosMeses(arqs, meses);
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Remover todos?',
      html: 'O ' + oQue + ' do <b>' + escapar(nomeBanco) + '</b> nos ' + meses.length + ' meses: ' + arqs.length + (arqs.length === 1 ? ' arquivo' : ' arquivos') +
        ' (' + qtd + ' lançamentos). Dá para importar de novo depois.' + (ficam.length ? ' Fora do período, ' + ficam.map(rotuloMes).join(', ') + (ficam.length === 1 ? ' fica.' : ' ficam.') : ''),
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Remover todos', valor: true, variante: 'btn-danger' }],
    });
    if (!ok) return;
    s.aplicar(e => arqs.reduce((acc, a) => x.excluirMesesDoArquivo(acc, a.id, meses, new Date()), e));
    setMensagem({ tom: 'ok', titulo: 'Importações removidas', textos: [{ texto: nomeBanco + ' · ' + oQue + ' · ' + meses.length + ' meses' }] });
  }

  /**
   * Adicionar banco (uma conta: banco, agência e conta): vai para o Cadastro da empresa, valendo desta competência
   * em diante. Empresa sem bancos cadastrados: o cadastro começa com os que o Extrator já usava.
   */
  function adicionarBanco(marca: empresas.BancoDaEmpresa, agencia: string, conta: string) {
    const rotulo = empresas.rotuloDaConta({ agencia: agencia.trim(), conta: conta.trim() });
    if (!cad.cadastro) { setMensagem({ tom: 'erro', titulo: 'O cadastro da empresa ainda está chegando', textos: [{ texto: 'Tente de novo em instantes.' }] }); return; }
    const partida = empresas.cadastro.pontoDePartida(s.codigo, s.empresa.bancos || []);
    const r = empresas.cadastro.salvarConta(cad.cadastro, null, { marca: marca.id, agencia, conta, tipo: 'corrente', desde: competenciaDeTeste }, partida, 'Extrator', new Date());
    if (r.erro) { setMensagem({ tom: 'erro', titulo: r.erro === 'Essa conta já está cadastrada.' ? 'Essa conta já está na lista' : r.erro, textos: [{ texto: marca.nome + ' · ' + rotulo }] }); return; }
    cad.salvar(r.cadastro);
    setMensagem({ tom: 'ok', titulo: marca.nome + ' adicionado', textos: [{ texto: rotulo + ' · no Cadastro da empresa' }] });
  }

  async function excluir(id: string) {
    const a = s.empresa.arquivos.find(v => v.id === id);
    if (!a) return;
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir este arquivo?',
      html: 'Os <b>' + a.lancamentos.length + ' lançamento(s)</b> de <b>' + escapar(a.nome) + '</b> saem da conferência. Dá para importar de novo depois.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
    });
    if (!ok) return;
    excluirJa(id);
  }

  /** Exclui sem perguntar (quem pediu já perguntou: a etapa da Tarefas). */
  const excluirJa = useCallback((id: string) => {
    const a = s.empresa.arquivos.find(v => v.id === id);
    if (!a) return;
    s.aplicar(e => x.excluirArquivo(e, id, new Date()));
    setMensagemBruta({ tom: 'ok', titulo: 'Arquivo excluído', textos: [{ texto: a.nome }] });
    setSeq(v => v + 1);
  }, [s]);

  const arquivos = useMemo(() => s.empresa.arquivos.slice().sort((a, b) => b.importadoEm.localeCompare(a.importadoEm)).map(a => ({
    id: a.id, lado: a.lado, nome: a.nome, qtd: a.lancamentos.length,
    periodo: x.rotuloPeriodo(x.periodo(a.lancamentos)), quando: a.importadoEm,
  })), [s.empresa]);

  return {
    caixas: CAIXAS.map(c => ({ ...c, escolhidos: escolhidos[c.lado], lendo: lendo === c.lado })),
    escolher, tirar, importar, importarTeste, excluir, excluirJa,
    // linhas de banco (a etapa da Tarefas)
    competencia: competenciaDeTeste,
    rotuloCompetencia: tarefas.rotuloCurtoCompetencia(competenciaDeTeste),
    // a partir de 01/2026 (o primeiro mês do nads)
    competencias: tarefas.competenciasRecentes(new Date(), 24).filter(c => c >= tarefas.PRIMEIRA_COMPETENCIA).map(c => ({ valor: c, rotulo: tarefas.rotuloCompetencia(c) })),
    /** Fora da Tarefas: troca a competência na URL (dentro dela, quem troca é a Tarefas, pela ponte). */
    setCompetencia: (c: string) => { const n = new URLSearchParams(params); n.set('competencia', c); setParams(n); },
    /**
     * A Etapa com vários meses: os meses do período (?meses=aaaa-mm,…; vazio = um mês só) e, de cada um, se
     * já está pronto (todo banco com extrato e razão do mês, ou sem movimento naquele mês).
     */
    periodo: (params.get('meses') || '').split(',').filter(m => /^\d{4}-\d{2}$/.test(m)),
    /** aberta pela etapa Cheque especial da Tarefas (a mesma página, só os bancos, com o aviso do cheque) */
    etapaCheque: params.get('etapa') === 'cheque',
    /** aberta pela Importação no Alterdata do Fiscal: só as abas das notas (Entradas, Saídas, Tomados, Prestados) */
    etapaFiscal: params.get('etapa') === 'fiscal',
    /** De cada mês do período, o que o banco já tem: extrato, razão, sem movimento. */
    mesesDoBanco: (banco: string, semMovimentoPorMes: Record<string, string[]>) =>
      (params.get('meses') || '').split(',').filter(m => /^\d{4}-\d{2}$/.test(m)).map(mes => {
        const lado = (l: x.Lado) => {
          const arqs = arquivosDe(banco, l, mes);
          return {
            qtdArquivos: arqs.length, qtdLancamentos: arqs.reduce((t, a) => t + a.lancamentos.filter(z => z.data.startsWith(mes)).length, 0),
            lendo: lendoLinha === banco + '|' + l, doDrive: arqs.flatMap(a => (a.drive ? [a.drive] : [])),
          };
        };
        const extrato = lado('banco');
        const razao = lado('sistema');
        return {
          mes, rotulo: tarefas.rotuloNumericoCompetencia(mes),
          extrato: extrato.qtdArquivos > 0, razao: razao.qtdArquivos > 0, ladoExtrato: extrato, ladoRazao: razao,
          semMovimento: (semMovimentoPorMes[mes] || []).includes(banco),
        };
      }),
    prontoNoMes: (competencia: string, semMovimento: string[]) => {
      const bs = x.bancosDaEmpresaNa(s.empresa, cad.cadastro, s.codigo, competencia).bancos;
      return bs.length > 0 && bs.every(b => semMovimento.includes(b.id) ||
        (arquivosDe(b.id, 'banco', competencia).length > 0 && arquivosDe(b.id, 'sistema', competencia).length > 0));
    },
    primeiro,
    /** a empresa não tem conta bancária no Cadastro (só a linha genérica "Banco"): um administrador precisa cadastrar */
    semBancosCadastrados: !!cad.cadastro && bancos.every(b => b.id === 'banco'),
    /** o Cadastro ainda não tem os bancos (vale a lista provisória, ou nenhuma): o Confirme os bancos aparece (21/10/2026) */
    bancosNaoCadastrados: !!cad.cadastro && !cad.cadastro.bancos,
    bancos: bancos.map(b => {
      const lado = (l: x.Lado) => {
        const arqs = arquivosDe(b.id, l, competenciaDeTeste);
        return {
          qtdArquivos: arqs.length, qtdLancamentos: arqs.reduce((t, a) => t + a.lancamentos.length, 0), lendo: lendoLinha === b.id + '|' + l,
          /** os arquivos que vieram do Drive (para o Visualizar pedir o link temporário); o do mês (o com mais lançamentos
              na competência) por último, que é o que o "ver PDF" abre (Vitor, 09/10/2026: janeiro abria o PDF de fevereiro) */
          doDrive: arqs.map(a => ({ a, n: a.lancamentos.filter(z => z.data.startsWith(competenciaDeTeste)).length }))
            .sort((p, q) => p.n - q.n).flatMap(({ a }) => (a.drive ? [a.drive] : [])),
        };
      };
      return { ...b, marca: b.marca || b.id, numeroConta: b.conta, conta: empresas.rotuloDaConta(b), extrato: lado('banco'), razao: lado('sistema') };
    }),
    // o mesmo banco pode entrar de novo (outra conta, com outra agência/conta)
    bancosParaAdicionar: empresas.BANCOS_CONHECIDOS,
    importarArquivos, importarDoDrive, importarRecebido, excluirDoBanco, excluirDoPeriodo, adicionarBanco,
    /** a empresa de teste (Personaly Company): os botões de dados fictícios (nada vai para o banco) */
    ehEmpresaDeTeste: demo.ehEmpresaDemo(s.nome),
    implantarDadosDeTeste,
    apagarDadosDeTeste: () => demo.apagarDadosDeTeste(),
    /** os extratos que abrem a conta, vindos do Drive sem o saldo anterior (a linha do Drive completa sozinha) */
    extratosSemSaldo,
    /** os extratos do Drive lidos por um leitor mais velho: o useDriveDaLinha relê sozinho (Vitor, 14/10/2026) */
    extratosParaReler,
    /** os importados do computador lidos por um leitor mais velho: o useDriveDaLinha relê pelo PDF do mês no Drive (26/10/2026) */
    extratosParaRelerPeloDrive,
    relerExtrato: (arquivoId: string, lido: x.ArquivoLido) => s.aplicar(e => x.relerExtrato(e, arquivoId, lido, new Date())),
    /** quem marca o mês como sem movimento quando o extrato importado não teve movimento */
    aoSemMovimento: (fn: (banco: string, meses: string[]) => void) => { aoSemMovimento.current = fn; },
    gravarSaldoAnterior: (arquivoId: string, saldo: number) => s.aplicar(e => x.definirSaldoAnterior(e, arquivoId, saldo, new Date())),
    /**
     * O extrato do mês que subiu para o Drive (do computador ou do e-mail) passa a apontar para o arquivo de lá (19/10/2026):
     * os do banco no mês sem Drive e só daquele mês (o de vários meses fica como está).
     */
    ligarMesAoDrive: (banco: string, mes: string, drive: { id: string; nome: string }) => {
      // o mês sem movimento não tem extrato importado: o arquivo do Drive fica para o olhinho do "s/ mov."
      if (!arquivosDe(banco, 'banco', mes).length) { setSemMovDoDrive(m => ({ ...m, [banco + '|' + mes]: drive })); return; }
      s.aplicar(e => x.arquivosDoBanco(e, banco, primeiro, 'banco', mes)
        .filter(a => !a.drive && a.lancamentos.every(l => l.data.startsWith(mes)))
        .reduce((acc, a) => x.definirDriveDoArquivo(acc, a.id, drive, new Date()), e));
    },
    /** o arquivo do Drive do mês marcado sem movimento pelo extrato (null = não tem: marcado à mão, ou do computador) */
    /** os lançamentos importados do lado no mês (o olhinho do mês na grade, quando o arquivo não está à mão), por data */
    lancamentosImportados: (banco: string, lado: x.Lado, mes: string): x.Lancamento[] =>
      arquivosDe(banco, lado, mes).flatMap(a => a.lancamentos.filter(l => l.data.startsWith(mes))).sort((a, b) => a.data.localeCompare(b.data)),
    arquivoSemMovimento: (banco: string, mes: string): { id: string; nome: string } | null => semMovDoDrive[banco + '|' + mes] || null,
    /** a regra do Cadastro da empresa: presta serviços? (null = não informado, ou o cadastro ainda não chegou) */
    prestaServico: cad.cadastro?.prestaServico ?? null,
    perguntarServicos,
    /** o Cadastro da empresa já chegou (antes dele, prestaServico é null sem querer dizer "não informado") */
    cadastroCarregado: !!cad.cadastro,
    /** o código contábil da conta do banco no Cadastro (Contas bancárias); '' = não informado */
    contaContabilDe: (banco: string) => cad.cadastro?.bancos?.find(c => c.id === banco)?.contaContabil || '',
    /** os pedidos de documentos feitos ao cliente (o histórico do Pedir extratos) */
    pedidos: s.empresa.pedidos || [],
    /** o extrato do banco naquela competência já foi importado? (qualquer competência, não só a da tela) */
    extratoImportado: (banco: string, competencia: string) => arquivosDe(banco, 'banco', competencia).length > 0,
    registrarPedido: (reg: x.PedidoRegistrado) => { s.aplicar(e => x.registrarPedido(e, reg)); },
    /** o extrato da conta na competência, com o saldo acumulado (a setinha da linha) */
    movimentoDe: (banco: string) => {
      let m = movimentos.get(banco);
      if (!m) { m = x.movimentoDoExtrato(s.empresa, banco, primeiro, competenciaDeTeste); movimentos.set(banco, m); }
      return m;
    },
    marcarLendo: (banco: string | null) => setLendoLinha(banco ? banco + '|banco' : null),
    avisar: (titulo: string) => setMensagem({ tom: 'info', titulo, textos: [] }),
    avisarErro: (titulo: string, texto: string) => setMensagem({ tom: 'erro', titulo, textos: [{ texto }] }),
    ocupado: lendo !== null,
    mensagem, seqMensagem, fecharMensagem,
    arquivos,
  };
}

function escapar(t: string): string {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
