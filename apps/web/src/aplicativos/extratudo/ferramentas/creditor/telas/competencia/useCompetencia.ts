// ViewModel da etapa Competência (a primeira), no visual da Importação (Vitor, 05/10/2026): a competência no seletor de
// cima (um mês, ou vários: o Em lote) e uma linha de relatório de liquidação por mês, com o ícone de importar (do
// computador ou do Drive). Aberto pela Tarefas, já vem nos meses em que o caixa teve CRÉD.LIQ.COBRANÇA (os meses do
// Creditor). Do Drive, procura na pasta da empresa (CONTÁBIL › RECEBIMENTO DE CLIENTES), baixa pelo robô do Entregas
// e lê; sem achar, mostra os arquivos da pasta para escolher. Sem o login do Drive, pede antes. Com o relatório de
// todos os meses, o Próximo segue para o Relatório de Recebimento (os meses juntos).
import { creditor as cr, tarefas } from '@nads/core';
import { useCarregando, useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSessao } from '../../casca/sessao';
import { useDrive } from '../../dados/repo';
import { lerRelatorio, mensagemDeErro } from '../../leitura';

type Fase = 'parado' | 'procurando' | 'baixando' | 'lendo' | 'problema';
interface Busca { mes: string; fase: Fase; texto: string; candidatos: cr.ArquivoAchado[] }
const PARADO: Busca = { mes: '', fase: 'parado', texto: '', candidatos: [] };

/** Os meses com que a tela abre: os já escolhidos; senão, os que a Tarefa mandou (os do Creditor); senão, o mês passado. */
function mesesIniciais(daSessao: string, params: URLSearchParams): string[] {
  const s = cr.mesesDaCompetencia(daSessao);
  if (s.length) return s;
  const daTarefa = cr.mesesDaCompetencia(params.get('meses') || '');
  if (daTarefa.length) return daTarefa;
  const c = params.get('competencia') || '';
  return cr.mesValido(c) ? [c] : [cr.competenciaPadrao(new Date())];
}

