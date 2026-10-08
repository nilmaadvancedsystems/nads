// ViewModel da casca da empresa aberta: seções e páginas com as travas, título da página,
// sair (Apagar ao sair), voltar pro início e a pergunta "presta serviços?".
// Origem: conferencia.html renderNav (~L1789), aplicarBloqueios (~L1838), entrar/sair
// (~L2004-2039), perguntarPrestaServico (~L1781), telaInicialEmpresa (~L1712).
import { conferencia as c } from '@nads/core';
import { destacarNaTela, useRetorno } from '@nads/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { useRepo } from '../dados/repo';
import { PAGINAS_ESCONDIDAS, paginaPorId, SECOES, secaoDaPagina, type IdSecao } from './navegacao';
import { MSG_CADASTRO_BLOQ, servicosDoEndereco, useSessao, useSincronizarPrestaServico } from './sessao';
import { caminho } from './caminho';
import { usePonteDaTarefa, useRequisitosParaATarefa } from '../../../comum/ponte';

/** No "?" da Tarefas cabem poucas linhas: as primeiras e "e mais N". */
const LIMITE_DO_QUE_FALTA = 8;


export function useCascaConciliaAi() {
  const s = useSessao();
  const repo = useRepo();
  const navegar = useNavigate();
  const { modal } = useRetorno();
  const e = s.empresa;
  const pag = paginaPorId(s.pagina);
  const secAtual = secaoDaPagina(s.pagina);
  const ok = c.importacoesOk(e);
  const semNotas = !c.temNotas(e);
  const tem = c.disponivel(e);
  const semP = c.semPrest(e);
  const lista = repo.listarEmpresas().find(x => x.nome === s.nome);

  // aberta pela Tarefas: a regra vem do Cadastro da empresa (?servicos=), e não se pergunta
  const { search } = useLocation();
  const [servicosDoCadastro] = useState(() => servicosDoEndereco(search));
  useSincronizarPrestaServico(servicosDoCadastro);

  // dentro da etapa Conferência fiscal da Tarefas: o que falta para tudo ficar Ok (o avançar só aparece sem nada).
  // Conta o período da tarefa (o ?meses= do endereço), não o filtro de meses que a pessoa mexe na tela.
  const [mesesDaTarefa] = useState(() => (new URLSearchParams(search).get('meses') || '').split(',').filter(Boolean));
  const faltamFiscal = useMemo(() => {
    const filtro = mesesDaTarefa.length ? c.filtroDoPeriodo(mesesDaTarefa) : s.filtro;
    const todas = c.pendenciasFiscaisComLugar(e, filtro);
    return todas.length > LIMITE_DO_QUE_FALTA ? [...todas.slice(0, LIMITE_DO_QUE_FALTA), { texto: 'e mais ' + (todas.length - LIMITE_DO_QUE_FALTA), alvo: null }] : todas;
  }, [e, s.filtro, mesesDaTarefa]);
  useRequisitosParaATarefa(repo.pronto() ? { pronto: faltamFiscal.length === 0, faltam: faltamFiscal.map(p => p.texto), alvos: faltamFiscal.map(p => p.alvo) } : null);
  // o "Resolver" da Tarefas: abre o Relatório na aba da pendência e destaca as linhas com diferença (ou o quadro)
  usePonteDaTarefa(undefined, alvo => {
    if (!alvo.startsWith('relatorio:')) return;
    const aba = alvo.slice(10) as c.AbaRelatorio;
    s.irPara('movimento/relatorio');
    s.setAbaRelatorio(aba);
    void destacarNaTela(aba === 'entradas' ? '#confDivEntradas' : aba === 'saidas' ? '#confDivSaidas' : 'tr:has(.badge-bad)');
  });

  // "Essa empresa presta serviço?" — uma vez por empresa, obrigatória, fundo embaçado
  const perguntou = useRef(false);
  useEffect(() => {
    if (perguntou.current || e.prestaServico !== undefined || servicosDoCadastro !== undefined) return;
    perguntou.current = true;
    void modal<boolean>({
      obrigatoria: true, icone: 'briefcase', titulo: 'Seja bem-vindo(a) ao Concilia aí!',
      html: 'Para melhorarmos a sua experiência: a empresa <b>' + escapar((lista?.codigo != null ? lista.codigo + ' — ' : '') + s.nome) + '</b> presta serviços?',
      botoes: [{ rotulo: 'Não', valor: false, variante: 'btn-outline' }, { rotulo: 'Sim', valor: true, variante: 'btn-primary' }],
    }).then(sim => {
      s.aplicar(x => c.definirPrestaServico(x, sim));
      if (!sim && s.abaCadastro === 'prestados') s.setAbaCadastro('entradas');
    });
  }, [e.prestaServico, modal, s, lista, servicosDoCadastro]);

  const secoes = SECOES.map(sec => {
    const req = sec.id === 'cadastro' && !ok ? 'todas' : sec.id === 'movimento' && semNotas ? 'notas' : '';
    // a Importação foi para a primeira etapa da Tarefas: dentro da etapa (Conferência fiscal), ela não aparece aqui
    return { id: sec.id, rotulo: sec.rotulo, icone: sec.icone, grupo: sec.grupo, ativa: sec.id === secAtual?.id, travada: !!req, req, foraDaEtapa: sec.id === 'importacao' };
  });

  const abaAcesa = pag?.acendeAba || s.pagina;
  const paginas = (secAtual?.paginas || []).map(p => ({
    id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === abaAcesa,
    // "Prestados" some com "não presta serviço"
    oculta: p.id === 'importacao/prestados' && semP,
  }));

  /** Menu lateral: sempre abre a primeira página da seção, já na primeira aba interna. */
  function onSecao(id: string) {
    const sec = secoes.find(x => x.id === id);
    if (sec?.req) { s.avisoImportar(sec.req as 'todas' | 'notas'); return; }
    if (id === 'cadastro' && !ok) { s.avisoImportar('todas'); return; }
    const primeira = SECOES.find(x => x.id === (id as IdSecao))?.paginas[0].id;
    if (!primeira) return;
    if (primeira === 'cadastro/configuracoes') s.setAbaCadastro(tem.entradas ? 'entradas' : tem.saidas ? 'saidas' : tem.tomados ? 'tomados' : 'entradas');
    if (primeira === 'movimento/relatorio') s.setAbaRelatorio('geral');
    s.irPara(primeira);
  }

  /** Abas de cima: voltam onde a pessoa parou (a aba interna fica como estava). */
  function onPagina(id: string) {
    s.irPara(id);
  }

  /**
   * Dentro da etapa da Tarefas (a Conferência fiscal), sem barra lateral: todas as páginas numa linha de abas, como as
   * de um repositório do GitHub — Relatório · Naturezas · Consulta · Cadastro · Auditoria (a Importação está na
   * primeira etapa). "Checklist" vira "Naturezas" (o título da página) para não confundir com o checklist das etapas.
   */
  const semConta = c.naturezasSemConta(e).length;
  const NA_ETAPA: { id: string; rotulo: string; secao: IdSecao }[] = [
    { id: 'movimento/relatorio', rotulo: 'Relatório', secao: 'movimento' },
    { id: 'movimento/checklist', rotulo: 'Naturezas', secao: 'movimento' },
    { id: 'movimento/consulta', rotulo: 'Consulta', secao: 'movimento' },
    { id: 'cadastro/configuracoes', rotulo: 'Cadastro', secao: 'cadastro' },
    { id: 'auditoria/historico', rotulo: 'Auditoria', secao: 'auditoria' },
  ];
  const abasNaEtapa = NA_ETAPA.map(a => ({
    id: a.id, rotulo: a.rotulo, icone: paginaPorId(a.id)?.icone || 'list' as const, ativa: a.id === abaAcesa,
    travada: !!secoes.find(x => x.id === a.secao)?.travada,
    // o pontinho vermelho no Cadastro: natureza sem conta (Vitor, 08/10/2026)
    ...(a.id === 'cadastro/configuracoes' && semConta ? { ponto: semConta === 1 ? '1 natureza sem conta' : semConta + ' naturezas sem conta' } : {}),
  }));
  function onAbaNaEtapa(id: string) {
    const a = NA_ETAPA.find(x => x.id === id);
    if (!a) return;
    // a primeira página da seção (Cadastro) abre como no menu lateral; as outras voltam onde a pessoa parou
    if (a.secao !== 'movimento' || secoes.find(x => x.id === a.secao)?.req) onSecao(a.secao);
    else onPagina(id);
  }

  function sair() {
    s.aplicar(x => c.aoSair(x, new Date()));
    navegar(caminho());
  }

  function voltarInicioDaEmpresa() {
    const t = c.telaInicialEmpresa(e);
    s.irPara(t.secao + '/' + t.pagina);
  }

  return {
    empresa: { codigo: s.codigo != null ? String(s.codigo) : lista?.codigo != null ? String(lista.codigo) : s.nome, nome: s.nome },
    titulo: pag?.titulo || '',
    versao: VERSAO_SISTEMA,
    secoes, paginas,
    onSecao, onPagina, sair, voltarInicioDaEmpresa,
    abasNaEtapa, onAbaNaEtapa,
    msgCadastro: MSG_CADASTRO_BLOQ,
    paginaExiste: !!pag || PAGINAS_ESCONDIDAS.some(p => p.id === s.pagina),
  };
}

function escapar(t: string): string {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
