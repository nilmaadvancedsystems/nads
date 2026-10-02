// ViewModel da Minha página (a janela da pessoa na Tarefas — Vitor, 02/10/2026: "a página pessoal, com configs, inbox
// dentre outros, no estilo do Entregas"; "no estilo do Notion, com uma tela flutuante"). Tópicos (a lateral da janela):
//   Caixa de entrada   o que é da pessoa e pede atenção: os pedidos de liberação de computador (admin), as etapas que
//                      ela parou (para retomar), os e-mails sem cliente da caixa do setor, as cobranças que ela pediu
//                      (se o robô mandou) e os arquivos que ela mandou ao Claudio Secretário; cada um se arquiva
//   Anotações          as mesmas do Entregas (usuarios/{uid}/notas): escrever, lembrete, marcar feita, editar, apagar
//   Minha conta        a foto de perfil (a mesma do Entregas, aparece no avatar), nome, e-mail, setor, sair
//   Aparência e telas  o tema e onde a Tarefas abre (neste navegador)
//   Versão do sistema  a versão e atualizar quando sai uma nova
// Lê o que as outras telas já leem; grava só a foto (usuarios/{uid}.fotoPerfil, o dono pode) e, neste navegador, o
// tema e o início.
import { entregas as e, tarefas as t, usuarios } from '@nads/core';
import { atualizarVersao, useRetorno, useVersaoNova, type NomeIcone } from '@nads/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../../versao';
import { CHAVE_INICIO, caminhoDoExecutor, INICIOS, inicioEscolhido } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { useAcesso, useDriveDoEntregas, useExecucoesDoPeriodo, useGmailDoEntregas, useRepoPessoal } from '../../dados/repo';
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
  /** fecha: a ação leva a outra tela (a janela fecha junto) */
  acoes: { rotulo: string; principal?: boolean; fecha?: boolean; onClick: () => void }[];
  /** dá para arquivar (o pedido de liberação, não: ele espera a decisão) */
  arquivavel: boolean;
}

/**
 * A foto reduzida a 256 px (JPEG), recortada no meio (quadrada: fica redonda no avatar). O documento do Firestore tem
 * teto de 1 MB (o mesmo das Configurações do Entregas). Sem mexer na página: createImageBitmap + OffscreenCanvas.
 */
