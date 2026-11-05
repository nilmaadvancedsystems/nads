// A sugestão de conta (Vitor, 05/11/2026: "de acordo com as normas contábeis, ou do escritório, qual conta vai e o porquê"): só a
// lâmpada; abre a conta do plano da empresa (com o + de cada uma: a à vista e a a prazo), ou o Não vai, ou o que falta criar, o
// porquê e a base. Nas Naturezas e nos Serviços (Tomados e Prestados).
import type { conferencia as c } from '@nads/core';
import { Icone, MenuSuspenso } from '@nads/ui';

export function Sugestao({ sug, oQuePede, vincular, naoContabil }: {
  sug: c.SugestaoDaNatureza;
  /** "A natureza pede" / "A categoria pede" */
  oQuePede: string;
  vincular: (codigo: string) => void;
  naoContabil?: () => void;
}) {
  const linha = sug.tipo === 'nao-contabil' ? 'Não vai para o Contábil' : 'Falta a conta: ' + sug.pede;
  return (
    // flutuante: perto do fim da tela, abre para cima (Vitor, 05/11/2026: "não consigo scrollar e clicar" na última natureza)
    <MenuSuspenso rotulo="" icone="lampada" className="icon-btn" semSeta flutuante largura={380} dica="Sugestão: qual conta vai e por quê"
      conteudo={fechar => (
        <div className="comp-varios">
          {/* cada conta com o seu + (Vitor, 05/11/2026: "ao invés de um botão usar contas, coloca só um +") */}
          {sug.tipo === 'conta' && sug.contas?.length ? sug.contas.map(x => (
            <div key={x.codigo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <p className="comp-varios-texto" style={{ margin: 0 }}><b>{x.codigo} — {x.nome}</b></p>
              <button type="button" className="icon-btn icon-btn-sm" title={'Vincular ' + x.codigo + ' — ' + x.nome} aria-label={'Vincular ' + x.codigo}
                onClick={() => { fechar(); vincular(x.codigo); }}><Icone nome="plus" /></button>
            </div>
          )) : <p className="comp-varios-texto" style={{ margin: 0 }}><b>{linha}</b></p>}
          {sug.tipo === 'conta' && <p className="hint">{oQuePede}: {sug.pede}.</p>}
          <p className="hint">{sug.motivo}</p>
          <p className="hint">Base: {sug.base}</p>
          {sug.tipo === 'nao-contabil' && naoContabil && (
            <button type="button" className="btn btn-primary comp-varios-botao" onClick={() => { fechar(); naoContabil(); }}>Marcar Não vai para o Contábil</button>
          )}
        </div>
      )} />
  );
}
