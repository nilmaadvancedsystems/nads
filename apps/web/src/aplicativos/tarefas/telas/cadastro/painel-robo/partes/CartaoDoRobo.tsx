// O cartão de um robô no Painel do robô (21/10/2026): o nome na faixa do topo com o selo da situação (Ligado, Atrasado,
// Desligado), os dados em linhas (onde roda, a máquina, o último sinal, desde quando está ligado, a versão do código), o que
// está fazendo agora ("Ocioso" quando nada) e os módulos que não ligaram, com o motivo. Feito das peças do catálogo: card +
// card-head, selo suave, ent-dados e a linha do "Agora" das conversas do Claude (ag-conversa-linha).
import type { entregas } from '@nads/core';
import { Icone } from '@nads/ui';

const SELO: Record<entregas.TomDoPainel, string> = { ok: 'badge-ok', aviso: 'badge-warn', erro: 'badge-bad', neutro: 'badge-neutral' };

export function CartaoDoRobo({ s }: { s: entregas.SituacaoDoRobo }) {
  return (
    <div className={'card robo-cartao robo-cartao-' + s.tom}>
      <div className="card-head">
        <h3 className="robo-cartao-nome">
          <span className="cad-faixa-icone" aria-hidden="true"><Icone nome={s.robo === 'pc' ? 'monitor' : 'robo'} width={16} height={16} /></span>
          {s.nome}
        </h3>
        <span className="card-head-ctl"><span className={'badge badge-suave ' + SELO[s.tom]}>{s.rotulo}</span></span>
      </div>
      <dl className="ent-dados">
        <div><dt>Onde roda</dt><dd>{s.onde}{s.maquina ? ' · ' + s.maquina : ''}</dd></div>
        <div><dt>Último sinal</dt><dd>{s.sinal}</dd></div>
        {s.ligadoDesde && <div><dt>Ligado desde</dt><dd>{s.ligadoDesde}</dd></div>}
        {s.versao && <div><dt>Versão</dt><dd>{s.versao}</dd></div>}
        {s.ligados + s.desligados.length > 0 && (
          <div><dt>Módulos</dt><dd>{s.ligados} {s.ligados === 1 ? 'ligado' : 'ligados'}{s.desligados.length ? ' · ' + s.desligados.length + ' sem ligar' : ''}</dd></div>
        )}
      </dl>
      <div className="robo-cartao-agora">
        {s.tom === 'erro' || s.tom === 'neutro' ? null : s.agora.length
          ? s.agora.map(a => <p key={a.texto} className="ag-conversa-linha"><b>Agora:</b> {a.texto}{a.ha && <span className="fraco"> · {a.ha}</span>}</p>)
          : <p className="ag-conversa-linha"><b>Agora:</b> ocioso, esperando pedido</p>}
      </div>
      {s.desligados.length > 0 && (
        <div className="robo-cartao-modulos">
          {s.desligados.map(m => <span key={m.id} className="badge badge-suave badge-warn" title={m.motivo || undefined}>{m.nome}{m.motivo ? ': ' + m.motivo : ' não ligou'}</span>)}
        </div>
      )}
      {s.aviso && <p className="hint">{s.aviso}</p>}
    </div>
  );
}
