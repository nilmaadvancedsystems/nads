// A etapa de Importação da Contabilização (27/11/2026, o Vitor: "quero uma etapa de importacao igual ao tarefas que tinhamos la, tudo
// por menu lateral. Dentro de importacao vai ter: Lancamentos, Balancete e extratos, arquivos que vao ser usados para serem
// comparados com os lancamentos"; "Na etapa de importacao eu nao edito nada, so visualizo"): os três arquivos da empresa, cada um
// pelo robô do PC (o botão Vitor) ou do computador, e o extrato também pelo Drive e pelo e-mail. Aqui só entra e se vê; o que se
// decide fica nas etapas seguintes.
import { sci } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { balanceteGuardado, gravarBalancete, type BalanceteGuardado } from './BalanceteDoSci';
import { consultaDaContabilizacao, gravarConsultaDaContabilizacao, type ConsultaGuardada } from './RazaoDoSci';
import { extratoDaEmpresa, useExtratoParaSci } from './useExtratoParaSci';
import { rotuloDaCompetenciaDoSci, useLancamentosDoSciPeloRobo } from './useLancamentosDoSciPeloRobo';
import type { VmShadersCi } from './useShadersCi';

const dataTexto = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const qtd = (n: number, um: string, varios: string) => (n === 1 ? '1 ' + um : n + ' ' + varios);

export function useImportacaoDaContabilizacao(vm: VmShadersCi) {
  const codigo = vm.empresa?.codigo ?? null;
  const empresa = vm.empresa?.nome || '';
  const { aviso } = useRetorno();

  // ---- os lançamentos do SCI (a consulta): tudo de início, depois só os novos; o mês ou o ano troca só aquele período
  const [consulta, setConsulta] = useState<ConsultaGuardada | null>(() => consultaDaContabilizacao(codigo));
  async function importarConsulta(arquivo: File | undefined, competencia = '00/0000') {
    if (!arquivo || codigo == null) return;
    const lidos = await arquivo.arrayBuffer().then(b => sci.lerConsultaDoSci(b)).catch(() => null);
    if (!lidos) { aviso({ tom: 'info', titulo: 'Não é a consulta do SCI', texto: 'Use a "Impressão de campos da consulta" dos lançamentos, exportada para o Excel.' }); return; }
    const antes = consultaDaContabilizacao(codigo)?.lancamentos || [];
    const junto = sci.juntarConsultas(antes, lidos, competencia);
    const g: ConsultaGuardada = { arquivo: arquivo.name, importadoEm: new Date().toISOString(), lancamentos: junto.lancamentos };
    gravarConsultaDaContabilizacao(codigo, g);
    setConsulta(g);
    aviso({ tom: 'ok', titulo: !antes.length ? qtd(junto.lancamentos.length, 'lançamento', 'lançamentos') + ' do SCI' : junto.periodo ? rotuloDaCompetenciaDoSci(competencia) + ': ' + qtd(junto.novos, 'lançamento', 'lançamentos') : junto.novos ? qtd(junto.novos, 'lançamento novo', 'lançamentos novos') : 'Nenhum lançamento novo', texto: arquivo.name });
  }
  const roboDosLancamentos = useLancamentosDoSciPeloRobo({ codigo, empresa, chegou: (f, c) => importarConsulta(f, c) });

  // ---- o balancete do SCI: puxar de novo troca
  const [balancete, setBalancete] = useState<BalanceteGuardado | null>(() => balanceteGuardado(codigo));
  async function importarBalancete(arquivo: File | undefined, competencia = '') {
    if (!arquivo || codigo == null) return;
    const r = await arquivo.arrayBuffer().then(b => sci.lerBalanceteDoSci(new Uint8Array(b), arquivo.name)).catch((e: unknown) => ({ balancete: null, erro: e instanceof Error ? e.message : String(e) }));
    if (!r.balancete) { aviso({ tom: 'info', titulo: 'Não é o balancete do SCI', texto: r.erro || '' }); return; }
    const g: BalanceteGuardado = { arquivo: arquivo.name, importadoEm: new Date().toISOString(), competencia, balancete: r.balancete };
    gravarBalancete(codigo, g);
    setBalancete(g);
    aviso({ tom: 'ok', titulo: 'Balancete do SCI: ' + qtd(r.balancete.contas.filter(c => !c.participante).length, 'conta', 'contas'), texto: dataTexto(r.balancete.inicio) + ' a ' + dataTexto(r.balancete.fim) });
  }
  const roboDoBalancete = useLancamentosDoSciPeloRobo({ codigo, empresa, tipo: 'sciBalancete', chegou: (f, c) => importarBalancete(f, c) });

  // ---- o extrato: o mesmo do Extrato → SCI (o Drive, os recebidos, o e-mail e o computador)
  const extrato = useExtratoParaSci(vm);

  const periodoDaConsulta = (() => {
    const ds = (consulta?.lancamentos || []).map(l => l.data).filter(Boolean).sort();
    return ds.length ? dataTexto(ds[0]) + ' a ' + dataTexto(ds[ds.length - 1]) : '';
  })();
  // o extrato lido (relido do guardado a cada desenho: o Extrato → SCI grava lá)
  const ex = extrato.extrato ? extratoDaEmpresa(codigo) : null;
  return {
    consulta, importarConsulta, roboDosLancamentos, periodoDaConsulta,
    balancete, importarBalancete, roboDoBalancete,
    /** o extrato: entra pelo mesmo leitor do Extrato → SCI */
    importarExtrato: (f: File | undefined) => extrato.importar(f), puxarExtrato: extrato.puxar, lendoExtrato: extrato.lendo, trocarExtrato: () => extrato.limpar(),
    /** o extrato lido: as linhas, o saldo anterior (se veio) e o final */
    resumoDoExtrato: ex,
    /** a etapa está feita: os três arquivos chegaram */
    feita: !!consulta?.lancamentos.length && !!balancete && !!ex,
  };
}

export type ImportacaoDaContabilizacao = ReturnType<typeof useImportacaoDaContabilizacao>;
