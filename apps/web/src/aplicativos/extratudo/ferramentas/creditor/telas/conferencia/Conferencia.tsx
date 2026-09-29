// Etapa 3 do Creditor (só quando o relatório traz total impresso): conferência de cada grupo contra o total impresso no relatório.
import { creditor as cr } from '@nads/core';
import { Alerta, BotaoIcone, Icone } from '@nads/ui';
import { Celula } from './partes/Celula';
import { useConferencia, type CampoValor } from './useConferencia';

const BADGE: Record<cr.SituacaoGrupo, [string, string]> = {
  ok: ['badge badge-ok', 'Bate'], diverge: ['badge badge-bad', 'Não bate'], 'sem-total': ['badge badge-warn', 'Falta o total impresso'],
};

function Comparacao({ colunas, registros, rotulos, onImpresso }: { colunas: cr.ConferenciaColuna[]; registros: { impresso: number | null; lidos: number }; rotulos: Record<string, string>; onImpresso: (c: CampoValor, v: string) => void }) {
  const regOk = registros.impresso == null || registros.impresso === registros.lidos;
  return (
    <table className="tabela-conferencia">
      <thead><tr><th /><th className="num">Soma extraída</th><th className="num">Total impresso</th><th className="num">Diferença</th></tr></thead>
      <tbody>
        {colunas.filter(c => c.impresso != null || c.soma !== 0).map(c => {
          const bate = c.diferenca == null ? null : cr.igual(c.diferenca, 0);
          return (
            <tr key={c.coluna} className={bate === false ? 'bad' : ''}>
              <td>{rotulos[c.coluna]}</td>
              <td className="num">{cr.brl(c.soma)}</td>
              <td className="num"><Celula numero valor={c.impresso} rotulo={'Total impresso de ' + rotulos[c.coluna]} placeholder="do papel" onGravar={v => onImpresso(c.coluna, v)} /></td>
              <td className="num">{c.diferenca == null ? '—' : bate ? <span className="badge badge-ok">0,00</span> : <b>{cr.brl(c.diferenca)}</b>}</td>
            </tr>
          );
        })}
        <tr className={regOk ? '' : 'bad'}>
          <td>Registros</td>
          <td className="num">{registros.lidos}</td>
          <td className="num">{registros.impresso ?? '—'}</td>
          <td className="num">{registros.impresso == null ? '—' : regOk ? <span className="badge badge-ok">0</span> : <b>{registros.lidos - registros.impresso}</b>}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function Conferencia() {
  const vm = useConferencia();
  return (
    <section>
      <p className="page-desc" style={{ marginTop: 0, marginBottom: 16 }}>
        Cada grupo só passa quando a soma do que foi lido bate com o total impresso no relatório. Se não bater, confira as linhas contra o papel e corrija aqui mesmo: a linha em vermelho não fecha (cobrado ≠ valor + mora + outros − desconto). A quantidade de registros também tem que bater.
      </p>

      {vm.grupos.map(g => (
        <div key={g.id} className="card">
          <div className="card-head">
            <h3>{g.rotulo}</h3>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={BADGE[g.situacao][0]}>{BADGE[g.situacao][1]}</span>
              {vm.grupos.length > 1 && <BotaoIcone icone="x" titulo="Remover o grupo" pequeno onClick={() => vm.removerGrupo(g.id)} />}
            </span>
          </div>
          <div className="table-wrap">
            <table className="tabela-edicao">
              <thead>
                <tr><th>Sacado</th><th>Nosso nº</th><th>NF</th><th className="num">Valor (R$)</th><th className="num">Mora</th><th className="num">Desc.</th><th className="num">Outros</th><th>Liquidação</th><th className="num">Cobrado</th><th /></tr>
              </thead>
              <tbody>
                {g.titulos.map(t => (
                  <tr key={t.id} className={t.incoerente ? 'bad' : ''} title={t.incoerente ? 'Cobrado ≠ valor + mora + outros − desconto' : t.aviso}>
                    <td><Celula valor={t.sacado} largura={180} rotulo="Sacado" onGravar={v => vm.editarTexto(g.id, t.id, 'sacado', v)} /></td>
                    <td><Celula valor={t.nossoNumero} largura={110} rotulo="Nosso número" onGravar={v => vm.editarTexto(g.id, t.id, 'nossoNumero', v)} /></td>
                    <td><Celula valor={t.nf} largura={70} rotulo="NF" onGravar={v => vm.editarTexto(g.id, t.id, 'nf', v)} /></td>
                    <td className="num"><Celula numero valor={t.valor} largura={90} rotulo="Valor" onGravar={v => vm.editarValor(g.id, t.id, 'valor', v)} /></td>
                    <td className="num"><Celula numero valor={t.mora} largura={70} rotulo="Mora" onGravar={v => vm.editarValor(g.id, t.id, 'mora', v)} /></td>
                    <td className="num"><Celula numero valor={t.desconto} largura={70} rotulo="Desconto" onGravar={v => vm.editarValor(g.id, t.id, 'desconto', v)} /></td>
                    <td className="num"><Celula numero valor={t.outros} largura={70} rotulo="Outros acréscimos" onGravar={v => vm.editarValor(g.id, t.id, 'outros', v)} /></td>
                    <td><Celula valor={t.liquidacao} largura={96} rotulo="Data de liquidação" placeholder="dd/mm/aaaa" onGravar={v => vm.editarTexto(g.id, t.id, 'liquidacao', v)} /></td>
                    <td className="num"><Celula numero valor={t.cobrado} largura={90} rotulo="Cobrado" onGravar={v => vm.editarValor(g.id, t.id, 'cobrado', v)} /></td>
                    <td>{t.aviso && !t.incoerente ? <span title={t.aviso}><Icone nome="alert" /></span> : <BotaoIcone icone="x" titulo="Remover o título" pequeno onClick={() => vm.removerTitulo(g.id, t.id)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => vm.adicionarTitulo(g.id)}><Icone nome="plus" />Adicionar título</button>
          </div>
          <Comparacao colunas={g.colunas} registros={g.registros} rotulos={vm.rotuloColuna} onImpresso={(c, v) => vm.editarImpresso(g.id, c, v)} />
        </div>
      ))}

      <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn-outline btn-sm" type="button" onClick={vm.novoGrupo}><Icone nome="plus" />Novo grupo</button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Total de Valores Liquidados</h3>
          {vm.geral.tem ? <span className={vm.geral.ok ? 'badge badge-ok' : 'badge badge-bad'}>{vm.geral.ok ? 'Bate' : 'Não bate'}</span> : <span className="badge badge-neutral">Opcional</span>}
        </div>
        <Comparacao colunas={vm.geral.colunas} registros={vm.geral.registros} rotulos={vm.rotuloColuna} onImpresso={vm.editarTotalGeral} />
      </div>

      {(vm.problemas.length > 0 || vm.geralDiverge) && (
        <Alerta titulo="Ainda não dá para seguir">
          {vm.problemas.map(p => <p key={p} className="alert-text">{p}</p>)}
          {vm.geralDiverge && <p className="alert-text">Total de Valores Liquidados: não bate com a soma dos grupos</p>}
        </Alerta>
      )}

      <div className="btn-row">
        <button className="btn btn-ghost" type="button" onClick={vm.voltar}>← Voltar</button>
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={vm.continuar}>Continuar para o fiscal</button>
      </div>
    </section>
  );
}
