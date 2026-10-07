// ViewModel do painel Senhas › Certificados (07/10/2026: "um dashboard de certificados próximos a vencer, vencidos,
// válidos"): a validade fica às claras no cofre, então o painel não precisa abrir o cofre. Os números por situação, o
// filtro e a lista em ordem de vencimento; clicar abre a empresa (precisa do cofre aberto para ver o certificado).
import { cofre as c, empresas, formatos } from '@nads/core';
import { useState } from 'react';
import { useCofre } from './useCofre';

export type FiltroDeCertificados = 'vence' | 'vencido' | 'ok' | 'sem';

export function useCertificados() {
  const vm = useCofre();
  const [filtro, setFiltro] = useState<FiltroDeCertificados>('vence');
  const [aberta, setAberta] = useState<{ nome: string; codigo: number | null } | null>(null);
  const hoje = new Date();
  const todas = empresas.EMPRESAS_COM_DP.map(e => {
    const d = vm.itens.get(formatos.slug(e.nome));
    const s = c.situacaoDoCertificado(d?.temCertificado ? d.validade : undefined, hoje);
    return { chave: (e.codigo ?? '') + e.nome, codigo: e.codigo, nome: e.nome, validade: d?.temCertificado ? d.validade || '' : '', ...s };
  });
  const contagem: Record<FiltroDeCertificados, number> = { vence: 0, vencido: 0, ok: 0, sem: 0 };
  for (const l of todas) contagem[l.situacao]++;
  const linhas = todas.filter(l => l.situacao === filtro)
    .sort((a, b) => (filtro === 'vencido' ? (b.dias ?? 0) - (a.dias ?? 0) : (a.dias ?? 0) - (b.dias ?? 0)) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    cofre: vm,
    carregando: vm.estado === 'carregando',
    contagem, linhas, filtro, setFiltro,
    aberta, abrir: (nome: string, codigo: number | null) => setAberta({ nome, codigo }), fechar: () => setAberta(null),
  };
}
