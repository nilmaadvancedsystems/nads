// ViewModel do "Por cliente" das Delegadas por mim (plano do Acessórias, ficha E23 lucratividade mínima; o dono, 25/11/2026:
// "tudo"): por cliente, o honorário do período ao lado do tempo que o cronômetro registrou nas tarefas delegadas e o custo
// desse tempo pelo valor por minuto que o Diretor informa. Só Diretor e Dono. Retrato PARCIAL (as rotinas não têm
// cronômetro): a tela diz isso. O custo por minuto fica neste computador (sem regra nova no banco); os honorários vêm do
// repositório que o Financeiro já usa (as regras só deixam o admin e o diretor ler), sem mexer no Financeiro.
import { formatos, tarefas } from '@nads/core';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useHonorarios, useTarefasDelegadas } from '../../dados/repo';

const d = tarefas.delegadas;
const CHAVE = 'nads-lucratividade-custo-por-minuto';
const lerCusto = () => { try { const v = Number(localStorage.getItem(CHAVE)); return Number.isFinite(v) && v > 0 ? v : 1; } catch { return 1; } };

/** os períodos (os mesmos do Por pessoa) e quantos meses de honorário cada um vale */
const MESES: Record<string, number> = { '7': 7 / 30, '30': 1, '90': 3 };

/** o tempo para a tela: "2 h 30 min" */
function horas(min: number): string {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
}

export function useLucratividadePorCliente() {
  const { operador } = useOperador();
  const pode = !!operador && (operador.nivel === 'diretor' || operador.nivel === 'dono');
  const delegadas = useTarefasDelegadas();
  const honorarios = useHonorarios();
  const [periodo, setPeriodo] = useState<tarefas.delegadas.PeriodoDosDados>('30');
  const [custo, setCustoBruto] = useState(lerCusto);
  const setCusto = (v: number) => { setCustoBruto(v); try { localStorage.setItem(CHAVE, String(v)); } catch { /* fica só nesta visita */ } };
  const agora = new Date();
  const desde = d.inicioDoPeriodo(periodo, agora);
  const lidas = delegadas.lista();
  const contratos = pode ? honorarios.contratos() : { carregada: true, lista: [], erro: '' };
  const tempos = tarefas.lucratividade.tempoPorCliente(lidas.tarefas.filter(t => !d.pedeDocumentos(t)), desde ? Date.parse(desde) : -Infinity, agora.getTime(), agora);
  const linhas = tarefas.lucratividade.lucratividade(tempos, contratos.lista, custo, MESES[periodo] ?? 1);
  const soma = (f: (l: (typeof linhas)[number]) => number) => linhas.reduce((s, l) => s + f(l), 0);
  return {
    pode,
    carregando: !lidas.carregadas || !contratos.carregada,
    erro: contratos.erro,
    periodo, setPeriodo,
    // sem o "Desde o começo": o honorário precisa de um número de meses
    periodos: d.PERIODOS_DOS_DADOS.filter(p => p.valor !== 'tudo').map(p => ({ valor: p.valor, rotulo: p.rotulo })),
    rotuloDoPeriodo: d.PERIODOS_DOS_DADOS.find(p => p.valor === periodo)?.rotulo || '',
    custo, setCusto,
    resumo: {
      honorarios: formatos.reais(soma(l => l.honorario ?? 0)),
      tempo: horas(soma(l => l.minutos)),
      custo: formatos.reais(soma(l => l.custo)),
      noVermelho: linhas.filter(l => l.sobra != null && l.sobra < 0).length,
    },
    linhas: linhas.map(l => ({
      ...l,
      honorarioTexto: l.honorario == null ? 'sem honorário' : formatos.reais(l.honorario),
      tempoTexto: horas(l.minutos),
      custoTexto: l.custo ? formatos.reais(l.custo) : '—',
      sobraTexto: l.sobra == null ? '—' : formatos.reais(l.sobra),
      vermelho: l.sobra != null && l.sobra < 0,
    })),
  };
}
