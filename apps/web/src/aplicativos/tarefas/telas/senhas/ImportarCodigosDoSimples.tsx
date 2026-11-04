// A janela "Importar códigos do Simples" (03/11/2026: "pegue e coloque o codigo de acesso do simples no cadastro, nos
// docx está nomeado como codigo de acesso"): solta os relatórios do Fiscal em Word; cada empresa vira uma linha com a
// empresa do nads (pelo CNPJ, ou escolher), o código de acesso escondido (só os 4 últimos) e se é novo, igual ou troca.
// Guardar põe os novos e as trocas no cofre (a mesma peça do Importar certificados: a janela, o soltar e o escolher empresa).
import { BotaoAcao, BotaoFechar, CampoArquivo, Icone, useJanela } from '@nads/ui';
import { useRef, useState } from 'react';
import { EscolherEmpresa } from './ImportarCertificados';
import type { VmCofre } from './useCofre';
import { useImportarCodigosDoSimples, type SituacaoDoCodigo } from './useImportarCodigosDoSimples';

const escondido = (s: string) => (s ? '•••• ' + s.slice(-4) : '');
const SITUACAO: Record<SituacaoDoCodigo, { classe: string; rotulo: string }> = {
  lendo: { classe: 'pill-vazio', rotulo: 'Conferindo…' }, novo: { classe: 'badge badge-ok', rotulo: 'Novo' },
  igual: { classe: 'badge badge-neutral', rotulo: 'Já está' }, troca: { classe: 'badge badge-warn', rotulo: 'Troca' },
};

export function ImportarCodigosDoSimples({ cofre, fechar }: { cofre: VmCofre; fechar: () => void }) {
  const vm = useImportarCodigosDoSimples(cofre);
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const soltar = (fs: FileList | File[] | null | undefined) => { if (fs?.length) void vm.adicionar([...fs]); };
  const k = vm.contagem;
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="pessoal-janela troca-janela imp-cert" role="dialog" aria-modal="true" aria-label="Importar códigos do Simples">
        <header className="pessoal-topo">
          <h2>Importar códigos do Simples</h2>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="imp-cert-corpo">
          <CampoArquivo semCaixa semFoco multiplo ref={input} aceitar=".docx" onEscolherVarios={soltar} />
          <button type="button" className={'cert-soltar' + (sobre ? ' sobre' : '') + (vm.fila.length ? ' compacto' : '')} onClick={() => input.current?.click()}
            onDragOver={e => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
            onDrop={e => { e.preventDefault(); setSobre(false); soltar(e.dataTransfer.files); }}>
            <span className="cert-soltar-icone"><Icone nome="upload" width={20} height={20} /></span>
            <b>{vm.fila.length ? 'Soltar mais relatórios' : 'Solte os relatórios aqui'}</b>
            <span className="fraco">os .docx com o "Código de Acesso" de cada empresa</span>
          </button>
          {vm.fila.length > 0 && (
            <>
              <p className="hint">{k.novo} {k.novo === 1 ? 'novo' : 'novos'} · {k.troca} {k.troca === 1 ? 'troca' : 'trocas'} · {k.igual} já {k.igual === 1 ? 'está' : 'estão'} no cofre{k.semEmpresa ? ' · ' + k.semEmpresa + ' sem empresa (escolha ou tire)' : ''}</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cód.</th><th>Empresa</th><th>Código de acesso</th><th>Situação</th><th /></tr></thead>
                  <tbody>
                    {vm.fila.map(x => (
                      <tr key={x.id}>
                        <td>{x.alvo?.codigo != null && <span className="emp-cod">{x.alvo.codigo}</span>}</td>
                        <td>
                          {x.alvo ? <b>{x.alvo.nome}</b> : <span className="cert-erro"><Icone nome="alert" width={14} height={14} />Não achei: {x.empresa}</span>}
                          {x.alvo && formatosIguais(x.alvo.nome, x.empresa) ? null : x.alvo && <><br /><span className="fraco">no relatório: {x.empresa}</span></>}
                        </td>
                        <td className="num">{escondido(x.acesso)}{x.situacao === 'troca' && <><br /><span className="fraco">antes {escondido(x.antes)}</span></>}</td>
                        <td>{x.alvo ? <span className={SITUACAO[x.situacao].classe}>{SITUACAO[x.situacao].rotulo}</span> : <span className="pill-vazio">sem empresa</span>}</td>
                        <td>
                          <span className="imp-cert-acoes">
                            <EscolherEmpresa lista={vm.empresas} achada={!!x.alvo} onEscolher={e => vm.escolherEmpresa(x.id, e)} />
                            <button type="button" className="btn btn-ghost" onClick={() => vm.tirar(x.id)}>Tirar</button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {vm.semCodigo.length > 0 && <p className="hint">Sem o código de acesso no relatório: {vm.semCodigo.join(', ')}.</p>}
        </div>
        <footer className="usuario-pe troca-pe">
          <span className="hint">{vm.fila.length ? vm.prontos + ' para guardar' : ''}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
          <BotaoAcao carregando={vm.guardando} textoCarregando="Guardando…" disabled={!vm.prontos} onClick={() => void vm.guardar()}><Icone nome="check" width={16} height={16} />Guardar {vm.prontos || ''}</BotaoAcao>
        </footer>
      </div>
    </div>
  );
}

/** o nome do relatório é o mesmo da empresa (sem caixa e sem acento): não precisa repetir embaixo */
function formatosIguais(a: string, b: string) {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return n(a) === n(b);
}
