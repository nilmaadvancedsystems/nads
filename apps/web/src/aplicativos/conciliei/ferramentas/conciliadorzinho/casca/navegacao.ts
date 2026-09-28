// Navegação do Conciliadorzinho: cada etapa do passo a passo original é uma aba do cabeçalho
// (a caixa à esquerda é das ferramentas do Conciliei). A lista muda com as bandeiras escolhidas.
// Origem: conciliadorZINHO.html STEPS/rebuildSteps/stepNumFor (~L1010-1042).
import { conciliadorzinho as cz } from '@nads/core';
import type { NomeIcone } from '@nads/ui';
import { caminhoDaFerramenta } from '../../../casca/caminho';

export type IdEtapa = 'bandeiras' | `extrato-${cz.IdBandeira}` | 'notas' | 'contas' | 'totais' | 'arquivos';

export interface Etapa { id: IdEtapa; rotulo: string; titulo: string; icone: NomeIcone; grupo: number; bandeira?: cz.IdBandeira }

export function etapas(bandeiras: cz.IdBandeira[]): Etapa[] {
  return [
    { id: 'bandeiras', rotulo: 'Bandeiras', titulo: 'Bandeiras', icone: 'cartao', grupo: 1 },
    ...bandeiras.map(b => ({ id: ('extrato-' + b) as IdEtapa, rotulo: cz.bandeira(b).rotulo, titulo: 'Extrato da ' + cz.bandeira(b).rotulo, icone: 'fileText' as NomeIcone, grupo: 2, bandeira: b })),
    { id: 'notas', rotulo: 'Notas fiscais', titulo: 'Notas fiscais', icone: 'fileText', grupo: 3 },
    { id: 'contas', rotulo: 'Contas contábeis', titulo: 'Contas contábeis', icone: 'hash', grupo: 3 },
    { id: 'totais', rotulo: 'Totais', titulo: 'Conferência dos totais', icone: 'scale', grupo: 4 },
    { id: 'arquivos', rotulo: 'Arquivos', titulo: 'Arquivos', icone: 'download', grupo: 4 },
  ];
}

/** "conciliacao/<etapa>" — o caminho da etapa na URL, depois da empresa. */
export const SECAO = 'conciliacao';
export const idDaPagina = (e: IdEtapa) => SECAO + '/' + e;

/** Caminho completo de uma etapa, na empresa aberta do Conciliei. */
export const caminhoDaEtapa = (rota: string, e: IdEtapa) => caminhoDaFerramenta(rota, 'conciliadorzinho', idDaPagina(e));
