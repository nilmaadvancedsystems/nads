// ViewModel da lista do módulo Senhas (07/10/2026): as empresas com o que têm no cofre (senha gov.br, certificado e a
// validade dele) — às claras, sem abrir o cofre —, a busca, o filtro e a empresa aberta na janela.
import { cofre as c, empresas, formatos } from '@nads/core';
import { useState } from 'react';
import { useCofre } from './useCofre';

export type FiltroDeSenhas = 'todas' | 'vencendo' | 'sem';

export function useSenhasDasEmpresas() {
  const vm = useCofre();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeSenhas>('todas');
  const [aberta, setAberta] = useState<{ nome: string; codigo: number | null } | null>(null);
  const hoje = new Date();
  const todas = empresas.EMPRESAS_COM_DP.map(e => {
    const d = vm.itens.get(formatos.slug(e.nome));
    const cert = c.situacaoDoCertificado(d?.temCertificado ? d.validade : undefined, hoje);
    return { chave: (e.codigo ?? '') + e.nome, codigo: e.codigo, nome: e.nome, temGov: !!d?.temGov, temCertificado: !!d?.temCertificado, validade: d?.validade || '', ...cert };
  });
  // a busca na ordem dela (o código igual primeiro); a chave tem o código (dois clientes com o mesmo nome)
  const achadas = busca.trim() ? empresas.buscarEmpresas(todas.map(l => ({ ...l, regime: '' })), busca).map(e => e.chave) : null;
  const linhas = (achadas ? achadas.map(k => todas.find(l => l.chave === k)!) : todas).filter(l => l
    && (filtro === 'todas' || (filtro === 'vencendo' ? l.situacao === 'vence' || l.situacao === 'vencido' : !l.temGov || !l.temCertificado)));
  return {
    cofre: vm,
    linhas,
    contagem: {
      todas: todas.length,
      vencendo: todas.filter(l => l.situacao === 'vence' || l.situacao === 'vencido').length,
      sem: todas.filter(l => !l.temGov || !l.temCertificado).length,
    },
    busca, setBusca, filtro, setFiltro,
    aberta, abrir: (nome: string, codigo: number | null) => setAberta({ nome, codigo }), fechar: () => setAberta(null),
  };
}
