// O formulário "Arquivar em…" (Admin › Arquivador › Para resolver, 23/10/2026: "selecionar para onde vai também"): o
// cliente (busca por código ou nome no cadastro do arquivador, com a lista de sugestões), o tipo de documento (os tipos que
// as regras conhecem) e a competência (o mês ou o ano, quando o tipo pede); embaixo, a prévia do destino que o robô
// calculou pelas mesmas regras (a pasta e o nome final, a pasta nova do cliente, "já estava arquivado"); Confirmar só com
// a prévia pronta. No lote, a prévia é a do primeiro arquivo (cada um sai pelas regras). No GRUPO (23/10/2026, a migração),
// a competência sai do nome ou das pastas de cada arquivo (ou uma só para todos), a prévia mostra 3 exemplos e "Lembrar"
// faz a decisão valer para os próximos da mesma pasta. Peça do catálogo (Campos).
import { Icone, Interruptor, SeletorMes } from '@nads/ui';
import type { entregas } from '@nads/core';

export interface DadosDoArquivarEm {
  lote: number; nomes: string[]; carregando: boolean; semCadastro: boolean;
  busca: string; setBusca: (t: string) => void; sugeridos: entregas.ClienteDoFormulario[];
  cliente: entregas.ClienteDoFormulario | null; escolher: (c: entregas.ClienteDoFormulario) => void;
  tipos: entregas.TipoDoFormulario[]; tipoDoc: string; setTipoDoc: (t: string) => void;
  precisa: 'mes' | 'ano' | null; mes: string; setMes: (m: string) => void; ano: string; setAno: (a: string) => void; anos: string[];
  previa: { carregando: boolean; erro: string; destino: string; nomeFinal: string; pastaNova: string; jaArquivado: boolean; copias: string[]; exemplos?: entregas.ExemploDaPreviaDoGrupo[] } | null;
  enviando: boolean; podeConfirmar: boolean; confirmar: () => void; fechar: () => void;
  /** o grupo: a competência de cada arquivo (ou uma só) e o "lembrar" */
  grupo?: { deCada: boolean; setDeCada: () => void; lembrar: boolean; setLembrar: () => void; podeEscolherCompetencia: boolean };
}

