// ViewModel da escolha de empresa, igual em todos os aplicativos: busca por nome ou código,
// lista embaixo e Enter. O que acontece ao entrar é do aplicativo (aoEntrar).
import { empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';

export const LIMITE_LISTA = 50;

export function useEscolherEmpresa<T extends empresas.EmpresaDoEscritorio>(lista: readonly T[], aoEntrar: (x: T) => void) {
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(false);
  const achadas = useMemo(() => empresas.buscarEmpresas(lista, busca), [lista, busca]);

  function entrar(x: T) {
    setBusca('');
    setAberta(false);
    aoEntrar(x);
  }

  function confirmar() {
    const alvo = empresas.empresaDoEnter(lista, busca);
    if (alvo === null) return;
    if (alvo === 'varias') { toast('Mais de uma empresa com isso — escolha na lista.'); return; }
    if (alvo === 'nenhuma') { toast('Nenhuma empresa com esse código ou nome.'); return; }
    entrar(alvo);
  }

  return {
    busca, onBusca: (v: string) => { setBusca(v); setAberta(true); },
    listaAberta: aberta && !!busca.trim(),
    onAbrirLista: () => setAberta(true),
    onFecharLista: () => setTimeout(() => setAberta(false), 150),
    achadas: achadas.slice(0, LIMITE_LISTA),
    total: achadas.length,
    limite: LIMITE_LISTA,
    onEntrar: entrar,
    onConfirmar: confirmar,
  };
}
