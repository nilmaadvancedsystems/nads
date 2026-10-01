// Sessão da empresa aberta (ViewModel compartilhado pelas telas da Conferência e pela casca do Concilia aí).
// Junta o que o original espalhava em variáveis globais: ccState (filtro do Movimento),
// filtro (Consulta), confAbaAtual, cadTipo, consultaTipo, servOrdem, vc (Verificar por
// conta), reimp e as mensagens flutuantes. Zera ao trocar de empresa (entrar() do original).
// Também é aqui que mora irPara(), com as regras do antigo go() (~L1950).
import { conferencia as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAplicar, useEmpresaGuardada } from '../dados/repo';
import { caminho } from './caminho';

export type AbaCadastro = 'entradas' | 'saidas' | 'tomados' | 'prestados';

/** Estado do Verificar por conta (o "vc" do original) — o relatório nunca é salvo. */
export interface EstadoVerificar {
  /** códigos das contas escolhidas (uma, ou o grupo que divide os CFOPs) */
  contas: string[];
  razaoPorConta: Record<string, c.LinhaRazao[]>;
  razaoNome: Record<string, string>;
  cfopGrupo: string | null;
  resultado: c.ResultadoVerificacao | null;
  abaRes: string;
}

export const VERIFICAR_VAZIO: EstadoVerificar = { contas: [], razaoPorConta: {}, razaoNome: {}, cfopGrupo: null, resultado: null, abaRes: 'todas' };

export interface Sessao {
  nome: string;
  /** pedaço da URL da empresa: o código do ERP (ex.: "292") ou, sem código, o slug do nome */
  rota: string;
  /** código do ERP da URL (o mesmo nome pode ter dois códigos) */
  codigo: number | null;
  empresa: c.Empresa;
  aplicar: (acao: (e: c.Empresa) => c.Empresa) => c.Empresa | null;
  /** página aberta ("secao/pagina") */
  pagina: string;
  irPara: (pagina: string) => void;
  filtro: c.FiltroMovimento;
  setFiltro: (f: c.FiltroMovimento | ((f: c.FiltroMovimento) => c.FiltroMovimento)) => void;
  abaRelatorio: c.AbaRelatorio;
  setAbaRelatorio: (a: c.AbaRelatorio) => void;
  abaCadastro: AbaCadastro;
  setAbaCadastro: (a: AbaCadastro) => void;
  abaConsulta: c.GrupoConsulta;
  setAbaConsulta: (a: c.GrupoConsulta) => void;
  filtroConsulta: Record<c.GrupoConsulta, c.FiltroConsulta>;
  setFiltroConsulta: (g: c.GrupoConsulta, f: c.FiltroConsulta) => void;
  ordemDiv: Record<c.TipoNotaFiscal, c.OrdemGrupos>;
  setOrdemDiv: (t: c.TipoNotaFiscal, o: c.OrdemGrupos) => void;
  ordemServ: Record<c.TipoServico, c.OrdemServ>;
  setOrdemServ: (t: c.TipoServico, o: c.OrdemServ) => void;
  verificar: EstadoVerificar;
  setVerificar: (v: EstadoVerificar | ((v: EstadoVerificar) => EstadoVerificar)) => void;
  /** abre o Verificar por conta já com a conta (atalho "Revisar" do Relatório) */
  revisarConta: (codigos: string[]) => void;
  /** Checklist: a linha que acabou de ser marcada (anima o risco uma vez) */
  natAnimar: string | null;
  setNatAnimar: (m: string | null) => void;
  /** avisa que a página depende de um arquivo ainda não importado */
  avisoImportar: (req: keyof typeof AVISO_IMPORTAR) => void;
}

const Ctx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSessao fora da empresa aberta');
  return s;
}

export const MSG_CADASTRO_BLOQ = 'Cadastro fica disponível depois de importar o balancete e as notas (entradas e saídas, ou serviços).';

/** Os avisos de "falta importar" (AVISO_IMPORTAR do original, ~L1816). */
export const AVISO_IMPORTAR = {
  entradas: { titulo: 'Entradas ainda não importadas', html: 'Importe o relatório de <b>entradas</b> pra ver esses dados.', botao: 'Importar entradas', ir: 'importacao/entradas' },
  saidas: { titulo: 'Saídas ainda não importadas', html: 'Importe o relatório de <b>saídas</b> pra ver esses dados.', botao: 'Importar saídas', ir: 'importacao/saidas' },
  notas: { titulo: 'Nenhuma nota importada', html: 'O Movimento precisa das notas de <b>entradas</b> ou <b>saídas</b>. Importe pelo menos um dos relatórios.', botao: 'Importar notas', ir: 'importacao/entradas' },
  prestados: { titulo: 'Serviços prestados ainda não importados', html: 'Importe o relatório de <b>serviços prestados</b> pra ver esses dados.', botao: 'Importar serviços prestados', ir: 'importacao/prestados' },
  tomados: { titulo: 'Serviços tomados ainda não importados', html: 'Importe o relatório de <b>serviços tomados</b> pra ver esses dados.', botao: 'Importar serviços tomados', ir: 'importacao/tomados' },
  fiscais: { titulo: 'Nenhuma nota fiscal importada', html: 'Importe o relatório de <b>entradas</b> ou de <b>saídas</b> pra ver esses dados.', botao: 'Importar notas', ir: 'importacao/entradas' },
  servicos: { titulo: 'Nenhum serviço importado', html: 'Importe o relatório de <b>serviços tomados</b> ou <b>prestados</b> pra ver esses dados.', botao: 'Importar serviços', ir: 'importacao/tomados' },
  todas: { titulo: 'Cadastro ainda indisponível', html: 'O Cadastro fica disponível depois de importar o <b>balancete</b> e as notas: <b>entradas e saídas</b>, ou os <b>serviços</b>.', botao: 'Ir para a importação', ir: null },
} as const;

