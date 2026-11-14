// ViewModel da Visão geral da Área do Cliente (Vitor, 16/10/2026). Refeita em 13/11/2026 ("refaça esses 3"; "muita
// informação"): a saudação com a linha do resumo do mês, o que precisa do cliente (dados/visaoGeral.ts, cada item com UMA
// ação), as próximas guias a pagar (só as poucas que vêm; a agenda inteira fica nas Guias) e o enviar documento.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { useVisualizar } from './useVisualizar';
import { linhaDoResumo, pendenciasDoCliente, proximasGuias, quandoFoi, rotuloDoTotal, type AcaoDaPendencia } from '../dados/visaoGeral';
import type { DaCasca } from './useAreaCliente';

/** quantas próximas guias a Visão geral mostra (13/11/2026: "ver todas" leva às Guias) */
const PROXIMAS = 4;

export function useInicio({ token, area, hoje, irPara, copiar }: DaCasca, abrirEnvio: () => void) {
  const { toast } = useRetorno();
  const navegar = useNavigate();
  const [baixando, setBaixando] = useState('');
  const [aberto, setAberto] = useState('');
  const pendencias = pendenciasDoCliente(area, hoje);

  // a pré-visualização da guia (12/11/2026: "quero que a pessoa tenha uma pré-visualização")
  const vista = useVisualizar();
  const verGuia = (id: string) => vista.ver(id, () => repoAreaCliente.baixarGuia(token, id));

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  /** a guia vencida não passa no banco: o chamado "Pedir um documento" já com o título */
  const pedirGuiaNova = (titulo: string) => irPara('chamados', { novoChamado: { tipo: 'documento', titulo } });

  function agir(a: AcaoDaPendencia) {
    switch (a.tipo) {
      case 'baixar-guia': void baixar(a.guia); break;
      case 'pedir-guia': pedirGuiaNova(a.titulo); break;
      case 'ver-chamado': irPara('chamados', { chamado: a.chamado }); break;
      case 'pedir-renovacao': irPara('chamados', { novoChamado: { tipo: 'documento', titulo: 'Renovação do certificado digital' } }); break;
      case 'enviar': abrirEnvio(); break;
      case 'ir': irPara(a.aba); break;
      // o formulário do Mandei, neste mesmo site (11/11/2026)
      case 'abrir-ticket': navegar('/mandei/' + encodeURIComponent(a.codigo)); break;
    }
  }

  const hora = new Date().getHours();
  const atualizado = area.resumo?.atualizadoEm ? quandoFoi(area.resumo.atualizadoEm, hoje) : '';
  const mes = formatos.capital(hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

  // (13/11/2026: "refaça esses 3") as próximas guias numa lista curta e alinhada: a data, o nome, quanto falta e o valor;
  // o clique abre as ações da guia (ver, copiar o código, baixar)
  const prox = proximasGuias(area.guias, hoje, PROXIMAS);
  const proximas = prox.itens.map(p => ({
    id: p.guia.id, dia: p.dia, semana: p.semana, faltam: p.faltam, nome: ac.ROTULO_DA_GUIA[p.guia.tipo],
    valor: formatos.reais(p.guia.valor), temPdf: p.guia.temPdf, codigo: area.codigos[p.guia.id] ?? '', aberta: aberto === p.guia.id,
  }));

  return {
    saudacao: hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite',
    // a linha embaixo da saudação ("Novembro de 2026 · 4 pendências · atualizado hoje, 07:30")
    resumo: linhaDoResumo(mes, pendencias.length, atualizado),
    pendencias, agir,
    /** o "tudo em dia" (13/11/2026, revisão: sem "a próxima guia vence em...": as próximas guias estão logo embaixo) */
    emDia: 'Nada pendente com você.',
    proximas,
    totalDasProximas: prox.quantas ? formatos.reais(prox.total) : '',
    rotuloDoTotal: rotuloDoTotal(prox.quantas, proximas.length),
    abrirGuia: (id: string) => setAberto(a => (a === id ? '' : id)),
    verTodas: () => irPara('guias'),
    vista, verGuia, baixando, baixar, copiarCodigo: (c: string) => copiar(c, 'Código'),
  };
}
