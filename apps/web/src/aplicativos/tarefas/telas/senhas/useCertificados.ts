// ViewModel do painel Senhas › Certificados (07/10/2026: "um dashboard de certificados próximos a vencer, vencidos,
// válidos"; depois "eu queria algo mais gráfico"): a validade fica às claras no cofre, então o painel não precisa abrir
// o cofre. As fatias por situação (a rosca), os vencimentos mês a mês dos próximos 12 meses (as barras), os cartões dos
// que pedem atenção e a lista filtrada por situação ou por mês; clicar abre a empresa (precisa do cofre aberto).
import { cofre as c, empresas, formatos } from '@nads/core';
import { useState } from 'react';
import { useCofre } from './useCofre';

export type FiltroDeCertificados = 'vence' | 'vencido' | 'ok' | 'sem';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function useCertificados() {
  const vm = useCofre();
  const [filtro, setFiltroBruto] = useState<FiltroDeCertificados>('vence');
  /** o mês das barras escolhido (aaaa-mm); com ele, a lista é a dos que vencem nesse mês */
  const [mes, setMes] = useState<string | null>(null);
  const [aberta, setAberta] = useState<{ nome: string; codigo: number | null } | null>(null);
  const hoje = new Date();
  const todas = empresas.EMPRESAS_COM_DP.map(e => {
    const d = vm.itens.get(formatos.slug(e.nome));
    const s = c.situacaoDoCertificado(d?.temCertificado ? d.validade : undefined, hoje);
    return { chave: (e.codigo ?? '') + e.nome, codigo: e.codigo, nome: e.nome, validade: d?.temCertificado ? d.validade || '' : '', ...s };
  });
  type Linha = (typeof todas)[number];
  const contagem: Record<FiltroDeCertificados, number> = { vence: 0, vencido: 0, ok: 0, sem: 0 };
  for (const l of todas) contagem[l.situacao]++;

  const porMes = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const doMes = todas.filter(l => (l.situacao === 'vence' || l.situacao === 'ok') && l.validade.startsWith(chave));
    return { chave, rotulo: MESES[d.getMonth()], ano: i === 0 || d.getMonth() === 0 ? String(d.getFullYear()) : '', total: doMes.length, logo: doMes.some(l => l.situacao === 'vence') };
  });

  const porDias = (a: Linha, b: Linha) => (a.dias ?? 0) - (b.dias ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR');
  const daLista = mes ? todas.filter(l => l.situacao !== 'sem' && l.validade.startsWith(mes)) : todas.filter(l => l.situacao === filtro);
  const linhas = daLista.sort(!mes && filtro === 'vencido' ? (a, b) => porDias(b, a) : porDias);
  return {
    cofre: vm,
    carregando: vm.estado === 'carregando',
    comCertificado: todas.length - contagem.sem,
    contagem, porMes, linhas, filtro, mes,
    /** os que pedem atenção: os que vencem logo (do mais perto) e os vencidos (do mais recente) */
    urgentes: [...todas.filter(l => l.situacao === 'vence').sort(porDias), ...todas.filter(l => l.situacao === 'vencido').sort((a, b) => porDias(b, a))],
    setFiltro: (f: FiltroDeCertificados) => { setFiltroBruto(f); setMes(null); },
    escolherMes: (m: string) => setMes(x => (x === m ? null : m)),
    aberta, abrir: (nome: string, codigo: number | null) => setAberta({ nome, codigo }), fechar: () => setAberta(null),
  };
}
