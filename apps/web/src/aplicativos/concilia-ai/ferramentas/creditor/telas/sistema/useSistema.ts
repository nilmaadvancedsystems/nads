// ViewModel da etapa Sistema: o arquivo de recebimentos do sistema (.xls/.xlsx/.csv), de onde vêm a
// Contrapartida e o Histórico de cada NF.
import { creditor as cr } from '@nads/core';
import { useState } from 'react';
import { useSessao } from '../../casca/sessao';

export const LIMITE_PREVIA = 50;

export function useSistema() {
  const s = useSessao();
  const [erro, setErro] = useState('');
  const linhas = s.estado.sistema;

  function usar(l: cr.LinhaSistema[], origem: string) {
    setErro('');
    // arquivo novo: as decisões do cruzamento eram sobre o outro
    s.mudar(e => ({ ...e, sistema: l, origemSistema: origem, decisoes: {}, alcancada: Math.min(e.alcancada, 2) }));
  }

  async function escolherArquivo(f: File | null) {
    if (!f) return;
    try { usar(cr.lerSistema(await f.arrayBuffer(), f.name), f.name); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.'); }
  }

  return {
    aceitar: cr.EXTENSOES_SISTEMA.join(','),
    erro, fecharErro: () => setErro(''),
    escolherArquivo,
    exemplo: () => usar(cr.lerSistema(new TextEncoder().encode(cr.EXEMPLO_SISTEMA_CSV).buffer as ArrayBuffer, 'exemplo.csv'), 'exemplo'),
    lido: linhas ? { origem: s.estado.origemSistema, qtd: linhas.length, semValor: linhas.filter(l => l.valor == null).length } : null,
    previa: (linhas || []).slice(0, LIMITE_PREVIA),
    restantes: Math.max(0, (linhas?.length || 0) - LIMITE_PREVIA),
    podeContinuar: !!linhas?.length,
    continuar: s.proxima,
    voltar: s.anterior,
  };
}
