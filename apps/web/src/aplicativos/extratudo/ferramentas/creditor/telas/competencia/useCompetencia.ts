// ViewModel da etapa Competência (a primeira), no visual da Importação (Vitor, 05/10/2026): a competência no seletor de
// cima e a linha do relatório de liquidação, com o ícone de importar (do computador ou do Drive). Do Drive, procura na
// pasta da empresa (CONTÁBIL › RECEBIMENTO DE CLIENTES), baixa pelo robô do Entregas, lê e segue para o Relatório do
// banco já preenchido; sem achar, mostra os arquivos da pasta para escolher. Sem o login do Drive, pede antes.
import { creditor as cr, tarefas } from '@nads/core';
import { useCarregando, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSessao } from '../../casca/sessao';
import { useDrive } from '../../dados/repo';
import { lerRelatorio, mensagemDeErro } from '../../leitura';

type Fase = 'parado' | 'procurando' | 'baixando' | 'lendo' | 'problema';

export function useCompetencia() {
  const s = useSessao();
  const { drive, acesso } = useDrive();
  const { modal, aviso } = useRetorno();
  // aberto pela Tarefas: a competência (e os meses do Em lote) vêm no endereço
  const [params] = useSearchParams();
  const daTarefa = params.get('competencia') || '';
  const mesesDaTarefa = (params.get('meses') || '').split(',').filter(cr.competenciaValida);
  const maximo = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(s.estado.competencia || (cr.competenciaValida(daTarefa) ? daTarefa : cr.competenciaPadrao(new Date())));
  const [entrando, setEntrando] = useState(false);
  const [erroLogin, setErroLogin] = useState('');
  const [loginAberto, setLoginAberto] = useState(false);
  const [busca, setBusca] = useState<{ fase: Fase; texto: string; candidatos: cr.ArquivoAchado[] }>({ fase: 'parado', texto: '', candidatos: [] });
  const valida = cr.competenciaValida(mes);
  const jaCarregado = !!s.estado.relatorio && s.estado.competencia === mes;

  /** Guarda a competência (antes de qualquer outra coisa: é ela que libera a etapa seguinte). */
  const fixar = () => s.mudar(e => (e.competencia === mes ? e : { ...e, competencia: mes }));

  async function usarDoDrive(a: cr.ArquivoAchado, candidatos: cr.ArquivoAchado[]) {
    fixar();
    setBusca({ fase: 'baixando', texto: 'Baixando ' + a.nome + '…', candidatos });
    try {
      const buf = await drive.baixar(a.id, a.nome, passo => setBusca(b => ({ ...b, texto: a.nome + ': ' + passo + '…' })));
      s.usarRelatorio(await lerRelatorio(a.nome, buf), 'Drive · ' + a.caminho);
      s.avancarPara('banco');
    } catch (e) {
      setBusca({ fase: 'problema', texto: mensagemDeErro(e), candidatos });
    }
  }

  /** Procura o relatório da competência na pasta da empresa (já com o login do Drive). */
  async function procurar() {
    fixar();
    setBusca({ fase: 'procurando', texto: 'Procurando no Drive…', candidatos: [] });
    try {
      const pasta = await drive.pastaDoCliente(s.empresa.codigo);
      const b = cr.acharRelatorioNoDrive(pasta?.itens || [], pasta?.raiz || null, mes);
      if (b.situacao === 'achou' && b.arquivo) await usarDoDrive(b.arquivo, b.candidatos);
      else setBusca({ fase: 'problema', texto: cr.mensagemDaBusca(b, cr.rotuloCompetencia(mes)), candidatos: b.candidatos });
    } catch (e) {
      setBusca({ fase: 'problema', texto: mensagemDeErro(e), candidatos: [] });
    }
  }

  function buscarNoDrive() {
    if (!valida) return;
    // sem o login do Drive: a janela de entrar; entrou, segue buscando
    if (!acesso.entrou) { setErroLogin(''); setLoginAberto(true); return; }
    void procurar();
  }

  async function entrar() {
    setEntrando(true);
    setErroLogin('');
    try { await drive.entrarComGoogle(); }
    catch (e) { setErroLogin(mensagemDeErro(e)); return; }
    finally { setEntrando(false); }
    setLoginAberto(false);
    await procurar();
  }

  /** Do computador: lê o arquivo aqui mesmo e segue para o Relatório do banco. */
  async function importarDoComputador(f: File | undefined) {
    if (!f || !valida) return;
    fixar();
    setBusca({ fase: 'lendo', texto: 'Lendo ' + f.name + '…', candidatos: [] });
    try {
      s.usarRelatorio(await lerRelatorio(f.name, await f.arrayBuffer()), f.name);
      setBusca({ fase: 'parado', texto: '', candidatos: [] });
      s.avancarPara('banco');
    } catch (e) {
      setBusca({ fase: 'problema', texto: mensagemDeErro(e), candidatos: [] });
    }
  }

  /** O check da linha (como na Importação): exclui o relatório lido (pergunta antes); as decisões das contas vão junto. */
  async function excluir() {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir a importação?',
      botoes: [{ rotulo: 'Excluir', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!ok) return;
    s.mudar(e => ({ ...e, relatorio: null, origemBanco: '', decisoes: {}, passosFiscal: [], alcancada: 0 }));
    aviso({ tom: 'ok', titulo: 'Importação excluída', texto: 'Relatório de liquidação' });
  }

  // os meses do seletor: os do Em lote, quando a Tarefa mandou; senão, os recentes (sem mês que ainda não começou)
  const competencias = (mesesDaTarefa.length > 1 ? mesesDaTarefa : tarefas.competenciasRecentes(new Date(), 24).filter(c => c <= maximo))
    .map(c => ({ valor: c, rotulo: tarefas.rotuloCompetencia(c) }));
  const ocupado = busca.fase === 'procurando' || busca.fase === 'baixando' || busca.fase === 'lendo';
  useCarregando(ocupado);
  return {
    mes, valida,
    rotulo: valida ? tarefas.rotuloCurtoCompetencia(mes) : 'Competência',
    competencias,
    setMes: (v: string) => { setMes(v); setBusca({ fase: 'parado', texto: '', candidatos: [] }); },
    /** a pasta onde o relatório é procurado (embaixo do nome, como a agência e a conta na Importação) */
    pasta: (s.empresa.codigo != null ? s.empresa.codigo + ' - …' : '<código> - …') + ' › CONTÁBIL › RECEBIMENTO DE CLIENTES',
    /** acoplado no Entregas: o Drive é o de lá (sem login aqui) */
    driveDeFora: !!drive.loginDeFora && !acesso.entrou,
    exemplos: drive.exemplos,
    busca: { ...busca, ocupado },
    buscarNoDrive,
    importarDoComputador: (f: File | undefined) => { void importarDoComputador(f); },
    usar: (a: cr.ArquivoAchado) => { void usarDoDrive(a, busca.candidatos); },
    fecharProblema: () => setBusca({ fase: 'parado', texto: '', candidatos: [] }),
    jaCarregado,
    origemCarregada: jaCarregado ? s.estado.origemBanco : '',
    doDrive: jaCarregado && s.estado.origemBanco.startsWith('Drive'),
    excluir: () => { void excluir(); },
    /** o relatório já lido: segue para a etapa seguinte */
    continuar: () => { fixar(); s.avancarPara('banco'); },
    login: { aberto: loginAberto, entrando, erro: erroLogin, entrar: () => { void entrar(); }, fechar: () => setLoginAberto(false) },
  };
}