export function SessaoProvider({ nome, rota, codigo, pagina, children }: { nome: string; rota: string; codigo: number | null; pagina: string; children: ReactNode }) {
  const navegar = useNavigate();
  const { toast, modal } = useRetorno();
  const aplicar = useAplicar(nome);
  const guardada = useEmpresaGuardada(nome);
  const empresa = useMemo(() => guardada || c.empresaNova(nome), [guardada, nome]);

  // dentro de uma etapa da Tarefas (a Conferência fiscal), ?meses=aaaa-mm,… : o filtro já nasce no período que a pessoa está fazendo
  const { search } = useLocation();
  const [filtro, setFiltro] = useState<c.FiltroMovimento>(() => {
    const meses = new URLSearchParams(search).get('meses');
    return meses ? c.filtroDoPeriodo(meses.split(',')) : c.FILTRO_MOVIMENTO_VAZIO;
  });
  const [abaRelatorio, setAbaRelatorio] = useState<c.AbaRelatorio>('geral');
  const [abaCadastro, setAbaCadastro] = useState<AbaCadastro>('entradas');
  const [abaConsulta, setAbaConsulta] = useState<c.GrupoConsulta>('fiscais');
  const [filtroConsulta, setFC] = useState<Record<c.GrupoConsulta, c.FiltroConsulta>>({ fiscais: c.FILTRO_CONSULTA_VAZIO, servicos: c.FILTRO_CONSULTA_VAZIO });
  const [ordemDiv, setOD] = useState<Record<c.TipoNotaFiscal, c.OrdemGrupos>>({ entradas: 'cfop', saidas: 'cfop' });
  const [ordemServ, setOS] = useState<Record<c.TipoServico, c.OrdemServ>>({ tomados: 'nome', prestados: 'nome' });
  const [verificar, setVerificar] = useState<EstadoVerificar>(VERIFICAR_VAZIO);
  const [natAnimar, setNatAnimar] = useState<string | null>(null);

  const irPara = useCallback((destino: string) => {
    const e = empresa;
    let v = destino;
    if (v === 'importacao/prestados' && c.semPrest(e)) v = 'importacao/tomados';
    if (v.startsWith('cadastro/') && !c.importacoesOk(e)) { toast(MSG_CADASTRO_BLOQ); v = 'importacao/' + c.primeiraImportacaoPendente(e); }
    // sair do Verificar por conta descarta o relatório lido e o resultado (nunca é salvo)
    if (pagina === 'movimento/verificar' && v !== 'movimento/verificar') setVerificar(x => ({ ...x, razaoPorConta: {}, razaoNome: {}, resultado: null, abaRes: 'todas' }));
    navegar(caminho(rota + '/' + v));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [empresa, pagina, navegar, rota, toast]);

  const revisarConta = useCallback((codigos: string[]) => {
    const lista = codigos.filter(cod => empresa.contas.some(x => x.codigo === cod && !x.sintetica));
    if (!lista.length) { toast('Conta não encontrada no plano de contas.'); return; }
    setVerificar(x => {
      const mesmo = x.contas.join(',') === lista.join(',');
      return mesmo ? { ...x, contas: lista } : { ...VERIFICAR_VAZIO, contas: lista };
    });
    irPara('movimento/verificar');
  }, [empresa, irPara, toast]);

  const avisoImportar = useCallback((req: keyof typeof AVISO_IMPORTAR) => {
    const a = AVISO_IMPORTAR[req];
    void modal({ icone: 'upload', titulo: a.titulo, html: a.html, botoes: [{ rotulo: 'Agora não', valor: false, variante: 'btn-outline' }, { rotulo: a.botao, valor: true, variante: 'btn-primary' }] })
      .then(ok => { if (ok) irPara(a.ir || 'importacao/' + c.primeiraImportacaoPendente(empresa)); });
  }, [modal, irPara, empresa]);

  const valor: Sessao = {
    nome, rota, codigo, empresa, aplicar, pagina, irPara,
    filtro, setFiltro, abaRelatorio, setAbaRelatorio, abaCadastro, setAbaCadastro, abaConsulta, setAbaConsulta,
    filtroConsulta, setFiltroConsulta: (g, f) => setFC(x => ({ ...x, [g]: f })),
    ordemDiv, setOrdemDiv: (t, o) => setOD(x => ({ ...x, [t]: o })),
    ordemServ, setOrdemServ: (t, o) => setOS(x => ({ ...x, [t]: o })),
    verificar, setVerificar, revisarConta, natAnimar, setNatAnimar, avisoImportar,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** ?servicos=sim|nao (a Tarefas manda o que está no Cadastro da empresa); sem = a Conferência decide (pergunta). */
export function servicosDoEndereco(search: string): boolean | undefined {
  const v = new URLSearchParams(search).get('servicos');
  return v === 'sim' ? true : v === 'nao' ? false : undefined;
}

/**
 * A regra "presta serviços" mora no Cadastro da empresa (Vitor, 30/09/2026). Quando a Conferência abre pela
 * Tarefas, ela vem junto, e a empresa da Conferência fica igual (no lugar da pergunta de boas-vindas).
 */
export function useSincronizarPrestaServico(valor: boolean | null | undefined) {
  const s = useSessao();
  const atual = s.empresa.prestaServico;
  const { aplicar } = s;
  useEffect(() => {
    if (typeof valor === 'boolean' && atual !== valor) aplicar(x => c.definirPrestaServico(x, valor));
  }, [valor, atual, aplicar]);
}
