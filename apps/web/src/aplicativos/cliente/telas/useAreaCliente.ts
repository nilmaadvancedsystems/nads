// ViewModel da casca da Área do Cliente (Vitor, 16/10/2026): o token do link, o que o espelho mostra e a aba aberta.
// Acompanha o link inteiro; cada aba tira o que precisa daqui. As abas seguem o protótipo do Vitor: Visão geral,
// Documentos (com o Enviar), Guias e obrigações (com a Agenda), Departamento pessoal e Solicitações. Os links antigos
// (/agenda e /enviar) continuam abrindo a aba nova certa. Com o banco (17/10/2026), as abas sem fonte (Central de
// documentos e Departamento pessoal) somem do menu, e o link antigo delas cai numa aba que existe.
import type { areaCliente as ac } from '@nads/core';
import { definirLateralOculta, lerLateralOculta, type NomeIcone } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AREA_VAZIA, type EstadoDaArea } from '../dados/areaCliente';
import { repoAreaCliente } from '../dados/repo';
import { linkDoWhatsapp, notificacoes } from '../dados/regras';
import { guiasDoMomento } from '../dados/visaoGeral';
import { useCopiar } from './useCopiar';

export type IdAba = 'inicio' | 'documentos' | 'guias' | 'dp' | 'chamados';
export const ABAS: { id: IdAba; rotulo: string; icone: NomeIcone }[] = [
  { id: 'inicio', rotulo: 'Visão geral', icone: 'home' },
  { id: 'documentos', rotulo: 'Central de documentos', icone: 'pastaAberta' },
  { id: 'guias', rotulo: 'Guias e obrigações', icone: 'recibo' },
  { id: 'dp', rotulo: 'Departamento pessoal', icone: 'usuario' },
  { id: 'chamados', rotulo: 'Solicitações e chamados', icone: 'mensagem' },
];
/** O que a aba aberta pelo irPara já faz ao abrir: abrir a conversa de um chamado, ou o formulário com o assunto e o título. */
export interface PedidoDaTela { chamado?: string; novoChamado?: { tipo: ac.TipoDeChamado; titulo: string } }
const APELIDOS: Record<string, IdAba> = { agenda: 'guias', vencimentos: 'guias', enviar: 'documentos', falar: 'chamados' };

export function useAreaCliente() {
  const { token = '', aba } = useParams();
  const navegar = useNavigate();
  const copiar = useCopiar();
  const [area, setArea] = useState<EstadoDaArea>(AREA_VAZIA);
  // o dia de hoje fixo enquanto a página está aberta (a situação das guias vem dele)
  const [hoje] = useState(() => new Date());

  useEffect(() => repoAreaCliente.assinar(token, setArea), [token]);

  // as abas que este link consegue mostrar (o banco ainda não tem documentos do escritório nem o pessoal)
  const abas = ABAS.filter(a => (a.id !== 'documentos' || area.secoes.documentos) && (a.id !== 'dp' || area.secoes.dp));
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

  // o sino: o que pede atenção; "Marcar como lidas" esconde as que já estavam lá (nesta página)
  const [lidas, setLidas] = useState<Set<string>>(() => new Set());
  const avisos = notificacoes({ ...area, guias }, hoje, g => g.tipo === 'outra' ? 'Guia' : g.tipo);
  const naoLidas = avisos.filter(n => !lidas.has(n.id));

  return {
    token, area, hoje, aba: atual, abas, contadores, menuAberto, setMenuAberto, recolhida, alternarLateral, irPara, empresa, cnpj, rotuloDoDocumento, exemplos: area.exemplos,
    secoes: area.secoes, temFicha: !!area.ficha,
    avisos, naoLidas: naoLidas.length, lida: (id: string) => lidas.has(id), marcarLidas: () => setLidas(new Set(avisos.map(n => n.id))),
    copiar,
    contato: { ...escritorio, whatsappLink: linkDoWhatsapp(escritorio.whatsapp), equipe: area.atendimento?.equipe ?? 'Nilma Contabilidade', horario: area.atendimento?.horario ?? '', setores: area.atendimento?.setores ?? [] },
  };
}

export type AreaCliente = ReturnType<typeof useAreaCliente>;
/** o que cada aba recebe da casca */
export type DaCasca = Pick<AreaCliente, 'token' | 'area' | 'hoje' | 'irPara' | 'copiar'>;