export function ArquivarEm({ f }: { f: DadosDoArquivarEm }) {
  const ids = { cliente: 'arq-em-cliente', tipo: 'arq-em-tipo', ano: 'arq-em-ano' };
  return (
    <form className="arq-em" onSubmit={e => { e.preventDefault(); if (f.podeConfirmar) f.confirmar(); }}>
      <h4>{f.grupo ? 'Arquivar o grupo (' + f.lote.toLocaleString('pt-BR') + (f.lote === 1 ? ' arquivo' : ' arquivos') + ') em…' : f.lote > 1 ? 'Arquivar ' + f.lote + ' arquivos em…' : 'Arquivar em…'}</h4>
      {f.grupo && <p className="hint">O mesmo cliente e tipo para o grupo inteiro; cada arquivo sai pelas regras, com o ano da pasta dele (G:\Meu Drive\&lt;ano&gt;).</p>}
      {f.lote > 1 && !f.grupo && <p className="hint">{f.nomes.slice(0, 3).join(', ')}{f.nomes.length > 3 ? ' e mais ' + (f.nomes.length - 3) : ''}. A prévia é a do primeiro; cada arquivo sai pelas regras, com o mesmo cliente, tipo e competência.</p>}
      {f.carregando ? <p className="hint">Carregando o cadastro…</p> : f.semCadastro ? <p className="hint">O robô do PC ainda não publicou o cadastro dos clientes (sai na próxima volta dele).</p> : (
        <>
          <div className="field arq-em-cliente">
            <label htmlFor={ids.cliente}>Cliente</label>
            <input id={ids.cliente} type="text" autoComplete="off" placeholder="Código ou nome" value={f.busca} onChange={e => f.setBusca(e.target.value)} />
            {f.sugeridos.length > 0 && (
              <ul className="arq-em-sugestoes" role="listbox" aria-label="Clientes">
                {f.sugeridos.map(c => (
                  <li key={c.codigo}><button type="button" role="option" aria-selected={false} onClick={() => f.escolher(c)}>
                    <b className="num">{c.codigo}</b> {c.nome}{!c.temPasta && <span className="fraco"> · sem pasta no Drive (o robô cria)</span>}
                  </button></li>
                ))}
              </ul>
            )}
          </div>
          <div className="field">
            <label htmlFor={ids.tipo}>Tipo de documento</label>
            <select id={ids.tipo} value={f.tipoDoc} onChange={e => f.setTipoDoc(e.target.value)}>
              <option value="">Escolha o tipo</option>
              {f.tipos.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
            </select>
          </div>
          {f.grupo && f.grupo.podeEscolherCompetencia && (
            <div className="field arq-em-chave">
              <Interruptor ligado={f.grupo.deCada} onMudar={f.grupo.setDeCada} rotulo="Competência pelo nome ou pelas pastas de cada arquivo" />
              <span>Competência pelo nome ou pelas pastas de cada arquivo</span>
            </div>
          )}
          {f.precisa === 'mes' && <div className="field"><label>Competência (mês)</label><SeletorMes rotulo="Competência" valor={f.mes} onMudar={f.setMes} /></div>}
          {f.precisa === 'ano' && (
            <div className="field">
              <label htmlFor={ids.ano}>Ano</label>
              <select id={ids.ano} value={f.ano} onChange={e => f.setAno(e.target.value)}>
                <option value="">Escolha o ano</option>
                {f.anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
          {f.previa && (
            <div className={'arq-em-previa' + (f.previa.erro ? ' erro' : '')} aria-live="polite">
              {f.previa.carregando ? <span className="fraco"><span className="btn-spinner" aria-hidden="true" /> O robô está calculando o destino…</span>
                : f.previa.erro ? <><b>Não dá para arquivar assim.</b> {f.previa.erro}</>
                  : f.previa.exemplos ? (
                    <>
                      <span className="fraco">Os primeiros do grupo vão para</span>
                      <ul className="arq-em-exemplos">
                        {f.previa.exemplos.map(x => (
                          <li key={x.nome}>
                            <span className="fraco">{x.nome}{x.competencia ? ' · ' + x.competencia : ''}</span>
                            {x.erro ? <span className="arq-em-erro">{x.erro}</span> : <b className="arq-em-destino">{x.destino}</b>}
                            {x.pastaNova && <span className="fraco"><Icone nome="pasta" width={14} height={14} /> A pasta {x.pastaNova} será criada.</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <span className="fraco">{f.previa.jaArquivado ? 'O mesmo conteúdo já está em' : 'Vai para'}</span>
                      <b className="arq-em-destino">{f.previa.destino}</b>
                      {f.previa.pastaNova && <span className="fraco"><Icone nome="pasta" width={14} height={14} /> A pasta {f.previa.pastaNova} será criada.</span>}
                      {f.previa.copias.map(c => <span key={c} className="fraco"><Icone nome="copiar" width={14} height={14} /> Cópia em {c}</span>)}
                    </>
                  )}
            </div>
          )}
        </>
      )}
      {f.grupo && (
        <div className="field arq-em-chave">
          <Interruptor ligado={f.grupo.lembrar} onMudar={f.grupo.setLembrar} rotulo="Lembrar para os próximos desta pasta" />
          <span>Lembrar: os próximos que chegarem desta pasta vão sozinhos</span>
        </div>
      )}
      <div className="arq-em-botoes">
        <button type="button" className="btn btn-outline" onClick={f.fechar}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={!f.podeConfirmar}>
          {f.enviando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="checkCircle" width={16} height={16} />}{f.grupo ? 'Arquivar o grupo' : f.lote > 1 ? 'Arquivar os ' + f.lote : 'Arquivar'}
        </button>
      </div>
    </form>
  );
}
