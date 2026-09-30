// ViewModel comum das páginas do Cadastro: a empresa aberta, o cadastro dela ao vivo, quem está trabalhando
// e o ponto de partida dos bancos (enquanto a empresa não tem bancos cadastrados, valem os que o Extrator já
// usava: a lista provisória e os adicionados na tela dele, lidos do banco sem gravar).
import { empresas, type extrator } from '@nads/core';
import { useEffect, useMemo, useState } from 'react';
import { empresaDaRota } from '../../../../comum/empresaDaRota';
import { useOperador } from '../../casca/operador';
import { extratorDaEmpresa } from '../../dados/fonte';
import { useCadastro } from '../../dados/repo';

/** A competência de hoje ('aaaa-mm'). */
export function competenciaDeHoje(agora = new Date()): string {
  return agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
}

/** '2026-08' → '08/2026' */
export const rotuloCompetencia = (c: string) => c.slice(5) + '/' + c.slice(0, 4);

export function useCadastroAberto(rota: string) {
  // CadastroAberto só abre a página quando a rota é de uma empresa da lista
  const empresa = empresaDaRota(rota) as empresas.EmpresaDoEscritorio;
  const por = useOperador().operador?.nome || '';
  const vivo = useCadastro(empresa.nome, empresa.codigo);
  const semBancos = vivo.carregada && !vivo.cadastro.bancos;
  const [doExtrator, setDoExtrator] = useState<{ nome: string; bancos: extrator.BancoAdicionado[] } | null>(null);

  useEffect(() => {
    if (!semBancos) return;
    let vale = true;
    extratorDaEmpresa(empresa.nome).then(
      e => { if (vale) setDoExtrator({ nome: empresa.nome, bancos: e.bancos || [] }); },
      () => { if (vale) setDoExtrator({ nome: empresa.nome, bancos: [] }); },
    );
    return () => { vale = false; };
  }, [semBancos, empresa.nome]);

  const adicionados = doExtrator?.nome === empresa.nome ? doExtrator.bancos : null;
  const partida = useMemo(() => empresas.cadastro.pontoDePartida(empresa.codigo, adicionados || []), [empresa.codigo, adicionados]);

  return {
    empresa,
    rota,
    por,
    ...vivo,
    /** o que vale enquanto não há cadastro (já com os bancos do Extrator quando chegarem) */
    partida,
    /** os bancos que a tela mostra: os cadastrados, ou o ponto de partida */
    bancos: vivo.cadastro.bancos ?? partida,
    /** ainda chegando: o cadastro, ou (sem cadastro) os bancos do Extrator */
    carregando: !vivo.carregada || (semBancos && !adicionados),
    hoje: competenciaDeHoje(),
  };
}

export type CadastroAberto = ReturnType<typeof useCadastroAberto>;
