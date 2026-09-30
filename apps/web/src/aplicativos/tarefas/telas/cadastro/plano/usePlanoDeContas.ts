// ViewModel do plano de contas da empresa: importar do Alterdata (a planilha do plano, ou o balancete) ou
// montar pelo balancete que a Conferência guardou; antes de trocar, mostra o que muda (e as contas usadas no
// cadastro que somem) e pede a confirmação. A lista: busca por código, classificação ou nome, e grupo.
import { empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { conferenciaDaEmpresa } from '../../../dados/fonte';
import { useCadastroAberto } from '../useCadastroAberto';

const cad = empresas.cadastro;

/** Quantas linhas a tabela desenha (o resto aparece com a busca). */
export const LIMITE_PLANO = 400;

const escapar = (t: string) => t.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
const n = (v: number) => v.toLocaleString('pt-BR');

export interface LinhaPlano extends empresas.cadastro.ContaDoPlano {
  /** o recuo (o nível na classificação) */
  nivel: number;
  /** onde a conta é usada no cadastro (banco, conta padrão) */
  usos: string[];
}

export function usePlanoDeContas(rota: string) {
  const c = useCadastroAberto(rota);
  const { toast, modal } = useRetorno();
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [lendo, setLendo] = useState(false);
  const contas = useMemo(() => c.plano?.contas || [], [c.plano]);

  const usos = useMemo(() => {
    const m = new Map<string, string[]>();
    const marcar = (codigo: string | undefined, uso: string) => { if (codigo) m.set(codigo, [...(m.get(codigo) || []), uso]); };
    for (const b of c.bancos) marcar(b.contaContabil, cad.descreverConta(b));
    for (const k of cad.CAMPOS_CONTA_PADRAO) marcar(c.cadastro.contasPadrao?.contas[k], cad.ROTULO_CONTA_PADRAO[k]);
    return m;
  }, [c.bancos, c.cadastro.contasPadrao]);

  const achadas = useMemo(() => cad.buscarNoPlano(contas, busca).filter(x => !grupo || x.grupo === grupo), [contas, busca, grupo]);
  const linhas: LinhaPlano[] = achadas.slice(0, LIMITE_PLANO).map(x => ({
    ...x, nivel: x.classificacao ? x.classificacao.split('.').length - 1 : 0, usos: usos.get(x.codigo) || [],
  }));
  const resumo = cad.resumoDoPlano(contas);

  /** Mostra o que muda e troca o plano, se a pessoa confirmar. */
  async function trocar(novas: empresas.cadastro.ContaDoPlano[], origem: 'arquivo' | 'balancete', arquivo?: string) {
    const r = cad.resumoDoPlano(novas);
    const m = cad.compararPlanos(c.plano, novas, c.cadastro);
    const partes = ['<b>' + n(r.total) + '</b> contas (' + n(r.analiticas) + ' recebem lançamento).'];
    if (c.plano) partes.push('Em relação ao plano atual: <b>' + n(m.novas) + '</b> novas, <b>' + n(m.saem) + '</b> saem e <b>' + n(m.renomeadas) + '</b> mudam de nome.');
    if (origem === 'balancete') partes.push('O balancete só traz as contas <b>com saldo</b>: o plano completo vem da planilha do plano de contas.');
    if (m.usadasQueSaem.length) partes.push('<b>Atenção:</b> estas contas usadas no cadastro não estão no plano novo: ' + m.usadasQueSaem.map(escapar).join(', ') + '.');
    const ok = await modal<boolean>({
      icone: 'upload', titulo: c.plano ? 'Trocar o plano de contas?' : 'Importar o plano de contas?', html: partes.join('<br><br>'),
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: c.plano ? 'Trocar' : 'Importar', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    const agora = new Date();
    const p: empresas.cadastro.PlanoDeContas = { contas: novas, origem, importadoEm: agora.toISOString(), ...(arquivo ? { arquivo } : {}), ...(c.por ? { por: c.por } : {}) };
    c.salvarPlano(p, cad.registrarPlano(c.cadastro, p, c.por, agora));
    toast('Plano de contas ' + (c.plano ? 'trocado' : 'importado') + ': ' + n(r.total) + ' contas.');
  }

  async function importarArquivo(f: File | null) {
    if (!f || lendo) return;
    setLendo(true);
    try {
      const lido = cad.lerPlanoDeContas(cad.lerPlanilhaDoPlano(await f.arrayBuffer(), f.name));
      if (lido.erro) { toast(lido.erro); return; }
      await trocar(lido.contas, 'arquivo', f.name);
    } catch {
      toast('Não consegui ler "' + f.name + '". Use a planilha (xls, xlsx ou csv) exportada do Alterdata.');
    } finally {
      setLendo(false);
    }
  }

  async function usarBalancete() {
    if (lendo) return;
    setLendo(true);
    try {
      const contasDoBalancete = cad.planoDoBalancete(await conferenciaDaEmpresa(c.empresa.nome));
      if (!contasDoBalancete.length) { toast(c.exemplos ? 'Nos dados de exemplo não há balancete da Conferência.' : 'A Conferência não tem balancete desta empresa.'); return; }
      await trocar(contasDoBalancete, 'balancete');
    } catch (err) {
      toast('Não consegui ler o balancete na nuvem: ' + (err as Error).message);
    } finally {
      setLendo(false);
    }
  }

  return {
    empresa: c.empresa,
    carregando: c.carregando || lendo,
    plano: c.plano,
    resumo,
    grupos: resumo.grupos.map(g => g.grupo),
    busca, setBusca,
    grupo, setGrupo,
    linhas,
    achadas: achadas.length,
    limite: LIMITE_PLANO,
    importarArquivo,
    usarBalancete,
    /** "de plano.xls em 30/09/2026 por Vitor" */
    origem: c.plano ? (c.plano.origem === 'balancete' ? 'do balancete da Conferência' : 'de ' + (c.plano.arquivo || 'um arquivo'))
      + (c.plano.importadoEm ? ' em ' + new Date(c.plano.importadoEm).toLocaleDateString('pt-BR') : '') + (c.plano.por ? ' por ' + c.plano.por : '') : '',
  };
}
