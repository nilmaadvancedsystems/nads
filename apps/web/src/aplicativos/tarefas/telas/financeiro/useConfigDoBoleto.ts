// ViewModel da seção Boleto dos honorários (Efí) em Financeiro › Configurações (19/11/2026, decisão do dono: "multa e juros
// configuráveis"): a multa, os juros ao mês e o dia de vencimento padrão (config/boletoEfi). Cada campo grava ao sair dele;
// o que não serve não grava e mostra o aviso ao lado. Só o admin grava (as regras de config/).
import { financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useHonorarios } from '../../dados/repo';

type Campo = 'multa' | 'jurosAoMes' | 'diaPadrao';

/** "2,5" → 2.5; vazio → 0; o que não é número → NaN */
const numeroDigitado = (t: string) => (t.trim() ? Number(t.trim().replace(',', '.')) : 0);
const noCampo = (n: number) => String(n).replace('.', ',');

export function useConfigDoBoleto() {
  const repo = useHonorarios();
  const { toast } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const { carregada, config } = repo.configDoBoleto();
  const [avisos, setAvisos] = useState<Partial<Record<Campo, string>>>({});

  function definir(campo: Campo, texto: string) {
    const valor = numeroDigitado(texto);
    const novo = { ...config, [campo]: valor };
    const erro = financeiro.conferirConfigDoBoleto(novo).find(e => (campo === 'multa' ? /multa/ : campo === 'jurosAoMes' ? /juros/ : /dia/).test(e)) || '';
    setAvisos(a => ({ ...a, [campo]: erro }));
    if (erro || valor === config[campo]) return;
    void repo.salvarConfigDoBoleto(novo, operador).catch(e => toast('Não consegui salvar: ' + (e instanceof Error ? e.message : String(e))));
  }

  return {
    carregada, avisos,
    multa: noCampo(config.multa), juros: noCampo(config.jurosAoMes), dia: String(config.diaPadrao),
    definirMulta: (t: string) => definir('multa', t),
    definirJuros: (t: string) => definir('jurosAoMes', t),
    definirDia: (t: string) => definir('diaPadrao', t),
  };
}
