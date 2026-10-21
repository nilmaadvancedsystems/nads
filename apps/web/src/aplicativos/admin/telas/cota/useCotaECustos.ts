// ViewModel da Cota e custos (o site do admin): o consumo de hoje contra a cota grátis do Firestore (robo/uso, medido pelo
// Google a cada 15 min), o histórico dos últimos 30 dias (robo/saudeBanco.usoPorDia, um dia completo por vez, mais o de
// hoje), o armazenamento do banco e a hospedagem de cada projeto (o resumo diário). Só o que tem medição: o que falta fica
// "sem medição", com o motivo que o robô deixou.
import { entregas } from '@nads/core';
import { useEffect, useState } from 'react';
import { useSaudeDoRobo } from '../../../tarefas/dados/repo';
import { useResumoDoBanco } from '../../dados/repo';

export type PeriodoDaCota = '7' | '30';
const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "20/10 (ter)" de "2026-10-20". */
function diaPorExtenso(dia: string): string {
  const d = new Date(dia + 'T12:00:00');
  return dia.slice(8, 10) + '/' + dia.slice(5, 7) + ' (' + DIAS_DA_SEMANA[d.getDay()] + ')';
}

export function useCotaECustos() {
  const saude = useSaudeDoRobo();
  const banco = useResumoDoBanco();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 60 * 1000); return () => clearInterval(r); }, []);
  const [campo, setCampo] = useState<entregas.CampoDoUso>('leituras');
  const [periodo, setPeriodo] = useState<PeriodoDaCota>('30');
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const uso = entregas.lerUsoDeHoje(saude?.uso);
  const hoje = entregas.cotaDeHoje(uso);
  const r = banco.resumo;
  const limite = entregas.COTA_GRATIS_DO_BANCO[campo];
  // os dias completos e, no fim, o de hoje (incompleto, do robo/uso)
  const dias = [
    ...(r?.usoPorDia || []).slice(-(Number(periodo) - (uso && !uso.erro ? 1 : 0))),
    ...(uso && !uso.erro ? [{ dia: 'hoje', leituras: uso.leituras, gravacoes: uso.gravacoes, exclusoes: uso.exclusoes }] : []),
  ];
  const maior = Math.max(0, ...dias.map(d => d[campo]));
  // os números em cima das barras: em milhares quando passam de 10 mil (cabe na coluna)
  const emMil = maior >= 10000;
  const rotuloDoCampo = entregas.CAMPOS_DO_USO.find(c => c.id === campo)?.rotulo.toLowerCase() || campo;
  const colunas = dias.map(d => ({
    chave: d.dia,
    rotulo: d.dia === 'hoje' ? 'hoje' : d.dia.slice(8, 10),
    sub: d.dia === 'hoje' ? '' : d.dia.slice(5, 7),
    total: emMil ? Math.max(d[campo] ? 1 : 0, Math.round(d[campo] / 1000)) : d[campo],
    aviso: d[campo] >= limite * 0.7,
    leitura: (d.dia === 'hoje' ? 'Hoje até agora' : diaPorExtenso(d.dia)) + ': ' + d[campo].toLocaleString('pt-BR') + ' ' + rotuloDoCampo,
  }));
  const doDia = dias.find(d => d.dia === escolhido) || null;
  const media = dias.filter(d => d.dia !== 'hoje');
  const somaDoPeriodo = media.reduce((s, d) => s + d[campo], 0);
  const diasAcima = media.filter(d => d[campo] >= limite * 0.7).length;

  return {
    carregando: !saude || !banco.carregado,
    exemplos: banco.exemplos,
    semPermissao: banco.semPermissao,
    /** hoje, contra a cota grátis */
    hoje,
    medidoHoje: uso ? (uso.erro ? 'Não consegui medir: ' + uso.erro : 'Medido ' + entregas.quandoNoPainel(uso.em, agora) + ' pelo Google · a cota zera à meia-noite da Califórnia (' + (uso.desde ? new Date(uso.desde).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' daqui' : '4 ou 5 h daqui') + ')') : 'O robô ainda não mediu o uso de hoje (robo/uso).',
    /** o histórico */
    campo, setCampo, campos: entregas.CAMPOS_DO_USO.map(c => ({ valor: c.id, rotulo: c.rotulo })),
    periodo, setPeriodo, periodos: [{ valor: '7' as const, rotulo: '7 dias' }, { valor: '30' as const, rotulo: '30 dias' }],
    colunas,
    emMil,
    temHistorico: !!r?.usoPorDia.length,
    escolhido, escolher: (chave: string) => setEscolhido(e => (e === chave ? null : chave)),
    doDia: doDia ? {
      titulo: doDia.dia === 'hoje' ? 'Hoje, até agora' : diaPorExtenso(doDia.dia),
      texto: entregas.CAMPOS_DO_USO.map(c => doDia[c.id].toLocaleString('pt-BR') + ' ' + c.rotulo.toLowerCase() + ' (' + Math.round((doDia[c.id] / entregas.COTA_GRATIS_DO_BANCO[c.id]) * 100) + '% da cota)').join(' · '),
    } : null,
    resumoDoPeriodo: media.length ? {
      media: Math.round(somaDoPeriodo / media.length).toLocaleString('pt-BR'),
      dias: media.length,
      acima: diasAcima,
      limite: limite.toLocaleString('pt-BR'),
      rotulo: rotuloDoCampo,
    } : null,
    /** o armazenamento e a hospedagem (só o que o robô mediu) */
    armazenamento: entregas.cotaDoArmazenamento(r),
    hospedagem: (r?.hospedagem || []).map(h => ({ ...h, sites: h.sites.slice(0, 8).map(s => ({ ...s, tamanho: entregas.formatarBytes(s.bytes) })) })),
    erroDoArmazenamento: r?.armazenamento.erro || '',
    temResumo: !!r,
  };
}
