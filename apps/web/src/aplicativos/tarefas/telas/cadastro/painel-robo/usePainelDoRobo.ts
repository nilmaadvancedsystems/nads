// ViewModel do Cadastro › Painel do robô (Vitor, 21/10/2026: "quero um painel para eu saber o que o robô está fazendo,
// arquivando e afins"): a situação dos dois robôs (o do PC e o da nuvem), as filas de pedidos, os erros das últimas 24 h,
// o que foi arquivado hoje e no mês (com o caminho para Admin › Arquivador) e a atividade, com o filtro
// por tipo e por erro. Os dados chegam ao vivo do banco (usePainelRobo); o relógio da tela anda a cada 15 s para o
// "há X min" não parar.
import { entregas } from '@nads/core';
import { useEffect, useState } from 'react';
import { useOperador } from '../../../casca/operador';
import { caminhoDoAdmin } from '../../../../admin/casca/navegacao';
import { usePainelRobo } from '../../../dados/repo';

const DE_CADA_VEZ = 30;

export function usePainelDoRobo() {
  const d = usePainelRobo();
  const op = useOperador().operador;
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 15 * 1000); return () => clearInterval(r); }, []);
  const [tipo, setTipo] = useState('todos');
  const [soErros, setSoErros] = useState(false);
  const [quantas, setQuantas] = useState(DE_CADA_VEZ);

  const robos = [entregas.situacaoDoRobo('pc', d.pc, d.sinais.pc, agora), entregas.situacaoDoRobo('vm', d.vm, d.sinais.vm, agora)];
  const filas = entregas.filasDoPainel(d.pc, d.vm, agora);
  const filtradas = entregas.filtrarAtividades(d.atividades, { tipo, soErros });
  const arquivados = d.pc?.arquivados || null;
  // o que está HOJE em NÃO IDENTIFICADOS (a mesma conta da aba Para resolver; null: o robô ainda não conta)
  const paraResolver = d.pc?.paraResolver ?? null;
  // o Arquivador (22/10/2026: a área única dele, no site do admin, onde este painel também mora): só o admin
  const podeAbrirArquivo = !!op?.admin;

  return {
    carregando: !d.carregado,
    exemplos: d.exemplos,
    semPermissao: d.semPermissao && !d.pc && !d.vm,
    agora,
    robos,
    filas,
    esperando: filas.reduce((s, f) => s + f.esperando, 0),
    andamento: filas.reduce((s, f) => s + f.andamento, 0),
    erros: entregas.errosRecentes(d.atividades, agora).slice(0, 5),
    errosNas24h: entregas.errosRecentes(d.atividades, agora).length,
    arquivados,
    /** para resolver agora: o número e o texto ("Nada para resolver" no zero) */
    paraResolver: paraResolver ? { n: paraResolver.agora, texto: paraResolver.agora ? paraResolver.agora.toLocaleString('pt-BR') : 'Nada para resolver' } : null,
    /** o mês dos arquivados por extenso ("outubro de 2026") */
    mesDosArquivados: arquivados?.mes ? new Date(Number(arquivados.mes.slice(0, 4)), Number(arquivados.mes.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '',
    podeAbrirArquivo,
    caminhoDoArquivo: caminhoDoAdmin('arquivador'),
    tipos: entregas.tiposPresentes(d.atividades),
    tipo,
    soErros,
    atividades: filtradas.slice(0, quantas),
    temMais: filtradas.length > quantas,
    totalDeAtividades: filtradas.length,
    escolherTipo(t: string) { setTipo(t); setQuantas(DE_CADA_VEZ); },
    alternarSoErros() { setSoErros(x => !x); setQuantas(DE_CADA_VEZ); },
    verOsErros() { setTipo('todos'); setSoErros(true); setQuantas(DE_CADA_VEZ); },
    mostrarMais() { setQuantas(q => q + DE_CADA_VEZ); },
  };
}
