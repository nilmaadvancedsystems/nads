// ViewModel de DP › Envios › Lote (28/10/2026: "uma opção onde eu subo um lote de arquivos, esses arquivos são lidos e
// organizados para dispará-los em lote, após a disparada eles salvam no drive e alimentam o sistema com valores de folha,
// fgts etc"): subir os arquivos, acompanhar a leitura do robô, revisar (os arquivos por cliente; o que o leitor não
// reconheceu, a pessoa escolhe o cliente, o tipo e a competência, ou tira do lote) e disparar. Depois do disparo, os
// valores de cada cliente enviado (o FGTS e a DARF do INSS) vão para a execução do DP do mês, ao lado do total da folha.
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { competenciasDoDp } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { useExecucoes, useGmailDoEntregas, useLoteDp, useRepo } from '../../dados/repo';
import type { ArquivoDoLote, EscolhaDoArquivo } from '../../dados/loteDp';
import { useClientesDoDp } from './useClientesDoDp';

/** os tipos que a pessoa escolhe para o arquivo que o leitor não reconheceu */
export const TIPOS_DO_LOTE = [
  { valor: 'FGTS', rotulo: 'FGTS' }, { valor: 'DARF', rotulo: 'DARF' }, { valor: 'FOLHA', rotulo: 'Folha' },
  { valor: 'PRO-LABORE', rotulo: 'Pró-labore' }, { valor: 'OUTRO', rotulo: 'Outro' },
] as const;
const MAX_ARQUIVOS = 150;
const MAX_BYTES = 25 * 1024 * 1024;
// a etapa e a chave de cada valor na execução do DP (o total da folha é o mesmo do "Folha do mês" das Obrigações)
const VALORES: Record<string, { etapa: string; rotulo: string }> = {
  fgts: { etapa: 'dp-fgts', rotulo: 'FGTS' }, darf: { etapa: 'dp-darf', rotulo: 'DARF INSS' }, folha: { etapa: 'dp-folha', rotulo: 'Folha' },
};
export const ROTULO_DO_VALOR = Object.fromEntries(Object.entries(VALORES).map(([k, v]) => [k, v.rotulo])) as Record<string, string>;

/** o que vale do arquivo: a escolha da revisão sobre a leitura do robô (cliente 0 = ainda não escolhido) */
export function efetivo(a: ArquivoDoLote) {
  const l = a.leitura;
  const e = a.escolha;
  return {
    codigo: e && e.cliente > 0 ? e.cliente : l?.cliente ?? null,
    competencia: (e && e.competencia) || l?.competencia || '',
    tipo: (e && e.tipo) || l?.tipo || '',
    escolhido: !!e,
  };
}

