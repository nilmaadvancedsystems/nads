// A planilha aberta no navegador, sem baixar (Vitor, 09/11/2026: "quero um visualizador de planilhas online"): só para ver,
// com a cara do Excel (a letra das colunas e o número das linhas fixos ao rolar, as abas embaixo). A leitura é do core
// (lerPlanilhaNoNavegador); aqui só se desenha.
import type { entregas as e } from '@nads/core';
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { memo, useRef, useState, type CSSProperties } from 'react';

const LARGURA_DO_NUMERO = 44;

function estiloDe(c: e.CelulaDaPlanilha): CSSProperties {
  const s = c.estilo;
  const horizontal = s?.horizontal ?? (c.numero ? 'right' : undefined);
  const b = s?.bordas;
  return {
    ...(s?.negrito ? { fontWeight: 700 } : {}),
    ...(s?.italico ? { fontStyle: 'italic' } : {}),
    ...(s?.sublinhado || s?.riscado ? { textDecoration: [s.sublinhado && 'underline', s.riscado && 'line-through'].filter(Boolean).join(' ') } : {}),
    // o tamanho do Excel é em pontos
    ...(s?.tamanho ? { fontSize: s.tamanho + 'pt' } : {}),
    ...(s?.cor ? { color: s.cor } : {}),
    ...(s?.fundo ? { background: s.fundo } : {}),
    ...(horizontal ? { textAlign: horizontal } : {}),
    ...(s?.vertical ? { verticalAlign: s.vertical } : {}),
    ...(s?.recuo ? { paddingLeft: 3 + s.recuo * 9 } : {}),
    ...(b?.top ? { borderTop: b.top } : {}),
    ...(b?.right ? { borderRight: b.right } : {}),
    ...(b?.bottom ? { borderBottom: b.bottom } : {}),
    ...(b?.left ? { borderLeft: b.left } : {}),
  };
}

const Folha = memo(function Folha({ aba }: { aba: e.AbaDaPlanilha }) {
  const largura = LARGURA_DO_NUMERO + aba.colunas.reduce((t, c) => t + c.largura, 0);
  return (
    <table className="planilha-tabela" style={{ width: largura }}>
      <colgroup>
        <col style={{ width: LARGURA_DO_NUMERO }} />
        {aba.colunas.map(c => <col key={c.letra} style={{ width: c.largura }} />)}
      </colgroup>
      <thead>
        <tr><th aria-label="Linha" />{aba.colunas.map(c => <th key={c.letra} scope="col">{c.letra}</th>)}</tr>
      </thead>
      <tbody>
        {aba.linhas.map(l => (
          <tr key={l.numero} style={{ height: l.altura }}>
            <th scope="row">{l.numero}</th>
            {l.celulas.map(c => (
              <td key={c.coluna} className={c.estilo?.quebra ? 'quebra' : undefined} colSpan={c.colunas > 1 ? c.colunas : undefined} rowSpan={c.linhas > 1 ? c.linhas : undefined} style={estiloDe(c)}>{c.texto}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export function VisualizadorDePlanilha({ nome, planilha, baixar, fechar }: { nome: string; planilha: e.PlanilhaNoNavegador; baixar: () => void; fechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar, true);
  const [ativa, setAtiva] = useState(0);
  const aba = planilha.abas[ativa];
  const cortada = aba.totalDeLinhas > aba.linhas[aba.linhas.length - 1]?.numero;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal planilha-janela" role="dialog" aria-modal="true" aria-labelledby="planilhaTitulo">
        <div className="planilha-topo">
          <h3 id="planilhaTitulo" title={nome}>{nome}</h3>
          <button type="button" className="btn btn-outline" onClick={baixar}><Icone nome="download" width={16} height={16} />Baixar</button>
          <BotaoFechar onClick={fechar} />
        </div>
        {cortada && <p className="hint planilha-aviso" role="status">Mostrando as primeiras {aba.linhas[aba.linhas.length - 1].numero.toLocaleString('pt-BR')} de {aba.totalDeLinhas.toLocaleString('pt-BR')} linhas. Para ver tudo, baixe o arquivo.</p>}
        {/* key: ao trocar de aba, a rolagem volta para o começo */}
        <div key={ativa} className="planilha-folha" tabIndex={0}><Folha aba={aba} /></div>
        {planilha.abas.length > 1 && (
          <div className="planilha-abas" role="tablist" aria-label="Abas da planilha">
            {planilha.abas.map((a, i) => (
              <button key={a.nome} type="button" role="tab" aria-selected={i === ativa} className="btn btn-ghost btn-sm" onClick={() => setAtiva(i)}>{a.nome}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
