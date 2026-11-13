// ViewModel da casca da Área do Cliente (Vitor, 16/10/2026): o token do link, o que o espelho mostra e a aba aberta.
// Acompanha o link inteiro; cada aba tira o que precisa daqui. As abas seguem o protótipo do Vitor: Visão geral,
// Documentos (com o Enviar), Guias e obrigações (com a Agenda), Departamento pessoal e Solicitações. Os links antigos
// (/agenda e /enviar) continuam abrindo a aba nova certa. Com o banco (17/10/2026), as abas sem fonte (Central de
// documentos e Departamento pessoal) somem do menu, e o link antigo delas cai numa aba que existe.
import { areaCliente as ac } from '@nads/core';
import { definirLateralOculta, lerLateralOculta, type NomeIcone } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AREA_VAZIA, type EstadoDaArea } from '../dados/areaCliente';
import { repoAreaCliente } from '../dados/repo';
import { abasDoCelular, diaRelativo, seloDoRegime, tokenDoLink, iniciaisDaEmpresa, linkDoWhatsapp, nomeDaPessoa, notificacoes, perfisComEste, ultimaEmpresa, type PerfilGuardado } from '../dados/regras';
import { guardarPerfis, lerPerfis } from '../dados/perfis';
import { TOKEN_COMO_NO_BANCO, TOKEN_DE_EXEMPLO } from '../dados/areaCliente.memoria';
import { guiasDoMomento } from '../dados/visaoGeral';
import { bibliotecaDoCliente, PASTAS_DA_BIBLIOTECA } from '../dados/biblioteca';
import { indiceDaBusca, type ItemDaBusca } from '../dados/busca';
import { passosDoTutorial } from '../dados/tutorial';
import { jaViuOTutorial, marcarTutorialVisto } from '../dados/tutorialVisto';
import { useCopiar } from './useCopiar';

export type IdAba = 'inicio' | 'documentos' | 'guias' | 'dp' | 'chamados' | 'faturamento' | 'empresa' | 'contato';
/** As abas do menu; as do Administrativo (12/11/2026: o Faturamento, os Dados cadastrais e o Fale com o escritório, que
 *  eram janelas) vêm embaixo do título dele. */
export const ABAS: { id: IdAba; rotulo: string; icone: NomeIcone; administrativo?: boolean }[] = [
  { id: 'inicio', rotulo: 'Visão geral', icone: 'home' },
  { id: 'documentos', rotulo: 'Central de documentos', icone: 'pastaAberta' },
  { id: 'guias', rotulo: 'Guias e obrigações', icone: 'recibo' },
  { id: 'dp', rotulo: 'Registro', icone: 'usuario' },
  { id: 'chamados', rotulo: 'Solicitações', icone: 'mensagem' },
  { id: 'faturamento', rotulo: 'Faturamento', icone: 'barChart', administrativo: true },
  { id: 'empresa', rotulo: 'Dados cadastrais', icone: 'predio', administrativo: true },
  { id: 'contato', rotulo: 'Fale com o escritório', icone: 'telefone', administrativo: true },
];
/** O que a aba aberta pelo irPara já faz ao abrir: abrir a conversa de um chamado, ou o formulário com o assunto e o título. */
export interface PedidoDaTela { chamado?: string; novoChamado?: { tipo: ac.TipoDeChamado; titulo: string }; /** a busca já preenchida (a busca geral, 13/11/2026) */ busca?: string }
const APELIDOS: Record<string, IdAba> = { agenda: 'guias', vencimentos: 'guias', enviar: 'documentos', falar: 'contato' };

