// ViewModel da Minha página (a página pessoal da Tarefas — Vitor, 02/10/2026: "a página pessoal, com configs, inbox
// dentre outros, no estilo do Entregas"). Tópicos (a lateral, como as Configurações do Entregas):
//   Caixa de entrada   o que é da pessoa e pede atenção: os pedidos de liberação de computador (admin), as etapas que
//                      ela parou (para retomar) e os arquivos que ela mandou ao Claudio Secretário (onde foram parar)
//   Minha conta        quem é (nome, e-mail, setor, cargo, papéis) e sair
//   Este computador    se este login está liberado (a proteção do login) e o pedido em andamento
//   Aparência e telas  o tema e onde a Tarefas abre (neste navegador)
//   Versão do sistema  a versão e atualizar quando sai uma nova
// Só lê o que as outras telas já leem (nada novo no banco); o que muda é deste navegador (o tema, o início).
import { entregas as e, tarefas as t, usuarios } from '@nads/core';
import { atualizarVersao, useRetorno, useVersaoNova, type NomeIcone } from '@nads/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../../versao';
import { BASE, CHAVE_INICIO, caminhoDoExecutor, INICIOS, inicioEscolhido } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { useAcesso, useDriveDoEntregas, useExecucoesDoPeriodo } from '../../dados/repo';
import { useSessao } from '../../dados/sessao';

export type Tom = 'acao' | 'ok' | 'espera' | 'aviso';

export interface ItemDaCaixa {
  id: string;
  icone: NomeIcone;
  tom: Tom;
  titulo: string;
  texto: string;
  /** quando aconteceu (ISO), para ordenar; e o que mostra */
  em: string;
  quando: string;
  acoes: { rotulo: string; principal?: boolean; onClick: () => void }[];
}

