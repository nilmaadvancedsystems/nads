// ViewModel da casca da Área do Cliente (Vitor, 16/10/2026): o token do link, o que o espelho mostra e a aba aberta.
// Acompanha o link inteiro (guias, agenda, recibos e chamados); cada aba tira o que precisa daqui.
import { areaCliente as ac } from '@nads/core';
import type { NomeIcone } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AREA_VAZIA, type EstadoDaArea } from '../dados/areaCliente';
import { repoAreaCliente } from '../dados/repo';

export type IdAba = 'inicio' | 'guias' | 'agenda' | 'enviar' | 'chamados';
export const ABAS: { id: IdAba; rotulo: string; icone: NomeIcone }[] = [
  { id: 'inicio', rotulo: 'Início', icone: 'home' },
  { id: 'guias', rotulo: 'Guias', icone: 'recibo' },
  { id: 'agenda', rotulo: 'Agenda', icone: 'calendar' },
  { id: 'enviar', rotulo: 'Enviar', icone: 'upload' },
  { id: 'chamados', rotulo: 'Chamados', icone: 'mensagem' },
];

export function useAreaCliente() {
  const { token = '', aba } = useParams();
  const navegar = useNavigate();
  const [area, setArea] = useState<EstadoDaArea>(AREA_VAZIA);
  // o dia de hoje fixo enquanto a página está aberta (a situação das guias vem dele)
  const [hoje] = useState(() => new Date());

  useEffect(() => repoAreaCliente.assinar(token, setArea), [token]);

  const atual: IdAba = ABAS.find(a => a.id === aba)?.id ?? 'inicio';
  // no celular o menu é uma gaveta (como no protótipo): abre pelo ☰ e fecha ao escolher uma aba
  const [menuAberto, setMenuAberto] = useState(false);
  // a gaveta fecha com o Esc
  useEffect(() => {
    if (!menuAberto) return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuAberto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [menuAberto]);
  const irPara = (id: IdAba) => { setMenuAberto(false); navegar('/cliente/' + encodeURIComponent(token) + '/' + id); };
  const empresas = area.resumo?.empresas ?? [];
  const empresa = empresas.length > 1 ? empresas[0].nome + ' e mais ' + (empresas.length - 1) : empresas[0]?.nome ?? '';
  const cnpj = empresas.length === 1 ? empresas[0].cnpj : '';

  // o número ao lado de cada item do menu: guias para pagar, o que o escritório ainda faz no mês e chamados sem conclusão
  const mes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  const contadores: Partial<Record<IdAba, number>> = {
    guias: ac.guiasDeHoje(area.guias, hoje).length,
    agenda: ac.pendenciasDaAgenda(area.agenda.find(a => a.mes === mes)?.itens ?? []).length,
    chamados: area.chamados.filter(c => c.situacao !== 'concluido').length,
  };

  return { token, area, hoje, aba: atual, abas: ABAS, contadores, menuAberto, setMenuAberto, irPara, empresa, cnpj, exemplos: repoAreaCliente.exemplos };
}

export type AreaCliente = ReturnType<typeof useAreaCliente>;
/** o que cada aba recebe da casca */
export type DaCasca = Pick<AreaCliente, 'token' | 'area' | 'hoje' | 'irPara'>;