export function useAreaCliente() {
  const { token = '', aba } = useParams();
  const navegar = useNavigate();
  const copiar = useCopiar();
  const [area, setArea] = useState<EstadoDaArea>(AREA_VAZIA);
  // o dia de hoje fixo enquanto a página está aberta (a situação das guias vem dele)
  const [hoje] = useState(() => new Date());

  useEffect(() => repoAreaCliente.assinar(token, setArea), [token]);

  // as abas que este link consegue mostrar (o banco ainda não tem documentos do escritório nem o pessoal)
  // os Dados cadastrais só com a ficha da empresa (o banco ainda não tem)
  // a Central de documentos sempre (12/11/2026, a biblioteca: as guias, o DP, as DANFEs e o que o cliente enviou também moram lá)
  const abas = ABAS.filter(a => (a.id !== 'dp' || area.secoes.dp) && (a.id !== 'empresa' || !!area.ficha));
  const pedida: IdAba = ABAS.find(a => a.id === aba)?.id ?? APELIDOS[aba ?? ''] ?? 'inicio';
  // escondida: o enviar documento mora em Solicitações; o resto volta para a Visão geral
  const atual: IdAba = abas.some(a => a.id === pedida) ? pedida : pedida === 'documentos' ? 'chamados' : 'inicio';
  // no celular o menu é uma gaveta (como no protótipo): abre pelo ☰ e fecha ao escolher uma aba
  const [menuAberto, setMenuAberto] = useState(false);
  // no PC a lateral recolhe só para os ícones, como a do app (Vitor, 17/10/2026: "coloca pra esconder a aba lateral assim
  // como no app"): a mesma preferência do nads, guardada no navegador (lerLateralOculta/definirLateralOculta, com try/catch)
  const [recolhida, setRecolhida] = useState(lerLateralOculta);
  const alternarLateral = () => { const nova = !recolhida; setRecolhida(nova); definirLateralOculta(nova); };
  // a gaveta fecha com o Esc
  useEffect(() => {
    if (!menuAberto) return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuAberto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [menuAberto]);
  const irPara = (id: IdAba, pedido?: PedidoDaTela) => { setMenuAberto(false); navegar('/cliente/' + encodeURIComponent(token) + '/' + id, { state: pedido ?? null }); window.scrollTo(0, 0); };
  const empresas = area.resumo?.empresas ?? [];
  const empresa = empresas.length > 1 ? empresas[0].nome + ' e mais ' + (empresas.length - 1) : empresas[0]?.nome ?? '';
  const cnpj = empresas.length === 1 ? empresas[0].cnpj : '';
  // o link de uma pessoa física (o robô grava o CPF no mesmo campo)
  const rotuloDoDocumento = cnpj.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ';

  const guias = guiasDoMomento(area.guias, hoje);
  // o número ao lado do item do menu, como no protótipo: os documentos novos e as guias vencidas
  const contadores: Partial<Record<IdAba, number>> = {
    documentos: area.documentos.filter(d => d.novo).length,
    guias: guias.filter(g => g.situacao === 'vencida').length,
  };
  const escritorio = area.resumo?.escritorio ?? {};

  // a troca de empresa (12/11/2026): esta empresa entra na lista do aparelho; as outras aparecem no menu do topo
  const [perfis, setPerfis] = useState<PerfilGuardado[]>(lerPerfis);
  // sem link (o app instalado abre pela raiz, 13/11/2026): vai para a última empresa aberta neste aparelho
  useEffect(() => {
    if (token) return;
    const ultima = ultimaEmpresa(lerPerfis());
    if (ultima) navegar('/cliente/' + encodeURIComponent(ultima), { replace: true });
  }, [token, navegar]);
  const nomeDaEmpresa = area.valido ? (empresas.length > 1 ? empresas.map(e => e.nome).join(' · ') : empresas[0]?.nome ?? '') : '';
  useEffect(() => {
    if (!area.carregado || !area.valido || !nomeDaEmpresa) return;
    const lista = perfisComEste(lerPerfis(), { token, nome: nomeDaEmpresa, documento: cnpj, ...(area.logo ? { logo: area.logo } : {}), usadoEm: new Date().toISOString() });
    guardarPerfis(lista);
    setPerfis(lista);
  }, [token, area.carregado, area.valido, nomeDaEmpresa, cnpj, area.logo]);
  // nos exemplos, as duas versões entram na lista para dar para testar a troca sem abrir outro link
  const ehExemplo = area.exemplos || token === TOKEN_DE_EXEMPLO || token.startsWith(TOKEN_COMO_NO_BANCO);
  const exemplos: PerfilGuardado[] = ehExemplo ? [
    { token: TOKEN_DE_EXEMPLO, nome: 'Personaly Company (exemplo completo)', documento: '00.000.000/0001-91', usadoEm: '' },
    { token: TOKEN_COMO_NO_BANCO, nome: 'Personaly Company (como no banco)', documento: '00.000.000/0001-91', usadoEm: '' },
  ].filter(e => !perfis.some(p => p.token === e.token)) : [];
  const outrasEmpresas = [...perfis, ...exemplos].filter(p => p.token !== token).map(p => ({ ...p, iniciais: iniciaisDaEmpresa(p.nome), quando: p.usadoEm ? diaRelativo(p.usadoEm, hoje) : '' }));
  const trocarDeEmpresa = (outro: string) => { setMenuAberto(false); navegar('/cliente/' + encodeURIComponent(outro) + '/' + atual); window.scrollTo(0, 0); };
  const esquecerEmpresa = (outro: string) => { const lista = lerPerfis().filter(p => p.token !== outro); guardarPerfis(lista); setPerfis(lista); };

  // a busca geral (13/11/2026): o índice do que a área tem; o Ctrl+K (ou a barra "/", fora de um campo) abre
  const [buscaAberta, setBuscaAberta] = useState(false);
  const indiceDaArea = useMemo(() => indiceDaBusca({
    abas: abas.map(a => ({ id: a.id, rotulo: a.rotulo, icone: a.icone })),
    guias: guias.map(g => ({ id: g.id, nome: ac.ROTULO_DA_GUIA[g.tipo], competencia: g.competencia, vencimento: g.vencimento, situacao: ac.ROTULO_DA_SITUACAO_DA_GUIA[g.situacao].toLowerCase() })),
    documentos: area.secoes.documentos || area.documentosDp.length || area.guias.length
      ? bibliotecaDoCliente({ guias: area.guias, documentosDp: area.documentosDp, danfes: area.danfes, documentos: area.secoes.documentos ? area.documentos : [], envios: area.envios })
        .map(i => ({ chave: i.chave, nome: i.nome, detalhe: i.detalhe, pasta: PASTAS_DA_BIBLIOTECA.find(p => p.id === i.pasta)?.rotulo ?? '' }))
      : [],
    chamados: area.chamados.map(ch => ({ id: ch.id, titulo: ch.titulo, situacao: ac.ROTULO_DA_SITUACAO_DO_CHAMADO[ch.situacao] })),
    funcionarios: (area.pessoal?.funcionarios ?? []).map(f => ({ id: f.id, nome: nomeDaPessoa(f.nome), ativo: f.ativo })),
  }), [abas, guias, area]);
  useEffect(() => {
    if (!area.valido) return;
    const tecla = (ev: KeyboardEvent) => {
      const noCampo = ev.target instanceof HTMLElement && ev.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((ev.key === 'k' || ev.key === 'K') && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); setBuscaAberta(true); }
      else if (ev.key === '/' && !noCampo && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); setBuscaAberta(true); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [area.valido]);

  // o tutorial guiado (13/11/2026): abre sozinho na primeira vez neste aparelho e pelo "Ver o tutorial" do menu; o jeito
  // (PC ou celular) pela largura da tela na hora de abrir
  const [tutorial, setTutorial] = useState<'pc' | 'celular' | null>(null);
  // os passos guardados (o mesmo objeto entre um desenho e outro: o tutorial acompanha o passo pelo objeto)
  const idsDasAbas = abas.map(a => a.id).join(',');
  const passosDoTutorialMemo = useMemo(() => (tutorial ? passosDoTutorial(tutorial, idsDasAbas.split(',')) : []), [tutorial, idsDasAbas]);
  const abrirTutorial = () => { setMenuAberto(false); setTutorial(window.matchMedia('(max-width: 767px)').matches ? 'celular' : 'pc'); };
  useEffect(() => {
    if (area.carregado && area.valido && token && !jaViuOTutorial(token)) setTutorial(window.matchMedia('(max-width: 767px)').matches ? 'celular' : 'pc');
  }, [area.carregado, area.valido, token]);

  // o sino: o que pede atenção; "Marcar como lidas" esconde as que já estavam lá (nesta página)
  const [lidas, setLidas] = useState<Set<string>>(() => new Set());
  // cada notificação com o ícone e o tom pelo que é (12/11/2026: o sino refeito): a guia, os documentos, a resposta, o certificado
  const avisos = notificacoes({ ...area, guias }, hoje, g => g.tipo === 'outra' ? 'Guia' : g.tipo).map(n => ({
    ...n,
    icone: (n.id.startsWith('g-') ? 'recibo' : n.id.startsWith('docs-') ? 'pastaAberta' : n.id.startsWith('cert-') ? 'escudo' : 'mensagem') as NomeIcone,
    tom: n.id.startsWith('g-') && n.titulo.endsWith('vencida') ? 'ruim' : n.id.startsWith('g-') || n.id.startsWith('cert-') ? 'atencao' : n.id.startsWith('c-') ? 'bom' : 'neutro',
  }));
  const naoLidas = avisos.filter(n => !lidas.has(n.id));

  return {
    token, area, hoje, logo: area.logo, aba: atual, abas,
    // a barra de baixo do celular (13/11/2026): as abas principais e o "Mais", aceso quando a aba aberta não está nela
    abasDeBaixo: abasDoCelular(abas.map(a => a.id)).map(id => {
      const a = abas.find(x => x.id === id)!;
      return { id, icone: a.icone, rotulo: ROTULO_CURTO[id] ?? a.rotulo, ativa: atual === id, conta: contadores[id] ?? 0 };
    }),
    maisAtivo: !abasDoCelular(abas.map(a => a.id)).includes(atual),
    outrasEmpresas, trocarDeEmpresa, esquecerEmpresa, iniciais: iniciaisDaEmpresa(empresa), contadores, menuAberto, setMenuAberto, recolhida, alternarLateral, irPara, empresa, cnpj, rotuloDoDocumento, exemplos: area.exemplos,
    secoes: area.secoes, temFicha: !!area.ficha,
    avisos, naoLidas: naoLidas.length, lida: (id: string) => lidas.has(id), marcarLidas: () => setLidas(new Set(avisos.map(n => n.id))),
    copiar,
    // a troca de empresa mais completa (13/11/2026: "muito simples"): o regime no selo e o link desta área para copiar
    regime: area.ficha?.regime ?? area.faturamento?.empresas?.[0]?.regime ?? '',
    seloDoRegime: seloDoRegime(area.ficha?.regime ?? area.faturamento?.empresas?.[0]?.regime ?? ''),
    /** abre outra empresa pelo link colado; devolve o erro em português, ou '' */
    abrirPeloLink: (texto: string) => { const t = tokenDoLink(texto); if (!t) return 'Não parece um link da Área do Cliente. Copie o link inteiro que o escritório mandou.'; trocarDeEmpresa(t); return ''; },
    copiarLink: () => copiar(window.location.origin + '/cliente/' + encodeURIComponent(token), 'Link da área'),
    tutorial: {
      modo: tutorial, abrir: abrirTutorial,
      passos: passosDoTutorialMemo,
      fechar: (concluiu: boolean) => { marcarTutorialVisto(token); setTutorial(null); if (concluiu) irPara('inicio'); },
      irPara: (aba: string) => irPara(aba as IdAba),
    },
    busca: {
      aberta: buscaAberta, abrir: () => setBuscaAberta(true), fechar: () => setBuscaAberta(false), indice: indiceDaArea,
      escolher: (i: ItemDaBusca) => { setBuscaAberta(false); irPara(i.ir as IdAba, i.pedido); },
    },
    contato: { ...escritorio, whatsappLink: linkDoWhatsapp(escritorio.whatsapp), equipe: area.atendimento?.equipe ?? 'Nilma Contabilidade', horario: area.atendimento?.horario ?? '', setores: area.atendimento?.setores ?? [] },
  };
}

/** o rótulo na barra de baixo do celular, onde cabe pouco */
const ROTULO_CURTO: Partial<Record<IdAba, string>> = { inicio: 'Início', documentos: 'Documentos', guias: 'Guias', chamados: 'Solicitações' };

export type AreaCliente = ReturnType<typeof useAreaCliente>;
/** o que cada aba recebe da casca */
export type DaCasca = Pick<AreaCliente, 'token' | 'area' | 'hoje' | 'irPara' | 'copiar'>;
