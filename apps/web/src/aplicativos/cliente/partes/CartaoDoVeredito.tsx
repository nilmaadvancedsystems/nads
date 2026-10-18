// O veredito no topo da Visão geral da Área do Cliente ("melhora mais" de 17/10/2026, no padrão dos portais de cliente das
// contabilidades: primeiro a situação, depois o que fazer). A frase da situação ("Tudo em dia", "O DAS venceu em 12/10",
// "Você tem 3 pendências") com o ícone no círculo suave da cor do significado (verde, amarelo ou vermelho), a sobrelinha
// com o mês e a hora da última atualização, e:
//   - uma pendência só: a ação dela ao lado da frase (o botão carmim);
//   - duas ou mais: embaixo do fio, "O que precisamos de você", uma linha por pendência com UMA ação (a primeira em carmim);
//   - nenhuma: só a frase, sem botão.
// Peça do catálogo (Cartões).
import { Icone, type NomeIcone } from '@nads/ui';

export type TomDoVeredito = 'ok' | 'warn' | 'bad';

export interface ItemPendente {
  id: string;
  tom: TomDoVeredito;
  icone: NomeIcone;
  titulo: string;
  texto: string;
  /** o rótulo do botão */
  rotulo: string;
  onAcao: () => void;
  ocupado?: boolean;
}

const ICONE_DO_TOM: Record<TomDoVeredito, NomeIcone> = { ok: 'checkCircle', warn: 'clock', bad: 'alert' };

export function CartaoDoVeredito({ sobre, tom, titulo, texto, itens }: {
  /** a sobrelinha: o mês e quando o escritório atualizou */ sobre: string; tom: TomDoVeredito; titulo: string; texto: string; itens: ItemPendente[];
}) {
  const so = itens.length === 1 ? itens[0] : null;
  return (
    <section className={'card cli-veredito cli-tom-' + tom} aria-labelledby="cli-veredito-titulo">
      <div className="cli-veredito-topo">
        <span className="cli-veredito-ico" aria-hidden="true"><Icone nome={ICONE_DO_TOM[tom]} width={22} height={22} /></span>
        <div className="cli-veredito-txt">
          <p className="cli-sobre">{sobre}</p>
          <h1 className="page-title" id="cli-veredito-titulo">{titulo}</h1>
          {texto && <p className="page-desc">{texto}</p>}
        </div>
        {so && <button type="button" className="btn btn-primary" disabled={so.ocupado} onClick={so.onAcao}>{so.rotulo}</button>}
      </div>
      {itens.length > 1 && (
        <div className="cli-pendencias">
          <p className="cli-grupo">O que precisamos de você</p>
          <ul className="cli-lista">
            {itens.map((p, i) => (
              <li key={p.id} className="cli-linha cli-pendencia">
                <span className={'cli-aviso-ico cli-tom-' + p.tom} aria-hidden="true"><Icone nome={p.icone} width={16} height={16} /></span>
                <div className="cli-g-txt"><b>{p.titulo}</b>{p.texto && <span className="hint cli-quebra">{p.texto}</span>}</div>
                <button type="button" className={'btn' + (i === 0 ? ' btn-primary' : '')} disabled={p.ocupado} onClick={p.onAcao}>{p.rotulo}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
