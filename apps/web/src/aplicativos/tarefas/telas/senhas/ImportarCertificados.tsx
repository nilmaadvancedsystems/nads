// A janela "Importar certificados" (07/10/2026: "já puxe e salve na empresa correta"): solta vários .pfx; cada um vira
// um cartão com a empresa achada pelo CNPJ (ou escolher), a senha e, lido, a validade e o titular. Guardar põe todos
// os lidos nas empresas deles.
import { BotaoAcao, Icone, MenuSuspenso } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { Senha } from './SegredosDaEmpresa';
import type { VmCofre } from './useCofre';
import { useImportarCertificados, type EmpresaDoCertificado } from './useImportarCertificados';

const data = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const cnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

function EscolherEmpresa({ lista, achada, onEscolher }: { lista: readonly EmpresaDoCertificado[]; achada: boolean; onEscolher: (e: EmpresaDoCertificado) => void }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const achadas = lista.filter(e => !t || e.nome.toLowerCase().includes(t) || String(e.codigo ?? '').includes(t)).slice(0, 40);
  return (
    <MenuSuspenso rotulo={achada ? 'Trocar empresa' : 'Escolher empresa'} icone="briefcase" className="btn btn-outline" largura={360} conteudo={fechar => (
      <div className="imp-cert-busca">
        <input type="text" className="pessoal-select" autoFocus placeholder="Nome ou código" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar empresa" />
        {achadas.map(e => (
          <button key={(e.codigo ?? '') + e.nome} type="button" className="popover-item" onClick={() => { onEscolher(e); fechar(); }}>
            <span className="num fraco">{e.codigo ?? ''}</span><span className="popover-texto">{e.nome}</span>
          </button>
        ))}
      </div>
    )} />
  );
}

export function ImportarCertificados({ cofre, fechar }: { cofre: VmCofre; fechar: () => void }) {
  const vm = useImportarCertificados(cofre);
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const soltar = (fs: FileList | null | undefined) => { if (fs?.length) void vm.adicionar([...fs]); };
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela troca-janela imp-cert" role="dialog" aria-modal="true" aria-label="Importar certificados">
        <header className="pessoal-topo">
          <h2>Importar certificados</h2>
          <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
        </header>
        <div className="imp-cert-corpo">
          <input ref={input} type="file" accept=".pfx,.p12" multiple hidden onChange={e => { soltar(e.target.files); e.target.value = ''; }} />
          <button type="button" className={'cert-soltar' + (sobre ? ' sobre' : '') + (vm.fila.length ? ' compacto' : '')} onClick={() => input.current?.click()}
            onDragOver={e => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
            onDrop={e => { e.preventDefault(); setSobre(false); soltar(e.dataTransfer.files); }}>
            <span className="cert-soltar-icone"><Icone nome="upload" /></span>
            <b>{vm.fila.length ? 'Soltar mais certificados' : 'Solte os certificados aqui'}</b>
            <span className="fraco">um ou vários .pfx — a empresa vem pelo CNPJ</span>
          </button>
          <ul className="imp-cert-lista">
            {vm.fila.map(x => (
              <li key={x.id} className={'cert-cartao imp-cert-item' + (x.validade && !x.erro ? ' lido' : '')}>
                <span className="cert-cartao-chip" aria-hidden="true"><Icone nome={x.validade && !x.erro ? 'check' : 'lock'} /></span>
                <div className="cert-cartao-corpo">
                  <span className="cert-cartao-tipo">{x.nomeArquivo}</span>
                  {x.empresa ? <b className="cert-cartao-nome">{x.empresa.codigo != null && <span className="num fraco">{x.empresa.codigo} · </span>}{x.empresa.nome}</b>
                    : <span className="cert-erro"><Icone nome="alert" />Empresa não achada{x.cnpj ? ' pelo CNPJ ' + cnpj(x.cnpj) : ''}</span>}
                  <span className="cert-cartao-doc num">{x.titular ? x.titular.replace(':', ' · ') : x.cnpj ? cnpj(x.cnpj) : ''}</span>
                  <span className="imp-cert-acoes">
                    <EscolherEmpresa lista={vm.empresas} achada={!!x.empresa} onEscolher={e => vm.escolherEmpresa(x.id, e)} />
                    <button type="button" className="btn btn-ghost" onClick={() => vm.tirar(x.id)}>Tirar</button>
                  </span>
                </div>
                <div className="imp-cert-senha">
                  <Senha valor={x.senha} onMudar={v => vm.senha(x.id, v)} rotulo={'Senha de ' + x.nomeArquivo} />
                  {x.lendo ? <span className="fraco">Lendo…</span>
                    : x.erro ? <span className="cert-erro"><Icone nome="alert" />{x.erro}</span>
                      : x.validade ? <span className="badge badge-ok">Até {data(x.validade)}</span>
                        : <span className="fraco">Digite a senha</span>}
                </div>
                {x.lendo && <span className="cert-cartao-brilho" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </div>
        <footer className="usuario-pe troca-pe">
          <span className="hint">{vm.fila.length ? vm.prontos + ' de ' + vm.fila.length + ' prontos' : ''}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
          <BotaoAcao carregando={vm.guardando} textoCarregando="Guardando…" disabled={!vm.prontos} onClick={() => void vm.guardar()}><Icone nome="check" />Guardar {vm.prontos || ''}</BotaoAcao>
        </footer>
      </div>
    </div>
  );
}