const quandoFoi = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export function usePaginaPessoal() {
  const { operador, escolher, comLogin } = useOperador();
  const op = operador as Operador;
  const sessao = useSessao();
  const acesso = useAcesso();
  const drive = useDriveDoEntregas();
  const navegar = useNavigate();
  const { toast, modal } = useRetorno();
  const versaoNova = useVersaoNova(VERSAO_SISTEMA);
  const [inicio, setInicio] = useState(inicioEscolhido);
  const [filtro, setFiltro] = useState<'tudo' | 'acao'>('tudo');

  // as etapas que a pessoa parou nas duas últimas competências (do Contábil: a rotina que existe hoje)
  const competencias = t.competenciasRecentes(new Date(), 2);
  const doPeriodo = useExecucoesDoPeriodo(competencias, 'contabil');
  const rotina = t.ROTINA_CONTABIL;
  const paradas: ItemDaCaixa[] = op.departamento === 'contabil' || op.admin ? doPeriodo.porMes.flatMap(m => m.execucoes.flatMap(ex => rotina.etapas.flatMap(etapa => {
    const est = t.estadoDa(ex, etapa.id);
    if (!est || est.situacao !== 'interrompida' || est.por !== op.nome) return [];
    const motivo = etapa.objecoes.find(o => o.id === est.objecao)?.texto || (est.objecao === 'outro' ? 'Outro motivo' : est.objecao || '');
    const rota = ex.codigo != null ? String(ex.codigo) : ex.empresa;
    return [{
      id: 'parada-' + m.competencia + ex.empresa + etapa.id, icone: 'alert' as NomeIcone, tom: 'acao' as Tom,
      titulo: etapa.nome + ' parada · ' + (ex.codigo != null ? ex.codigo + ' · ' : '') + ex.empresa,
      texto: (motivo || 'Parada') + (est.observacao ? ' — ' + est.observacao : '') + ' (' + t.rotuloCompetencia(m.competencia) + ')',
      em: est.em, quando: quandoFoi(est.em),
      acoes: [{ rotulo: 'Retomar', principal: true, onClick: () => navegar(caminhoDoExecutor(rota, m.competencia)) }],
    }];
  }))) : [];

  // os pedidos de liberação de computador (só o admin vê e aprova)
  const liberacoes: ItemDaCaixa[] = op.admin ? acesso.pendentes().map(p => ({
    id: 'liberar-' + p.id, icone: 'lock' as NomeIcone, tom: 'acao' as Tom,
    titulo: (p.nome || p.email) + ' quer entrar no nads',
    texto: p.computador ? 'Computador: ' + p.computador : 'Pedido de liberação de computador',
    em: p.criadoEm, quando: quandoFoi(p.criadoEm),
    acoes: [
      { rotulo: 'Recusar', onClick: () => { void acesso.recusar(p).then(() => toast('Pedido recusado.')); } },
      { rotulo: 'Aprovar', principal: true, onClick: () => {
        void acesso.aprovar(p).then(codigo => modal({ titulo: 'Liberado', texto: 'Passe este código para ' + (p.nome || p.email) + ': ' + codigo.slice(0, 3) + ' ' + codigo.slice(3),
          botoes: [{ rotulo: 'Pronto', valor: true, variante: 'btn-primary' }] }));
      } },
    ],
  })) : [];

  // os arquivos que a pessoa mandou ao Claudio Secretário (últimos 30 dias) e onde cada um foi parar
  const meus = drive.meusEnvios();
  const envios: ItemDaCaixa[] = meus.lista.map(x => {
    const s = e.situacaoDoEnvioFeito(x);
    return {
      id: 'envio-' + x.id, icone: 'arquivo' as NomeIcone, tom: s.tom as Tom,
      titulo: x.nome, texto: s.texto, em: x.criadoEm || '', quando: quandoFoi(x.criadoEm || ''), acoes: [],
    };
  });

  const itens = [...liberacoes, ...paradas, ...envios].sort((a, b) => b.em.localeCompare(a.em));
  const pedemAcao = liberacoes.length + paradas.length;

  const u = sessao?.usuario || null;
  const minha = acesso.minhaSessao();
  const config = acesso.config();
  const pedido = acesso.meuPedido();

  return {
    // Caixa de entrada
    caixa: {
      carregando: !doPeriodo.carregada || !meus.carregados,
      filtro, setFiltro,
      itens: filtro === 'acao' ? itens.filter(i => i.tom === 'acao') : itens,
      total: itens.length,
      pedemAcao,
    },
    // Minha conta
    conta: {
      nome: op.nome,
      iniciais: usuarios.iniciais(op.nome),
      foto: u?.fotoPerfil || null,
      email: u?.email || (comLogin ? '' : 'sem login (dados de exemplo)'),
      cargo: usuarios.rotuloDoCargo({ departamento: op.departamento, nivel: op.nivel, papeis: u?.papeis || [] }),
      papeis: (u?.papeis || []).filter(p => p !== 'staff'),
      admin: op.admin,
      sair: comLogin ? 'Sair da conta' : 'Trocar de pessoa',
      fazerSair: () => escolher(null),
      // a foto, o nome e a senha mudam nas Configurações do Entregas (a mesma conta)
      linkDoEntregas: 'https://entregas-2e5e2.web.app/entregas.html?config=conta',
    },
    // Este computador
    computador: {
      carregando: !config.carregada,
      protecao: config.protecao,
      admin: op.admin,
      liberado: op.admin || !config.protecao || minha.liberada,
      pedido: pedido ? { situacao: pedido.status, computador: pedido.computador, quando: quandoFoi(pedido.criadoEm) } : null,
      irParaUsuarios: () => navegar(BASE + '/cadastro/usuarios'),
    },
    // Aparência e telas
    preferencias: {
      inicio,
      inicios: INICIOS.map(i => ({ valor: i.valor, rotulo: i.rotulo })),
      mudarInicio: (v: string) => {
        try { localStorage.setItem(CHAVE_INICIO, v); } catch { /* vale só agora */ }
        setInicio(v);
        toast('A Tarefas vai abrir em ' + (INICIOS.find(i => i.valor === v)?.rotulo || v) + ' neste navegador.');
      },
    },
    // Versão do sistema
    aplicativo: { versao: VERSAO_SISTEMA, versaoNova, atualizar: atualizarVersao },
  };
}

export type VmPessoal = ReturnType<typeof usePaginaPessoal>;
