// A janela "Salvando as notas" (o ViewModel em useGravacaoNaNuvem.ts): a peça do catálogo "Andamento do robô (janela
// flutuante)", no canto da tela — o título com o aviso de não sair, a porcentagem, a barra e a linha das partes. No body:
// a página tem faixas com transform, que prenderiam o fixo.
import { BotaoFechar } from '@nads/ui';
import { createPortal } from 'react-dom';
import { useGravacaoNaNuvem } from './useGravacaoNaNuvem';

export function GravacaoNaNuvem() {
  const vm = useGravacaoNaNuvem();
  if (!vm) return null;
  return createPortal(
    <div className="card gmail-andamento sieg-flutuante sieg-andamento" role="status" aria-live="polite">
      <div className="fgts-resumo-topo">
        <div className="fgts-resumo-titulo">
          <h3>{vm.titulo}</h3>
          <span className="hint">{vm.subtitulo}</span>
        </div>
        <b className="sieg-andamento-pct num">{vm.pct}%</b>
        {vm.pronto && <BotaoFechar onClick={vm.fechar} />}
      </div>
      <span className={'tarefas-barra fgts-barra' + (vm.pronto ? '' : ' andando')}><span style={{ width: vm.pct + '%' }} /></span>
      <span className="fgts-robo-linha"><span className={'bolinha-sit ' + (vm.pronto ? 'concluida' : 'em-andamento')} aria-hidden="true" />{vm.detalhe}</span>
    </div>,
    document.body,
  );
}
