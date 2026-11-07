// O bloco "Razões do Alterdata" da Importação (Vitor, 06/11/2026: "puxar automaticamente usando essa automação"): os meses
// do período, cada um na fila do robô do servidor; o que ele está fazendo; o mês que deu erro em vermelho, com o botão para
// pedir de novo. No desenho das outras linhas da Importação (imp-bloco), em duas linhas de texto, sem animação.
import { Icone } from '@nads/ui';
import type { RazaoDoRobo } from './useRazaoDoRobo';

export function BlocoDoRobo({ robo }: { robo: RazaoDoRobo }) {
  if (!robo.disponivel) return null;
  const n = robo.porMes.length;
  const conta = (s: string) => robo.porMes.filter(m => m.situacao === s);
  const fila = conta('fila'), comRobo = conta('robo'), erros = conta('erro'), faltam = conta('falta');
  const tudoPronto = robo.prontos.length === n;
  const meses = (l: typeof robo.porMes) => l.map(m => robo.rotuloDoMes(m.mes)).join(', ');
  const partes = [
    robo.prontos.length + ' de ' + n + (n === 1 ? ' mês pronto' : ' meses prontos'),
    comRobo.length ? 'o robô está em ' + meses(comRobo) + ' (' + robo.pct + '%)' : '',
    fila.length ? fila.length + ' na fila' : '',
    faltam.length ? 'sem pedido: ' + meses(faltam) : '',
  ].filter(Boolean);
  return (
    <div className={'imp-bloco' + (tudoPronto && !robo.lendo ? ' imp-ok' : '')}>
      <div className="imp-linha">
        <span className="imp-ico"><Icone nome="robo" /></span>
        <div className="imp-txt">
          <span><b>Razões do Alterdata</b><span className="imp-conta">o robô do servidor gera o razão de todas as contas, mês a mês</span></span>
        </div>
        <div className="imp-resumo">
          <div>
            {robo.falha
              ? <span className="ext-neg">Não consegui ver os pedidos: {robo.falha}</span>
              : robo.carregado && <span>{partes.join(' · ')}</span>}
            {robo.lendo && <span>Lendo os lançamentos que o robô subiu</span>}
            {robo.espera && <span className="ext-neg">{robo.espera}</span>}
            {!robo.lendo && robo.agora && <span className="hint">{robo.agora}</span>}
            {erros.map(m => (
              <span key={m.mes} className="ext-neg" title={m.pedido?.erro || ''}>{robo.rotuloDoMes(m.mes)}: {m.pedido?.erro || 'o robô não conseguiu'}</span>
            ))}
            {robo.erroDeAmbiente && <span className="hint">O Contábil do servidor não respondeu; não peço de novo sozinho. Use o botão quando ele voltar.</span>}
          </div>
        </div>
        <div className="imp-grupos">
          <div className="imp-grupo" aria-label="Razões do Alterdata">
            <span className="imp-rotulo">Robô</span>
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
    </div>
  );
}
