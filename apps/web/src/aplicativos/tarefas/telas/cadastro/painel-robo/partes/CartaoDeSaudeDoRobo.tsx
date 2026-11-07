// O cartão de saúde de um robô (Saúde dos robôs, 07/11/2026): o nome na faixa do topo com o selo do estado (Ok verde, Atenção
// amarelo, Parado vermelho), os dados em linhas (onde roda, o último batimento, o último trabalho, a fila), o que está
// fazendo agora, o motivo de não estar ok e os últimos erros. Feito das peças do catálogo: card + card-head, selo suave,
// ent-dados, a linha do "Agora" do robô e a linha do tempo (ent-linhas).
import type { entregas } from '@nads/core';
import { Icone } from '@nads/ui';

const SELO: Record<entregas.TomDoPainel, string> = { ok: 'badge-ok', aviso: 'badge-warn', erro: 'badge-bad', neutro: 'badge-neutral' };
const num = (n: number) => n.toLocaleString('pt-BR');

function textoDaFila(f: entregas.FilaDoCartao): string {
  if (f.erro) return 'não consegui contar';
  if (!f.esperando && !f.andamento) return 'nada pendente';
  const partes = [];
  if (f.esperando) partes.push(num(f.esperando) + ' esperando' + (f.maisAntigo ? ' (o mais antigo ' + f.maisAntigo + ')' : ''));
  if (f.andamento) partes.push(num(f.andamento) + ' em andamento');
  return partes.join(' · ');
}

export function CartaoDeSaudeDoRobo({ c }: { c: entregas.CartaoDaSaude }) {
  return (
    <div className={'card robo-cartao robo-cartao-' + c.tom}>
      <div className="card-head">
        <h3 className="robo-cartao-nome">
          <span className="cad-faixa-icone" aria-hidden="true"><Icone nome={c.id === 'backup' ? 'escudo' : c.onde.startsWith('Nuvem') ? 'robo' : 'monitor'} width={16} height={16} /></span>
          {c.nome}
        </h3>
        <span className="card-head-ctl"><span className={'badge badge-suave ' + SELO[c.tom]}>{c.rotulo}</span></span>
      </div>
      <dl className="ent-dados">
        <div><dt>Onde roda</dt><dd>{c.onde}</dd></div>
        <div><dt>Último batimento</dt><dd>{c.batimento}</dd></div>
        <div><dt>Último trabalho</dt><dd>{c.ultimoTrabalho ? c.ultimoTrabalho.texto + ' · ' + c.ultimoTrabalho.quando : <span className="fraco">nenhum nos registros</span>}</dd></div>
        {c.fila && <div><dt>Fila</dt><dd>{textoDaFila(c.fila)}</dd></div>}
        {c.nota && <div><dt>Hoje</dt><dd>{c.nota}</dd></div>}
      </dl>
      {c.fazendo.length > 0 && (
        <div className="robo-cartao-agora">
          {c.fazendo.map(t => <p key={t} className="ag-conversa-linha"><b>Agora:</b> {t}</p>)}
        </div>
      )}
      {c.motivos.length > 0 && (
        <div className="robo-cartao-modulos">
          {c.motivos.map(m => <span key={m} className={'badge badge-suave ' + (c.tom === 'erro' ? 'badge-bad' : 'badge-warn')}>{m}</span>)}
        </div>
      )}
      {c.erros.length > 0 && (
        <div className="robo-cartao-agora">
          <p className="ag-conversa-linha"><b>Últimos erros (24 h)</b></p>
          <ul className="ent-linhas robo-linhas">
            {c.erros.map(e => (
              <li key={e.id} className="robo-linha-erro">
                <div className="robo-linha-texto"><b>{e.texto}</b>{e.detalhe && <span className="fraco">{e.detalhe}</span>}</div>
                <span className="fraco robo-quando">{e.quando}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
