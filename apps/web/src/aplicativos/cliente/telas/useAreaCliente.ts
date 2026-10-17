// ViewModel da casca da Área do Cliente (Vitor, 16/10/2026): o token do link, o que o espelho mostra e a aba aberta. O
// menu é o do protótipo do Vitor ("gostei dos menus e tudo do html"): Visão geral, Documentos, Guias e obrigações,
// Departamento pessoal e Solicitações; e, no fim, Dados cadastrais e Fale com o escritório (janelas). Dentro de cada um, só
// o essencial ("o portal do cliente tem que ser o mais simples possível"). Os links antigos (/agenda, /enviar…) abrem o
// item certo.
import { areaCliente as ac } from '@nads/core';
import type { NomeIcone } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AREA_VAZIA, type EstadoDaArea } from '../dados/areaCliente';
import { repoAreaCliente } from '../dados/repo';
import { linkDoWhatsapp } from '../dados/regras';
import { useCopiar } from './useCopiar';

export type IdAba = 'inicio' | 'documentos' | 'guias' | 'dp' | 'chamados';
export const ABAS: { id: IdAba; rotulo: string; icone: NomeIcone }[] = [
  { id: 'inicio', rotulo: 'Visão geral', icone: 'home' },
  { id: 'documentos', rotulo: 'Documentos', icone: 'pastaAberta' },
  { id: 'guias', rotulo: 'Guias e obrigações', icone: 'recibo' },
  { id: 'dp', rotulo: 'Departamento pessoal', icone: 'usuario' },
  { id: 'chamados', rotulo: 'Solicitações', icone: 'mensagem' },
];
const APELIDOS: Record<string, IdAba> = { agenda: 'guias', vencimentos: 'guias', enviar: 'documentos', falar: 'chamados' };

export function useAreaCliente() {
  const { token = '', aba } = useParams();
  const navegar = useNavigate();
  const copiar = useCopiar();
  const [area, setArea] = useState<EstadoDaArea>(AREA_VAZIA);
  // o dia de hoje fixo enquanto a página está aberta (a situação das guias vem dele)
  const [hoje] = useState(() => new Date());

  useEffect(() => repoAreaCliente.assinar(token, setArea), [token]);

  const atual: IdAba = ABAS.find(a => a.id === aba)?.id ?? APELIDOS[aba ?? ''] ?? 'inicio';
  // no celular o menu é uma gaveta: abre pelo ☰, fecha ao escolher, no fundo ou no Esc
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => {
    if (!menuAberto) return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuAberto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [menuAberto]);
  const irPara = (id: IdAba) => { setMenuAberto(false); navegar('/cliente/' + encodeURIComponent(token) + '/' + id); window.scrollTo(0, 0); };
  const empresas = area.resumo?.empresas ?? [];
  const empresa = empresas.length > 1 ? empresas[0].nome + ' e mais ' + (empresas.length - 1) : empresas[0]?.nome ?? '';

  // o único número do menu: as guias vencidas, em Guias e obrigações
  const vencidas = ac.guiasDeHoje(area.guias, hoje).filter(g => g.situacao === 'vencida').length;
  const escritorio = area.resumo?.escritorio ?? {};

  return {
    token, area, hoje, aba: atual, abas: ABAS, vencidas, menuAberto, setMenuAberto, irPara, empresa, exemplos: repoAreaCliente.exemplos, copiar,
    // o atendimento fica num lugar só: a janela "Fale com o escritório"
    contato: { ...escritorio, whatsappLink: linkDoWhatsapp(escritorio.whatsapp), horario: area.atendimento?.horario ?? '', setores: area.atendimento?.setores ?? [] },
  };
}

export type AreaCliente = ReturnType<typeof useAreaCliente>;
/** o que cada tela recebe da casca */
export type DaCasca = Pick<AreaCliente, 'token' | 'area' | 'hoje' | 'irPara' | 'copiar' | 'exemplos'>;