export function useCompetencia() {
  const s = useSessao();
  const { drive, acesso } = useDrive();
  const { modal, aviso } = useRetorno();
  const [params] = useSearchParams();
  const maximo = new Date().toISOString().slice(0, 7);
  // aberto pela Tarefa: os meses vêm prontos (os do período com CRÉD.LIQ.COBRANÇA no caixa) e ficam travados — o
  // período só se escolhe na primeira etapa da Tarefa (Vitor, 05/10/2026: "automático e bloqueado pro usuário não mexer")
  const daTarefa = cr.mesesDaCompetencia(params.get('meses') || '');
  const travada = daTarefa.length > 0;
  const [meses, setMeses] = useState(() => (travada ? daTarefa : mesesIniciais(s.estado.competencia, params)));
  const competencia = cr.competenciaDosMeses(meses);
  // a sessão guardada com outros meses (de antes): passa para os da Tarefa
  const daTarefaJuntos = cr.competenciaDosMeses(daTarefa);
  useEffect(() => {
    if (travada && s.estado.competencia && s.estado.competencia !== daTarefaJuntos) s.definirCompetencia(daTarefaJuntos);
  }, [travada, daTarefaJuntos, s]);
  const [entrando, setEntrando] = useState(false);
  const [erroLogin, setErroLogin] = useState('');
  // a janela de entrar no Drive: para buscar um mês, ou todos os que faltam ('*')
  const [loginPara, setLoginPara] = useState<string | null>(null);
  const [busca, setBusca] = useState<Busca>(PARADO);
  const lote = meses.length > 1;
  // o relatório anexado inteiro na etapa do banco (sem mês) vale para todos os meses
  const inteiro = !!s.estado.relatorio && !Object.keys(s.estado.porMes).length && s.estado.competencia === competencia;
  const doMes = (m: string) => s.estado.porMes[m] || (inteiro ? { origem: s.estado.origemBanco } : null);
  const faltam = meses.filter(m => !doMes(m));

  /** Guarda a competência (é ela que libera a etapa seguinte). */
  const fixar = () => s.definirCompetencia(competencia);

  /** Leu o relatório do mês: guarda e fica aqui (o resumo na linha); o Continuar segue (Vitor, 05/10/2026: a Competência e o Relatório do banco eram a mesma tela). */
  function guardar(mes: string, rel: cr.RelatorioBanco, origem: string) {
    fixar();
    s.relatorioDoMes(mes, rel, origem);
    setBusca(PARADO);
  }

  async function usarDoDrive(mes: string, a: cr.ArquivoAchado, candidatos: cr.ArquivoAchado[]): Promise<boolean> {
    setBusca({ mes, fase: 'baixando', texto: 'Baixando ' + a.nome + '…', candidatos });
    try {
      const buf = await drive.baixar(a.id, a.nome, passo => setBusca(b => ({ ...b, texto: a.nome + ': ' + passo + '…' })));
      guardar(mes, await lerRelatorio(a.nome, buf), 'Drive · ' + a.caminho);
      return true;
    } catch (e) {
      setBusca({ mes, fase: 'problema', texto: mensagemDeErro(e), candidatos });
      return false;
    }
  }

  /** Procura o relatório de um mês na pasta da empresa (já com o login do Drive). Devolve se veio. */
  async function procurar(mes: string): Promise<boolean> {
    fixar();
    setBusca({ mes, fase: 'procurando', texto: 'Procurando no Drive…', candidatos: [] });
    try {
      const pasta = await drive.pastaDoCliente(s.empresa.codigo);
      const b = cr.acharRelatorioNoDrive(pasta?.itens || [], pasta?.raiz || null, mes);
      if (b.situacao === 'achou' && b.arquivo) return await usarDoDrive(mes, b.arquivo, b.candidatos);
      setBusca({ mes, fase: 'problema', texto: cr.mensagemDaBusca(b, cr.rotuloCompetencia(mes)), candidatos: b.candidatos });
    } catch (e) {
      setBusca({ mes, fase: 'problema', texto: mensagemDeErro(e), candidatos: [] });
    }
    return false;
  }

  /** Os que faltam, um atrás do outro; parou num (não achou), mostra a escolha dele. */
  const parar = useRef(false);
  async function procurarTodos() {
    parar.current = false;
    const lista = [...faltam];
    for (const m of lista) {
      if (parar.current) return;
      if (!(await procurar(m))) return;
    }
  }

  function buscarNoDrive(mes: string) {
    if (!acesso.entrou) { setErroLogin(''); setLoginPara(mes); return; }
    if (mes === '*') void procurarTodos(); else void procurar(mes);
  }

  async function entrar() {
    setEntrando(true);
    setErroLogin('');
    try { await drive.entrarComGoogle(); }
    catch (e) { setErroLogin(mensagemDeErro(e)); return; }
    finally { setEntrando(false); }
    const para = loginPara;
    setLoginPara(null);
    if (para === '*') await procurarTodos(); else if (para) await procurar(para);
  }

  /** Do computador: lê o arquivo aqui mesmo. */
  async function importarDoComputador(mes: string, f: File | undefined) {
    if (!f) return;
    setBusca({ mes, fase: 'lendo', texto: 'Lendo ' + f.name + '…', candidatos: [] });
    try { guardar(mes, await lerRelatorio(f.name, await f.arrayBuffer()), f.name); }
    catch (e) { setBusca({ mes, fase: 'problema', texto: mensagemDeErro(e), candidatos: [] }); }
  }

  /** O check da linha (como na Importação): exclui o relatório do mês (pergunta antes); as decisões das contas vão junto. */
  async function excluir(mes: string) {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir a importação?',
      botoes: [{ rotulo: 'Excluir', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!ok) return;
    if (inteiro) s.mudar(e => ({ ...e, relatorio: null, porMes: {}, origemBanco: '', decisoes: {}, passosFiscal: [], baixado: false, bancoConferido: false, alcancada: 0 }));
    else s.relatorioDoMes(mes, null);
    aviso({ tom: 'ok', titulo: 'Importação excluída', texto: 'Relatório de liquidação' + (lote ? ' · ' + cr.rotuloCompetencia(mes) : '') });
  }

  /** Troca os meses (o seletor): os relatórios dos meses que saíram saem junto. */
  function trocar(novos: string[]) {
    if (travada) return;
    const ms = cr.mesesDaCompetencia(novos.join(','));
    if (!ms.length) return;
    parar.current = true;
    setMeses(ms);
    setBusca(PARADO);
    if (s.estado.competencia) s.definirCompetencia(cr.competenciaDosMeses(ms));
  }

  // os meses do seletor: os recentes (sem mês que ainda não começou) e os já escolhidos, o mais novo em cima
  const recentes = tarefas.competenciasRecentes(new Date(), 24).filter(c => c <= maximo);
  const opcoes = [...new Set([...meses, ...recentes])].sort().reverse();
  const ocupado = busca.fase === 'procurando' || busca.fase === 'baixando' || busca.fase === 'lendo';
  useCarregando(ocupado);
  // os avisos do que foi lido: os da leitura e os títulos liquidados fora da competência
  const lido = s.estado.relatorio && s.estado.competencia === competencia ? s.estado.relatorio : null;
  const fora = lido ? cr.titulosForaDaCompetencia(lido.grupos.flatMap(g => g.titulos), competencia) : [];
  const avisos = lido ? [
    ...lido.avisos,
    ...(fora.length ? [fora.length + ' título(s) liquidado(s) fora de ' + cr.rotuloCompetencia(competencia) + ' (ex.: NF ' + fora[0].nf + ' em ' + fora[0].liquidacao + '). Confira se é o relatório certo.'] : []),
  ] : [];
  return {
    meses, lote,
    /** os meses vieram da Tarefa: o seletor não abre */
    travada,
    rotulo: lote ? cr.rotuloCompetencia(competencia) : tarefas.rotuloCurtoCompetencia(meses[0]),
    competencias: opcoes.map(c => ({ valor: c, rotulo: tarefas.rotuloCompetencia(c), curto: cr.rotuloCompetencia(c) })),
    escolherMes: (c: string) => trocar([c]),
    /** o Em lote: de um mês até outro (em qualquer ordem) */
    escolherPeriodo: (de: string, ate: string) => {
      const [a, b] = de < ate ? [de, ate] : [ate, de];
      trocar(opcoes.filter(c => c >= a && c <= b));
    },
    /** as linhas: uma por mês */
    linhas: meses.map(m => {
      const r = doMes(m);
      // o relatório do mês (o anexado inteiro vale para todos: o resumo fica só nele)
      const rel = s.estado.porMes[m]?.relatorio || (inteiro && m === meses[0] ? s.estado.relatorio : null);
      const ts = rel ? rel.grupos.flatMap(g => g.titulos) : [];
      return {
        resumo: rel ? [ts.length + (ts.length === 1 ? ' título' : ' títulos'), 'Liquidado ' + cr.reais(cr.somar(ts.map(t => t.valor)))] : [],
        titulos: ts.map(t => ({ id: t.id, liquidacao: t.liquidacao, sacado: t.sacado, nf: t.nf, valor: t.valor, juros: t.mora + t.outros, desconto: t.desconto, cobrado: t.cobrado })),
        mes: m, rotulo: cr.rotuloCompetencia(m), carregado: !!r, origem: r?.origem || '', doDrive: !!r?.origem.startsWith('Drive'),
        ocupado: ocupado && busca.mes === m, texto: ocupado && busca.mes === m ? busca.texto : '',
      };
    }),
    faltam: faltam.length,
    todos: faltam.length === 0,
    /** acoplado no Entregas: o Drive é o de lá (sem login aqui) */
    driveDeFora: !!drive.loginDeFora && !acesso.entrou,
    exemplos: drive.exemplos,
    ocupado,
    busca,
    /** um mês, ou '*' para todos os que faltam */
    buscarNoDrive,
    importarDoComputador: (mes: string, f: File | undefined) => { void importarDoComputador(mes, f); },
    usar: (a: cr.ArquivoAchado) => { void usarDoDrive(busca.mes, a, busca.candidatos); },
    fecharProblema: () => setBusca(PARADO),
    excluir: (mes: string) => { void excluir(mes); },
    /** os avisos do que foi lido (os da leitura e os títulos fora da competência) */
    avisos,
    /** o exemplo (só sem o banco: dados de exemplo) */
    exemplo: (mes: string) => guardar(mes, cr.lerRelatorioTexto(cr.EXEMPLO_RELATORIO), 'exemplo'),
    login: { aberto: loginPara !== null, entrando, erro: erroLogin, entrar: () => { void entrar(); }, fechar: () => setLoginPara(null) },
  };
}