export function useLoteDoDp() {
  const repo = useLoteDp();
  const tarefas = useRepo();
  const gmail = useGmailDoEntregas();
  const op = useOperador().operador as Operador;
  const { toast, modal } = useRetorno();
  const doDp = useClientesDoDp();
  const lotes = repo.lotes();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const atual = (escolhido ? lotes.lista.find(l => l.id === escolhido) : null) || lotes.lista[0] || null;
  const idAtual = atual?.id || '';
  const [arquivos, setArquivos] = useState<{ lote: string; lista: ArquivoDoLote[] } | null>(null);
  useEffect(() => {
    if (!idAtual) return;
    return repo.arquivos(idAtual, lista => setArquivos({ lote: idAtual, lista }));
  }, [idAtual, repo]);
  const lista = arquivos && arquivos.lote === idAtual ? arquivos.lista : [];
  const [subindo, setSubindo] = useState<{ feitos: number; total: number } | null>(null);
  const [disparando, setDisparando] = useState(false);

  // os clientes do DP para escolher e para mostrar (o nome e o e-mail: o do Cadastro do nads, senão o do Entregas)
  const emailsDoEntregas = new Map(gmail.clientes().lista.map(c => [c.codigo, [c.email, ...c.emails].filter(Boolean)]));
  const clientes = doDp.clientes.map(c => ({
    codigo: c.codigo, nome: c.nomeNaTela,
    email: (c.cadastro?.contato?.email || '').trim().toLowerCase() || (emailsDoEntregas.get(String(c.codigo)) || [])[0] || (repo.exemplos ? 'financeiro@exemplo.com.br' : ''),
  }));
  const doCodigo = new Map(clientes.map(c => [c.codigo, c]));

  // a revisão: os lidos por cliente e competência; os que faltam escolher; os tirados; os que deram erro
  const porChave = new Map<string, { codigo: number; competencia: string; arquivos: ArquivoDoLote[] }>();
  const faltam: ArquivoDoLote[] = [];
  const tirados: ArquivoDoLote[] = [];
  const comErro: ArquivoDoLote[] = [];
  for (const a of lista) {
    if (a.status === 'erro') { comErro.push(a); continue; }
    if (a.status !== 'lido') continue;
    if (a.fora) { tirados.push(a); continue; }
    const x = efetivo(a);
    if (x.codigo == null || !x.competencia) { faltam.push(a); continue; }
    const chave = x.codigo + '_' + x.competencia;
    if (!porChave.has(chave)) porChave.set(chave, { codigo: x.codigo, competencia: x.competencia, arquivos: [] });
    porChave.get(chave)!.arquivos.push(a);
  }
  // a competência do lote: a mais comum entre os lidos (senão, a do DP); vale para o arquivo em que o leitor não a achou
  const contagem = new Map<string, number>();
  for (const g of porChave.values()) contagem.set(g.competencia, (contagem.get(g.competencia) || 0) + g.arquivos.length);
  const competenciaDoLote = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || competenciasDoDp(12).padrao;
  const resultadoDe = new Map((atual?.resultados || []).map(r => [r.chave, r]));
  const grupos = [...porChave.entries()].map(([chave, g]) => ({
    chave, ...g, nome: doCodigo.get(g.codigo)?.nome || '', email: doCodigo.get(g.codigo)?.email || '', resultado: resultadoDe.get(chave) || null,
  })).sort((a, b) => a.codigo - b.codigo || a.competencia.localeCompare(b.competencia));

  // os valores de cada cliente enviado vão para a execução do DP do mês (uma vez por lote e cliente; o valor que já está
  // igual não grava de novo)
  useExecucoes(grupos[0]?.competencia || atual?.resultados[0]?.competencia || '2026-01', 'dp');
  const gravados = useRef(new Set<string>());
  useEffect(() => {
    if (!atual || atual.status !== 'disparado') return;
    for (const r of atual.resultados) {
      const marca = atual.id + ':' + r.chave;
      if (r.status !== 'enviado' || !Object.keys(r.valores).length || gravados.current.has(marca)) continue;
      if (!tarefas.carregada(r.competencia, 'dp')) { tarefas.execucoes(r.competencia, 'dp'); continue; }
      const nome = doCodigo.get(r.codigo)?.nome;
      if (!nome) continue;
      gravados.current.add(marca);
      let ex = tarefas.execucoes(r.competencia, 'dp').find(x => x.empresa === nome) || t.execucaoNova(nome, r.codigo, r.competencia, 'dp');
      for (const [chave, valor] of Object.entries(r.valores)) {
        const v = VALORES[chave];
        if (!v || ex.valores?.[chave] === valor) continue;
        const g = t.informarValor(ex, v.etapa, chave, valor, op.nome, new Date());
        tarefas.gravar(g.execucao, g.evento);
        ex = g.execucao;
      }
    }
  });

  return {
    exemplos: repo.exemplos,
    carregando: !lotes.carregados,
    lotes: lotes.lista,
    atual,
    escolherLote: setEscolhido,
    arquivos: lista,
    grupos,
    faltam,
    tirados,
    comErro,
    clientes,
    /** a competência que vale para o arquivo sem ela (a mais comum do lote) */
    competenciaDoLote,
    subindo,
    disparando,
    /** quantos clientes vão no disparo (os ainda não enviados) */
    paraDisparar: grupos.filter(g => g.resultado?.status !== 'enviado').length,
    /** sobe os arquivos escolhidos e entrega o lote ao robô */
    async subir(escolhidos: FileList | File[]) {
      const lista = Array.from(escolhidos);
      if (!lista.length || subindo) return;
      if (lista.length > MAX_ARQUIVOS) { toast('No máximo ' + MAX_ARQUIVOS + ' arquivos por lote.'); return; }
      const grande = lista.find(f => f.size > MAX_BYTES);
      if (grande) { toast(grande.name + ' passa de 25 MB.'); return; }
      setSubindo({ feitos: 0, total: lista.length });
      try {
        const lidos = await Promise.all(lista.map(async f => ({ nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
        const id = await repo.subir(lidos, (feitos, total) => setSubindo({ feitos, total }));
        setEscolhido(id);
        toast(lista.length + (lista.length === 1 ? ' arquivo enviado' : ' arquivos enviados') + ' ao robô para ler.');
      } catch (e) { toast('Não consegui subir: ' + (e instanceof Error ? e.message : String(e))); } finally { setSubindo(null); }
    },
    /** a escolha da revisão: o que mudar (cliente, tipo ou competência) vale sobre o que o robô leu */
    async escolher(arquivo: ArquivoDoLote, mudar: Partial<EscolhaDoArquivo>) {
      if (!atual) return;
      const x = efetivo(arquivo);
      const escolha: EscolhaDoArquivo = {
        cliente: mudar.cliente ?? (x.codigo || 0),
        tipo: mudar.tipo ?? (x.tipo || 'OUTRO'),
        competencia: mudar.competencia ?? (x.competencia || competenciaDoLote),
      };
      try { await repo.escolher(atual.id, arquivo.id, escolha); }
      catch (e) { toast('Não consegui gravar: ' + (e instanceof Error ? e.message : String(e))); }
    },
    async desfazerEscolha(arquivo: ArquivoDoLote) {
      if (!atual) return;
      try { await repo.escolher(atual.id, arquivo.id, null); } catch (e) { toast('Não consegui desfazer: ' + (e instanceof Error ? e.message : String(e))); }
    },
    async tirar(arquivo: ArquivoDoLote, fora: boolean) {
      if (!atual) return;
      try { await repo.tirar(atual.id, arquivo.id, fora); } catch (e) { toast('Não consegui: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** dispara o lote (os clientes ainda não enviados), depois de confirmar */
    async disparar() {
      if (!atual || disparando) return;
      const n = grupos.filter(g => g.resultado?.status !== 'enviado').length;
      if (!n) return;
      const semEmail = grupos.filter(g => g.resultado?.status !== 'enviado' && !g.email).length;
      const ok = await modal({
        icone: 'envelope', titulo: 'Disparar para ' + n + (n === 1 ? ' cliente?' : ' clientes?'),
        texto: 'Cada cliente recebe os arquivos dele no e-mail do cadastro; depois o robô grava cada arquivo na pasta do cliente no Drive.' +
          (semEmail ? ' ' + semEmail + (semEmail === 1 ? ' cliente está' : ' clientes estão') + ' sem e-mail e vai dar erro.' : '') +
          (faltam.length ? ' ' + faltam.length + (faltam.length === 1 ? ' arquivo sem cliente fica' : ' arquivos sem cliente ficam') + ' de fora.' : ''),
        botoes: [{ rotulo: 'Disparar', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
      });
      if (!ok) return;
      setDisparando(true);
      try { await repo.disparar(atual.id); } catch (e) { toast('Não consegui disparar: ' + (e instanceof Error ? e.message : String(e))); } finally { setDisparando(false); }
    },
  };
}

export type VmLoteDoDp = ReturnType<typeof useLoteDoDp>;
