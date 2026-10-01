// ViewModel da Importação do Extrator: duas caixas (extratos bancários e lançamentos contábeis),
// cada uma com vários arquivos de uma vez. Lê cada arquivo no navegador (o arquivo não é guardado),
// pergunta "apenas novas / sobrepor" quando já existe lançamento nas mesmas datas e mostra o
// resultado na mensagem flutuante. Embaixo, os arquivos importados, com Excluir.
import { empresas, extrator as x, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSessao } from '../../casca/sessao';
import { useCadastroDaEmpresa } from '../../dados/repo';

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
  dica: string;
  formato: string;
  aceitar: string;
  idArquivo: string;
}

export const CAIXAS: ConfigCaixa[] = [
  {
    lado: 'banco', titulo: 'Extratos bancários', icone: 'landmark', idArquivo: 'fExtrato',
    formato: 'PDF do banco (também aceita OFX)', aceitar: x.EXTENSOES_EXTRATO.join(','),
    dica: 'Pode escolher vários PDFs de uma vez. Lê data, histórico e valor de cada lançamento; o PDF não é guardado.',
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
  // os bancos da empresa na competência (uma linha cada), do Cadastro da empresa quando ela tem (Tarefas ›
  // Cadastro); arquivo sem banco = do primeiro banco
  const cad = useCadastroDaEmpresa(s.nome, s.codigo);
  const { bancos, primeiro } = x.bancosDaEmpresaNa(s.empresa, cad.cadastro, s.codigo, competenciaDeTeste);
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
  async function importarArquivos(banco: string, lado: x.Lado, fs: File[]) {
    if (!fs.length) return;
    setMensagemBruta(null);
    setLendoLinha(banco + '|' + lado);
    const lidos: x.ArquivoLido[] = [];
    for (const f of fs) lidos.push(await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), lado));
    await gravarLidos(lado, lidos, banco);
    setLendoLinha(null);
  }

  /** O extrato que veio do Drive (já baixado): lê e importa para aquele banco, lembrando do arquivo de lá. */
  async function importarDoDrive(banco: string, arquivo: { id: string; nome: string }, conteudo: ArrayBuffer) {
    setMensagemBruta(null);
    setLendoLinha(banco + '|banco');
    const lido = await x.lerArquivo(arquivo.nome, new Uint8Array(conteudo), 'banco');
    await gravarLidos('banco', [lido], banco, arquivo);
    setLendoLinha(null);
  }

  /** O que vem depois de ler: pergunta o modo (se já houver movimento nas datas), importa e avisa. */
  async function gravarLidos(lado: x.Lado, lidos: x.ArquivoLido[], banco?: string, doDrive?: { id: string; nome: string }) {
    const falhas = lidos.filter(l => l.erro || !l.lancamentos.length);
    const bons = lidos.filter(l => !l.erro && l.lancamentos.length);
    if (!bons.length) {
      setLendo(null);
      setMensagem({ tom: 'erro', titulo: 'Nada para importar', textos: falhas.map(f => ({ texto: f.nome + ': ' + (f.erro || 'nenhum lançamento') })) });
      return;
    }
    const qtdLida = bons.reduce((t, l) => t + l.lancamentos.length, 0);
    let modo: x.ModoImportacao | 'primeira' = 'primeira';
    // de um banco só: "apenas novas" e "sobrepor" olham só os arquivos daquele banco
    const doBanco = (a: x.ArquivoImportado) => !banco || x.bancoDoArquivo(a, primeiro) === banco;
    const base = banco ? { ...s.empresa, arquivos: s.empresa.arquivos.filter(doBanco) } : s.empresa;
    const existentes = x.jaTemNoPeriodo(base, lado, bons);
    if (existentes) {
      const escolha = await modal<x.ModoImportacao | null>({
        icone: 'upload', titulo: 'Como importar ' + NOME[lado] + '?',
        html: 'Já existem <b>' + existentes + ' lançamento(s)</b> nas datas destes arquivos; os arquivos têm <b>' + qtdLida + '</b>.<br><br>' +
          '<b>Importar apenas novas</b> — mantém o que já está guardado e só acrescenta o que ainda não existe (mesma data, valor e histórico).<br><br>' +
          '<b>Sobrepor o movimento</b> — apaga o que está guardado nessas datas e fica com o que veio nos arquivos.',
        botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Sobrepor o movimento', valor: 'sobrepor', variante: 'btn-danger' }, { rotulo: 'Importar apenas novas', valor: 'novas', variante: 'btn-primary' }],
      });
      if (!escolha) { setLendo(null); toast('Importação cancelada — nada foi alterado.'); return; }
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
    if (!res) { setMensagem({ tom: 'erro', titulo: 'A empresa ainda está carregando', textos: [{ texto: 'Espere um instante e tente de novo.' }] }); return; }
    setEscolhidos(e => ({ ...e, [lado]: [] }));
    const textos: Mensagem['textos'] = [];
    if (res.jaExistiam) textos.push({ texto: res.jaExistiam + ' já estavam guardados e ficaram como estavam.' });
    if (res.substituidos) textos.push({ texto: res.substituidos + ' lançamento(s) que estavam guardados nessas datas foram substituídos.' });
    for (const f of falhas) textos.push({ texto: f.nome + ' ficou de fora: ' + (f.erro || 'nenhum lançamento') + '.', tom: 'aviso' });
    setMensagem({ tom: 'ok', titulo: res.gravados + ' lançamento(s) importado(s)' + (modo === 'sobrepor' ? ' — movimento sobreposto' : ''), textos });
  }

  /**
   * PROTÓTIPO: importa um extrato ou razão inventado da competência (a da tarefa, quando vem na URL;
   * senão, o mês passado), pelo mesmo caminho de um arquivo de verdade. O nome do arquivo diz TESTE.
   */
  async function importarTeste(lado: x.Lado, banco?: string) {
    setMensagemBruta(null);
    setLendo(lado);
    if (banco) setLendoLinha(banco + '|' + lado);
    await gravarLidos(lado, [x.arquivoDeTeste(lado, competenciaDeTeste)], banco);
    setLendoLinha(null);
  }

  /** O check verde da linha: exclui o que foi importado daquele banco e lado na competência (pergunta antes). */
  async function excluirDoBanco(banco: string, lado: x.Lado, competencia = competenciaDeTeste) {
    const arqs = x.arquivosDoBanco(s.empresa, banco, primeiro, lado, competencia);
    if (!arqs.length) return;
    const nomeBanco = bancos.find(b => b.id === banco)?.nome || 'banco';
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir a importação?',
      html: (lado === 'banco' ? 'O extrato' : 'O razão') + ' do <b>' + escapar(nomeBanco) + '</b>: ' +
        arqs.map(a => '<b>' + escapar(a.nome) + '</b> (' + a.lancamentos.length + ')').join(', ') + '. Dá para importar de novo depois.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
    });
    if (!ok) return;
    s.aplicar(e => arqs.reduce((acc, a) => x.excluirArquivo(acc, a.id, new Date()), e));
    setMensagem({ tom: 'ok', titulo: 'Importação excluída', textos: [{ texto: nomeBanco + ' · ' + (lado === 'banco' ? 'extrato' : 'razão') }] });
  }

  /** Em Lote, "Remover todos": exclui o extrato (ou o razão) do banco em todos os meses do período, com uma pergunta só. */
  async function excluirDoPeriodo(banco: string, lado: x.Lado, meses: string[]) {
    const porId = new Map<string, x.ArquivoImportado>();
    for (const m of meses) for (const a of x.arquivosDoBanco(s.empresa, banco, primeiro, lado, m)) porId.set(a.id, a);
    const arqs = [...porId.values()];
    if (!arqs.length) return;
    const nomeBanco = bancos.find(b => b.id === banco)?.nome || 'banco';
    const oQue = lado === 'banco' ? 'extrato' : 'razão';
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Remover todos?',
      html: 'O ' + oQue + ' do <b>' + escapar(nomeBanco) + '</b> nos ' + meses.length + ' meses: ' + arqs.length + (arqs.length === 1 ? ' arquivo' : ' arquivos') +
        ' (' + arqs.reduce((t, a) => t + a.lancamentos.length, 0) + ' lançamentos). Dá para importar de novo depois.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Remover todos', valor: true, variante: 'btn-danger' }],
    });
    if (!ok) return;
    s.aplicar(e => arqs.reduce((acc, a) => x.excluirArquivo(acc, a.id, new Date()), e));
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
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
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

  const arquivos = s.empresa.arquivos.slice().sort((a, b) => b.importadoEm.localeCompare(a.importadoEm)).map(a => ({
    id: a.id, lado: a.lado, nome: a.nome, qtd: a.lancamentos.length,
    periodo: x.rotuloPeriodo(x.periodo(a.lancamentos)), quando: a.importadoEm,
  }));

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
    /** De cada mês do período, o que o banco já tem: extrato, razão, sem movimento. */
    mesesDoBanco: (banco: string, semMovimentoPorMes: Record<string, string[]>) =>
      (params.get('meses') || '').split(',').filter(m => /^\d{4}-\d{2}$/.test(m)).map(mes => {
        const lado = (l: x.Lado) => {
          const arqs = x.arquivosDoBanco(s.empresa, banco, primeiro, l, mes);
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
        (x.arquivosDoBanco(s.empresa, b.id, primeiro, 'banco', competencia).length > 0 && x.arquivosDoBanco(s.empresa, b.id, primeiro, 'sistema', competencia).length > 0));
    },
    primeiro,
    bancos: bancos.map(b => {
      const lado = (l: x.Lado) => {
        const arqs = x.arquivosDoBanco(s.empresa, b.id, primeiro, l, competenciaDeTeste);
        return {
          qtdArquivos: arqs.length, qtdLancamentos: arqs.reduce((t, a) => t + a.lancamentos.length, 0), lendo: lendoLinha === b.id + '|' + l,
          /** os arquivos que vieram do Drive (para o Visualizar pedir o link temporário) */
          doDrive: arqs.flatMap(a => (a.drive ? [a.drive] : [])),
        };
      };
      return { ...b, marca: b.marca || b.id, numeroConta: b.conta, conta: empresas.rotuloDaConta(b), extrato: lado('banco'), razao: lado('sistema') };
    }),
    // o mesmo banco pode entrar de novo (outra conta, com outra agência/conta)
    bancosParaAdicionar: empresas.BANCOS_CONHECIDOS,
    importarArquivos, importarDoDrive, excluirDoBanco, excluirDoPeriodo, adicionarBanco,
    /** a regra do Cadastro da empresa: presta serviços? (null = não informado, ou o cadastro ainda não chegou) */
    prestaServico: cad.cadastro?.prestaServico ?? null,
    /** os pedidos de documentos feitos ao cliente (o histórico do Pedir extratos) */
    pedidos: s.empresa.pedidos || [],
    /** o extrato do banco naquela competência já foi importado? (qualquer competência, não só a da tela) */
    extratoImportado: (banco: string, competencia: string) => x.arquivosDoBanco(s.empresa, banco, primeiro, 'banco', competencia).length > 0,
    registrarPedido: (reg: x.PedidoRegistrado) => { s.aplicar(e => x.registrarPedido(e, reg)); },
    /** o extrato da conta na competência, com o saldo acumulado (a setinha da linha) */
    movimentoDe: (banco: string) => x.movimentoDoExtrato(s.empresa, banco, primeiro, competenciaDeTeste),
    /** "Todos": o movimento de todos os extratos importados da conta, do primeiro ao último mês */
    movimentoTodosDe: (banco: string) => x.movimentoDoExtrato(s.empresa, banco, primeiro, x.TODOS_OS_MESES.de, x.TODOS_OS_MESES.ate),
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
