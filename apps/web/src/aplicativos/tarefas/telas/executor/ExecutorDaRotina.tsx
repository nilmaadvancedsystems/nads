// Qual tela a rota do executor abre (23/10/2026): o fluxo operacional do Fiscal (Simples, Presumido e Real) ou o executor
// de sempre (useAbreOFluxo).
import { useParams } from 'react-router';
import { Executor } from './Executor';
import { FluxoDoFiscal } from './fluxo/FluxoDoFiscal';
import { useAbreOFluxo } from './useExecutorDaRotina';

export function ExecutorDaRotina() {
  const { empresa: rota = '', competencia = '' } = useParams();
  return useAbreOFluxo(rota, competencia) ? <FluxoDoFiscal /> : <Executor />;
}