async function reduzir(arquivo: File, lado = 256, qualidade = 0.85): Promise<string> {
  let img: ImageBitmap;
  try { img = await createImageBitmap(arquivo); } catch { throw new Error('Esse arquivo não é uma imagem.'); }
  const menor = Math.min(img.width, img.height);
  const tam = Math.min(lado, menor);
  const tela = new OffscreenCanvas(tam, tam);
  tela.getContext('2d')?.drawImage(img, (img.width - menor) / 2, (img.height - menor) / 2, menor, menor, 0, 0, tam, tam);
  img.close();
  const blob = await tela.convertToBlob({ type: 'image/jpeg', quality: qualidade });
  return await new Promise<string>((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => falha(new Error('Não consegui ler a imagem.'));
    leitor.readAsDataURL(blob);
  });
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
  const [filtro, setFiltro] = useState<'tudo' | 'acao' | 'arquivados'>('tudo');
  const pessoal = useRepoPessoal();
  const gmail = useGmailDoEntregas();

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
      acoes: [{ rotulo: 'Retomar', principal: true, fecha: true, onClick: () => navegar(caminhoDoExecutor(rota, m.competencia)) }],
      arquivavel: true,
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
    arquivavel: false,
  })) : [];

  // os arquivos que a pessoa mandou ao Claudio Secretário (últimos 30 dias) e onde cada um foi parar
  const meus = drive.meusEnvios();
  const envios: ItemDaCaixa[] = meus.lista.map(x => {
    const s = e.situacaoDoEnvioFeito(x);
    return {
      id: 'envio-' + x.id, icone: 'arquivo' as NomeIcone, tom: s.tom as Tom,
      titulo: x.nome, texto: s.texto, em: x.criadoEm || '', quando: quandoFoi(x.criadoEm || ''), acoes: [], arquivavel: true,
    };
  });

  // as cobranças que a pessoa pediu (Pedir documentos, as respostas pelo robô) nos últimos 30 dias: se o robô mandou
  const cobrancas = pessoal.minhasCobrancas();
  const pedidos: ItemDaCaixa[] = cobrancas.lista.map(c => ({
    id: 'cobranca-' + c.id, icone: 'envelope' as NomeIcone,
    tom: (c.status === 'enviado' ? 'ok' : c.status === 'erro' ? 'aviso' : 'espera') as Tom,
    titulo: (c.tipo === 'responder' ? 'Resposta' : c.tipo === 'lote' ? 'Cobrança em lote' : 'Pedido de documentos') + ' · ' + (c.clienteNome || c.para || c.assunto),
    texto: c.status === 'enviado' ? 'Enviado' + (c.enviadoEm ? ' em ' + quandoFoi(c.enviadoEm) : '') + (c.para ? ' para ' + c.para : '')
      : c.status === 'erro' ? 'Não foi: ' + (c.erro || 'erro no envio')
        : c.status === 'processando' ? 'O robô está enviando' : 'Na fila do robô',
    em: c.criadoEm, quando: quandoFoi(c.criadoEm), acoes: [], arquivavel: true,
  }));

  // os e-mails sem cliente na caixa do setor (o robô não soube de quem são): um item só, com o número
  const caixasDaPessoa = e.caixasDaPessoa({ admin: op.admin, departamento: op.departamento });
  const caixaAtual = gmail.caixa();
  const estadoGmail = gmail.estado();
  const semDono = caixasDaPessoa.includes(caixaAtual) ? e.semCliente(estadoGmail, gmail.clientes().lista, gmail.ignorados()) : [];
  const maisNovo = semDono.reduce((m, x) => (x.em > m ? x.em : m), '');
  const semCliente: ItemDaCaixa[] = semDono.length ? [{
    id: 'semcliente-' + caixaAtual + '-' + maisNovo, icone: 'envelope' as NomeIcone, tom: 'acao' as Tom,
    titulo: semDono.length + (semDono.length === 1 ? ' e-mail sem cliente' : ' e-mails sem cliente'),
    texto: 'Na caixa ' + (e.NOMES_DAS_CAIXAS[caixaAtual] || caixaAtual) + ': o robô não soube de quem são. Ligue cada um ao cliente.',
    em: maisNovo, quando: quandoFoi(maisNovo),
    acoes: [{ rotulo: 'Abrir', principal: true, fecha: true, onClick: () => navegar('/tarefas/contato/caixa') }], arquivavel: true,
  }] : [];

  const arquivados = new Set(pessoal.arquivados());
  const todos = [...liberacoes, ...paradas, ...semCliente, ...pedidos, ...envios].sort((a, b) => b.em.localeCompare(a.em));
  const itens = todos.filter(i => !arquivados.has(i.id));
  const guardados = todos.filter(i => arquivados.has(i.id));
  const pedemAcao = itens.filter(i => i.tom === 'acao').length;
  const arquivar = (id: string) => { void pessoal.arquivar(id).catch(() => toast('Não consegui arquivar.')); };
  const desarquivar = (id: string) => { void pessoal.desarquivar(id).catch(() => toast('Não consegui desarquivar.')); };

  // as anotações (as mesmas do Entregas)
  const notas = pessoal.notas();
  const avisarErro = (o: string) => () => toast('Não consegui ' + o + ' a anotação.');

  const u = sessao?.usuario || null;
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const foto = acesso.minhaFoto() || u?.fotoPerfil || null;
  async function gravarFoto(nova: string | null) {
    setSalvandoFoto(true);
    try {
      await acesso.salvarMinhaFoto(nova);
      toast(nova ? 'Foto de perfil atualizada.' : 'Foto de perfil removida.');
    } catch (err) {
      toast('Não consegui salvar a foto (' + (err instanceof Error ? err.message : String(err)) + ').');
    } finally { setSalvandoFoto(false); }
  }

  return {
    // Caixa de entrada
    caixa: {
      carregando: !doPeriodo.carregada || !meus.carregados || !cobrancas.carregadas,
      filtro, setFiltro,
      itens: filtro === 'acao' ? itens.filter(i => i.tom === 'acao') : filtro === 'arquivados' ? guardados : itens,
      total: itens.length,
      pedemAcao,
      arquivados: guardados.length,
      arquivar, desarquivar,
    },
    // Anotações
    notas: {
      carregando: !notas.carregadas,
      lista: notas.lista.map(n => ({ ...n, lembrete: n.lembreteEm ? quandoFoi(n.lembreteEm) : '', atrasada: !!n.lembreteEm && !n.feito && n.lembreteEm < new Date().toISOString() })),
      abertas: notas.lista.filter(n => !n.feito).length,
      nova: (texto: string, lembreteEm: string | null) => { void pessoal.novaNota(texto.trim(), lembreteEm).catch(avisarErro('salvar')); },
      editar: (id: string, texto: string) => { void pessoal.editarNota(id, texto.trim()).catch(avisarErro('salvar')); },
      marcar: (id: string, feito: boolean) => { void pessoal.marcarNota(id, feito).catch(avisarErro('marcar')); },
      apagar: (id: string) => { void pessoal.apagarNota(id).catch(avisarErro('apagar')); },
    },
    // Minha conta
    conta: {
      nome: op.nome,
      iniciais: usuarios.iniciais(op.nome),
      foto,
      salvandoFoto,
      /** escolheu um arquivo de imagem: reduz e grava (aparece no avatar do cabeçalho na hora) */
      trocarFoto: (arquivo: File) => { void reduzir(arquivo).then(gravarFoto, (err: Error) => toast(err.message)); },
      tirarFoto: () => { void gravarFoto(null); },
      email: u?.email || (comLogin ? '' : 'sem login (dados de exemplo)'),
      // só o setor (Vitor, 02/10/2026: "coloque só o setor"), sem o nível
      setor: usuarios.rotuloDoCargo({ departamento: op.departamento, nivel: null, papeis: u?.papeis || [] }),
      admin: op.admin,
      sair: comLogin ? 'Sair da conta' : 'Trocar de pessoa',
      fazerSair: () => escolher(null),
      // o nome e a senha mudam nas Configurações do Entregas (a mesma conta)
      linkDoEntregas: 'https://entregas-2e5e2.web.app/entregas.html?config=conta',
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
