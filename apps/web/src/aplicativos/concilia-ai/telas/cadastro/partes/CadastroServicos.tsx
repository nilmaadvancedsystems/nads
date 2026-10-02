// Cadastro › Configurações › Tomados / Prestados: categorias do escritório, a conta de cada uma
// e os fornecedores colocados nelas.
// Origem: conferencia.html #cadCardServ (~L1170-1173), renderCadServ (~L4486-4521),
// servFormHtml (~L4476), servListaForn (~L4546), cliques/teclas (~L4575-4615).
import { Icone } from '@nads/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import type { CategoriaView, FormServ, useConfiguracoes } from '../useConfiguracoes';
import { CampoVincular, ChipsDeContas } from './VincularConta';

type Servicos = NonNullable<ReturnType<typeof useConfiguracoes>['servicos']>;

export function CadastroServicos({ sv }: { sv: Servicos }) {
  return (
    <div className="card" id="cadCardServ">
      <h3 id="cadServTitulo">{sv.titulo}</h3>
      <div id="cadServBox">
        {sv.vazio ? <p className="empty">{sv.vazio}</p> : (
          <div className="ndp-list">
            {sv.categorias.map(cat => <Categoria key={cat.id} cat={cat} geral={sv.tituloGeral || ''} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// cada categoria: linha "Conta" e (nas específicas) linha "Fornecedores", rótulos alinhados à esquerda
function Bloco({ rot, children }: { rot: string; children: ReactNode }) {
  return <div className="serv-bloco"><span className="serv-rot">{rot}</span><div className="serv-bloco-corpo">{children}</div></div>;
}

function Categoria({ cat, geral }: { cat: CategoriaView; geral: string }) {
  const f = cat.fornecedores;
  return (
    <div className="ndp-item serv-cat">
      <div className="ndp-natureza">
        {cat.nome}<span className="badge badge-neutral">Lançamento {cat.lanc}</span>
        {cat.travado && <span className="serv-cadeado" title="Permanente — não muda" aria-label="Permanente"><Icone nome="lock" /></span>}
        {cat.dica && <span className="ndp-sub">{cat.dica}</span>}
      </div>
      <Bloco rot="Conta">
        <div className="ndp-contas-row">
          <ChipsDeContas v={cat.vinculo} />
          {!cat.vinculo.chips.length && <CampoVincular v={cat.vinculo} rotulo="Vincular conta" titulo="Vincular uma conta" />}
        </div>
      </Bloco>
      {f && (
        <Bloco rot="Fornecedores">
          <div className="serv-forn-lista">
            {f.itens.map(p => (
              <div key={p.nome} className="serv-forn-item">
                <span className="serv-forn-nome" title={p.nome}>{p.nome}</span>
                <span className="serv-forn-qtd">{p.qtd}</span>
                <button type="button" className="serv-forn-rm" title={'Tirar da categoria (volta pra ' + geral + ')'} aria-label={'Tirar ' + p.nome + ' da categoria'} onClick={p.tirar}><Icone nome="x" /></button>
              </div>
            ))}
            <FormFornecedor fm={f.form} />
          </div>
          {f.sugestoes.length > 0 && (
            <div className="serv-sug">
              <Icone nome="alert" /><span>Lançados com {cat.lanc} nas notas, mas fora da categoria:</span>
              {f.sugestoes.map(sg => <button key={sg.nome} type="button" className="btn" onClick={sg.colocar}><Icone nome="plus" />{sg.nome}</button>)}
            </div>
          )}
        </Bloco>
      )}
    </div>
  );
}

// "Adicionar fornecedor": só o fornecedor — a conta é a da categoria, cadastrada uma vez lá em cima
function FormFornecedor({ fm }: { fm: FormServ }) {
  const caixa = useRef<HTMLDivElement>(null);
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!fm.focarOk) return;
    caixa.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ok.current?.focus();
  }, [fm.focarOk]);
  return (
    <div className="serv-add" ref={caixa}>
      <button type="button" className="btn serv-add-btn" hidden={fm.aberto} onClick={fm.abrir}><Icone nome="plus" />Adicionar fornecedor</button>
      <div className="serv-add-form" hidden={!fm.aberto}>
        <div className="serv-add-campo">
          {fm.aberto && (
            <input type="text" className="serv-forn-input" placeholder="Fornecedor" autoComplete="off" aria-label="Fornecedor" autoFocus={!fm.escolhido}
              value={fm.texto} onChange={ev => fm.digitar(ev.target.value)} onFocus={fm.focar} onBlur={fm.sair}
              onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); fm.enter(); } }} />
          )}
          <div className="table-wrap serv-lista serv-forn-lista" hidden={!fm.lista}>
            {fm.lista && (
              <div className="emp-list">
                {fm.lista.itens.map(p => (
                  <button key={p.nome} type="button" className="emp-item" onClick={() => fm.escolher(p.nome)}>
                    <span className="emp-txt"><span className="emp-nome">{p.nome}</span><span className="emp-reg">{p.sub}</span></span>
                  </button>
                ))}
                {fm.lista.adicionar && (
                  <button type="button" className="emp-item" onClick={() => fm.escolher(fm.lista?.adicionar || '')}>
                    <span className="emp-txt"><span className="emp-nome">Adicionar "{fm.lista.adicionar}"</span><span className="emp-reg">ainda sem notas importadas</span></span>
                  </button>
                )}
                {fm.lista.vazio && <p className="empty" style={{ padding: '10px 12px' }}>Nenhum fornecedor fora desta categoria nas notas — digite o nome.</p>}
              </div>
            )}
          </div>
        </div>
        <button ref={ok} type="button" className="btn btn-primary" disabled={!fm.escolhido} onClick={fm.confirmar}>Adicionar</button>
        <button type="button" className="btn" onClick={fm.cancelar}>Cancelar</button>
      </div>
    </div>
  );
}
