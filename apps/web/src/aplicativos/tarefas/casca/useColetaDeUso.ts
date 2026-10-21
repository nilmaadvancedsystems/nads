// ViewModel da coleta do uso do sistema (Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no
// sistema, botões e funcionalidades para sabermos o que está inútil"): a tela da rota (app/página, sem a empresa), o
// acumulador da memória e a gravação a cada 5 minutos num documento por dia, uso/{AAAA-MM-DD}. Só coleta com o
// interruptor ligado (config/uso; o admin liga no Uso do sistema); a gravação recusada pelo banco (a regra de uso/ ainda
// não publicada) desliga a coleta nesta sessão, em silêncio. Os cliques e os controles vistos chegam da View
// (ColetaDeUso.tsx), que é quem olha o DOM.
import { uso } from '@nads/core';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import { useRepo, useUso } from '../dados/repo';
import { useOperador } from './operador';

export function useColetaDeUso() {
  const repo = useUso();
  const ligado = repo.ligado().ligado;
  const op = useOperador().operador;
  const { pathname } = useLocation();
  const empresas = useRepo().listarEmpresas();
  // os nomes das empresas (comparáveis), para nunca guardar um rótulo com o nome de um cliente
  const nomes = useMemo(() => empresas.map(e => uso.nomeComparavel(e.nome)).filter(n => n.length >= 5), [empresas]);
  const acumulador = useRef(uso.criarAcumulador());
  const negado = useRef(false);
  const tela = uso.telaDoCaminho(pathname);
  const departamento = op?.departamento || '';
  const pessoa = op?.nome || '';
  const ativo = ligado && !!op;

  // a visita: cada troca de tela
  useEffect(() => {
    if (ativo && tela && !negado.current) acumulador.current.visita(tela, departamento, pessoa);
  }, [ativo, tela, departamento, pessoa]);

  // grava o que se juntou; a recusa do banco desliga a coleta nesta sessão, outra falha devolve para a próxima vez
  const gravar = useRef(() => {
    if (negado.current) return;
    const a = acumulador.current;
    const delta = a.tirar();
    if (!delta) return;
    repo.somar(delta).catch((e: unknown) => {
      if (/permission|insufficient/i.test(String((e as Error)?.message || e))) negado.current = true;
      else a.devolver(delta);
    });
  });

  // a cada 5 minutos (e ao desligar ou sair da Tarefas)
  useEffect(() => {
    if (!ativo) return;
    const g = gravar.current;
    const relogio = setInterval(g, uso.INTERVALO_DE_GRAVAR_MS);
    return () => { clearInterval(relogio); g(); };
  }, [ativo]);

  return {
    ativo,
    tela,
    nomes,
    /** os controles desta tela já foram vistos nesta sessão? */
    jaViu: (t: string) => acumulador.current.jaViu(t),
    /** os controles que apareceram na tela (entram com 0); final: a tela fica vista nesta sessão */
    viu: (t: string, controles: readonly string[], final: boolean) => { if (!negado.current) acumulador.current.vistos(t, controles, final); },
    /** um clique num controle, na posição (x, y) de uma área largura × altura */
    clicou(t: string, controle: string, x: number, y: number, largura: number, altura: number) {
      if (negado.current) return;
      acumulador.current.clique(t, controle, uso.celula(x, y, largura, altura), departamento, pessoa);
    },
    /** grava já o que se juntou (ao esconder ou fechar a aba) */
    gravar: () => gravar.current(),
  };
}
