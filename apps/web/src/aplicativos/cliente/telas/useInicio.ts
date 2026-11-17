// ViewModel da Visão geral da Área do Cliente (Vitor, 16/10/2026). Refeita em 13/11/2026 ("refaça esses 3"; "muita
// informação"): a saudação com a linha do resumo do mês, o que precisa do cliente (dados/visaoGeral.ts, cada item com UMA
// ação), as próximas guias a pagar (só as poucas que vêm; a agenda inteira fica nas Guias) e o enviar documento.
// Enxugada em 16/11/2026 (o dono apresentou a área e ouviu "tinha muita informação"): o resumo com dois fatos, cada
// pendência numa linha e cada guia com o nome, "Vence 19/11", o valor e UM botão (Baixar); ver e copiar no menu "⋯".
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno, type ItemMenu } from '@nads/ui';
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

  // (16/11/2026, "muita informação") as próximas guias como nas Guias: o nome, "Vence 19/11", o valor e UM botão, o
  // Baixar (sem o PDF, o Copiar código; sem os dois, nada); o resto (ver a guia, copiar o código) no menu "⋯"
  const prox = proximasGuias(area.guias, hoje, PROXIMAS);
  const proximas = prox.itens.map(p => {
    const id = p.guia.id, codigo = area.codigos[id] ?? '', nome = ac.ROTULO_DA_GUIA[p.guia.tipo];
    const copiarCodigo = () => copiar(codigo, 'Código');
    const principal = p.guia.temPdf ? { rotulo: 'Baixar', icone: 'download' as const, acao: () => void baixar(id) }
      : codigo ? { rotulo: 'Copiar código', icone: 'copiar' as const, acao: copiarCodigo } : null;
    const mais: ItemMenu[] = [
      ...(p.guia.temPdf ? [{ rotulo: 'Ver a guia', icone: 'olho' as const, desabilitado: vista.abrindo === id, onClick: () => verGuia(id) }] : []),
      ...(p.guia.temPdf && codigo ? [{ rotulo: 'Copiar o código de barras', icone: 'copiar' as const, onClick: copiarCodigo }] : []),
    ];
    return { id, nome, quando: p.quando, valor: formatos.reais(p.guia.valor), principal, mais };
  });

  return {
    saudacao: hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite',
    // a linha embaixo da saudação, dois fatos no máximo ("4 pendências · atualizado hoje, 07:30")
    resumo: linhaDoResumo(pendencias.length, atualizado),
    pendencias, agir,
    /** o "tudo em dia" (13/11/2026, revisão: sem "a próxima guia vence em...": as próximas guias estão logo embaixo) */
    emDia: 'Nada pendente com você.',
    proximas,
    totalDasProximas: prox.quantas ? formatos.reais(prox.total) : '',
    rotuloDoTotal: rotuloDoTotal(prox.quantas, proximas.length),
    verTodas: () => irPara('guias'),
    vista, baixando,
  };
}
