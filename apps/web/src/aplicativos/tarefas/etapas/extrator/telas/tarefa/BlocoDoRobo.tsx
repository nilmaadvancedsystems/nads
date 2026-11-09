// O bloco "Razões do Alterdata" da Importação (Vitor, 06/11/2026: "puxar automaticamente usando essa automação"; 09/11/2026:
// "quero que fique mais visual"): um quadradinho por mês do período com a situação (Pronto, Na fila, a barra do robô, Erro) e
// embaixo só o que pede atenção, em vermelho, com o botão para pedir de novo. Sem animação.
import { Icone } from '@nads/ui';
import type { RazaoDoRobo, SituacaoDoMes } from './useRazaoDoRobo';

const SELO: Record<SituacaoDoMes, { rotulo: string; classe: string }> = {
  pronto: { rotulo: 'Pronto', classe: 'badge-ok' },
  fila: { rotulo: 'Na fila', classe: 'badge-neutral' },
  robo: { rotulo: 'Puxando', classe: 'badge-warn' },
  erro: { rotulo: 'Erro', classe: 'badge-bad' },
  falta: { rotulo: 'Sem pedido', classe: 'badge-neutral' },
};

export function BlocoDoRobo({ robo }: { robo: RazaoDoRobo }) {
  if (!robo.disponivel) return null;
  const n = robo.porMes.length;
  const conta = (s: SituacaoDoMes) => robo.porMes.filter(m => m.situacao === s);
  const fila = conta('fila'), comRobo = conta('robo'), erros = conta('erro'), faltam = conta('falta');
  const tudoPronto = robo.prontos.length === n;
  const meses = (l: typeof robo.porMes) => l.map(m => robo.rotuloDoMes(m.mes)).join(', ');
  const atencao = [
    robo.falha ? 'Não consegui ver os pedidos: ' + robo.falha : '',
    robo.espera,
    ...erros.map(m => robo.rotuloDoMes(m.mes) + ': ' + (m.pedido?.erro || 'o robô não conseguiu')),
    robo.avisoDoBalancete,
  ].filter(Boolean);
  const problema = !!(robo.falha || robo.espera || erros.length);
  return (
    <div className={'imp-bloco' + (problema ? ' imp-erro' : tudoPronto && !robo.lendo ? ' imp-ok' : '')}>
      <div className="imp-linha">
        <span className="imp-ico"><Icone nome="robo" /></span>
        <div className="imp-txt">
          <span><b>Robô do Alterdata</b></span>
        </div>
        <div className="imp-resumo">
          <div>
            <span>{robo.lendo ? 'Lendo os lançamentos que o robô subiu' : robo.agora || 'Balancete dinâmico e razão de todas as contas, mês a mês'}</span>
          </div>
        </div>
        <div className="imp-grupos">
          <div className="imp-grupo" aria-label="Robô do Alterdata">
            <span className="imp-rotulo">{robo.carregado ? robo.prontos.length + ' de ' + n : ''}</span>
            {erros.length || faltam.length ? (
              <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={() => { void robo.pedirOsQueFaltam(); }}
                title={'Pedir ao robô: ' + meses([...erros, ...faltam])} aria-label="Pedir ao robô os meses que faltam"><Icone nome="play" /></button>
            ) : (
              <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={() => { void robo.pedirDeNovo(); }} disabled={!!fila.length || !!comRobo.length}
                title="Pedir de novo (mudou algo no Alterdata depois do último pedido)" aria-label="Pedir de novo ao robô"><Icone nome="repeat" /></button>
            )}
          </div>
        </div>
      </div>
      {robo.carregado && n > 0 && (
        <div className="imp-robo-meses">
          {robo.porMes.map(m => (
            <div key={m.mes} className="imp-robo-mes" title={m.pedido?.etapa || m.pedido?.erro || ''}>
              <div className="imp-robo-topo">
                <span>{robo.rotuloDoMes(m.mes)}</span>
                <span className={'badge ' + SELO[m.situacao].classe}>{SELO[m.situacao].rotulo}</span>
              </div>
              {m.situacao === 'robo' && <div className="imp-robo-barra"><span style={{ width: (m.pedido?.pct || 0) + '%' }} /></div>}
            </div>
          ))}
        </div>
      )}
      {atencao.length > 0 && (
        <div className="imp-robo-atencao">
          {atencao.map(a => <span key={a} className="ext-neg"><Icone nome="alert" />{a}</span>)}
          {robo.erroDeAmbiente && <span className="hint">O Contábil do servidor não respondeu; não peço de novo sozinho. Use o botão quando ele voltar.</span>}
        </div>
      )}
    </div>
  );
}
