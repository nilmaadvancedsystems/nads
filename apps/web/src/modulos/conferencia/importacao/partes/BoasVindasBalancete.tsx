// Aviso de boas-vindas da empresa nunca aberta (conferencia.html renderImportacoes ~L2435).
import { Icone } from '@nads/ui';

export function BoasVindasBalancete({ autoLimpar, onResponder }: { autoLimpar: boolean; onResponder: (ligado: boolean) => void }) {
  return (
    <div className="welcome-banner">
      <p className="welcome-banner-kicker">Bem-vindo</p>
      <h3>Antes de continuar, importe o balancete mais atualizado desta empresa.</h3>
      {autoLimpar
        ? <p>O balancete é apagado automaticamente sempre que alguém sai da empresa, esse sistema serve para que toda conferência fique atualizada.</p>
        : <p>A função que apaga o balancete quando alguém sai da empresa está desligada. Ligada, ela serve para que toda conferência fique atualizada.</p>}
      <div className="welcome-banner-opcao">
        <span>{autoLimpar ? 'Quer deixar essa função ativada?' : 'Quer ativar essa função?'}</span>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <button type="button" className={'btn btn-sm' + (autoLimpar ? ' btn-primary' : '')} onClick={() => onResponder(true)}>Sim</button>
          <button type="button" className={'btn btn-sm' + (!autoLimpar ? ' btn-primary' : '')} onClick={() => onResponder(false)}>Não</button>
        </span>
      </div>
      <div className="welcome-banner-mantido">
        <Icone nome="checkCircle" /><span>O CFOP/Conta vinculado e os lançamentos automáticos já configurados <b>continuam guardados!</b></span>
      </div>
    </div>
  );
}
