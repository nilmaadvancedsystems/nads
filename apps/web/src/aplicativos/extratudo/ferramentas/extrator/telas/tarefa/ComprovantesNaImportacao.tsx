// Os comprovantes de cada banco na aba Bancos (Vitor, 06/11/2026: "deixar acima de lançamentos, formato dropdown… é opcional
// para quem quiser"): a faixa "Comprovantes anexados (opcional)" do bloco do banco, sem conferência nenhuma. Dentro, a grade
// dos meses com a linha Comprovante (Vitor, 26/10/2026: "deixe idêntico ao extrato"): o que está no Drive, o Drive colorido
// com o olhinho; enviando, o Drive com a rodinha; faltando, o ícone de importar com as opções do extrato (do computador,
// buscar no Drive, buscar no e-mail). Na barra, todos os meses de uma vez.
import { Icone, LogoDrive, LogoGmail, MenuSuspenso } from '@nads/ui';
import { useRef } from 'react';
import { FaixaQueAbre } from '../../../../../../comum/FaixaQueAbre';
import { BotaoVer } from '../../../puxados';
import type { VmComprovantes } from './useComprovantes';

const ACEITAR = '.pdf,.png,.jpg,.jpeg';

export function ComprovantesDoBanco({ vm, id, competencia, avisarErro }: {
  vm: VmComprovantes; id: string; competencia: string; avisarErro: (titulo: string, texto: string) => void;
}) {
  const b = vm.bancos.find(y => y.id === id);
  if (!b) return null;
  /** abre a janela já (senão o navegador bloqueia) e põe o link temporário quando o robô responder */
  function ver(a: { id: string; nome: string }) {
    const janela = window.open('', '_blank');
    janela?.document.write('<p style="font:14px sans-serif;padding:24px;color:#555">Buscando ' + a.nome.replace(/</g, '') + ' no Drive…</p>');
    vm.link(a).then(url => { if (janela) janela.location.href = url; else window.open(url, '_blank'); },
      e => { janela?.close(); avisarErro('Não consegui abrir do Drive', e instanceof Error ? e.message : String(e)); });
  }
  // todos os meses de uma vez (Vitor, 27/10/2026: "igual a outra tela", o Extrato da aba Bancos)
  const todos = b.meses.length > 1 && b.comArquivo < b.meses.length
    ? <ImportarComprovantesTodos restantes={b.comArquivo > 0} onArquivos={fs => vm.todosDoComputador(b, fs, b.comArquivo > 0)} onDrive={vm.buscarNoDrive} />
    : undefined;
  return (
    <FaixaQueAbre titulo="Comprovantes anexados (opcional)" qtd={b.comArquivo} acoes={todos}>
      {/* opcional: o que não deu certo no Drive fica em cinza, não é pendência */}
      {vm.erro && <p className="hint">{vm.erro}</p>}
      {!vm.entrou && <p className="hint">Para ver os comprovantes do Drive e buscar no e-mail, entre com o login do Entregas (o Buscar no Drive de um mês pede).</p>}
      {vm.lendo && <p className="hint"><span className="btn-spinner" /> Lendo o Drive</p>}
      <MesesDosComprovantes vm={vm} b={b} competencia={competencia} onVer={ver} />
    </FaixaQueAbre>
  );
}

/** A grade do banco: os meses em cima e a linha Comprovante (a mesma célula do extrato). */
function MesesDosComprovantes({ vm, b, competencia, onVer }: { vm: VmComprovantes; b: VmComprovantes['bancos'][number]; competencia: string; onVer: (a: { id: string; nome: string }) => void }) {
  return (
    <div className="imp-periodo-linha">
      <table className="imp-meses">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Mês</span></th>
            {b.meses.map(m => <th key={m.mes} scope="col" className={m.mes === competencia ? 'atual' : undefined}><span className="imp-meses-mes">{m.rotulo}</span></th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Comprovante</th>
            {b.meses.map((m, n) => (
              <td key={m.mes} className={m.mes === competencia ? 'atual' : undefined}>
                {m.enviando && (
                  <span className="icon-btn icon-btn-sm imp-btn imp-subindo" title="Arquivando no Drive… (quando o robô gravar, vira o ícone do Drive com o olhinho)" aria-label="Arquivando no Drive">
                    <LogoDrive /><span className="btn-spinner" />
                  </span>
                )}
                {m.arquivos.length > 0 ? (
                  <>
                    <span className="icon-btn icon-btn-sm imp-btn imp-feito imp-feito-drive" title={'No Drive: ' + m.arquivos.map(a => a.nome).join(', ')} aria-label={'Comprovante de ' + m.rotulo + ' no Drive'}>
                      <span className="imp-feito-ok"><LogoDrive cor /></span>
                    </span>
                    <BotaoVer titulo={'Ver o comprovante de ' + m.rotulo + ': ' + m.arquivos.map(a => a.nome).join(', ')} onVer={() => m.arquivos.forEach(onVer)} />
                  </>
                ) : !m.enviando && (
                  <FaltaComprovante rotulo={m.rotulo} direita={n >= b.meses.length / 2} comEmail={vm.buscaExiste}
                    onArquivos={fs => vm.doComputador(b, fs, m.mes)} onDrive={vm.buscarNoDrive} onEmail={() => vm.buscarNoEmail(b, m.mes)} />
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Todos os meses de uma vez, como o Extrato da aba Bancos: do computador (cada arquivo no seu mês) ou do Drive. */
function ImportarComprovantesTodos({ restantes, onArquivos, onDrive }: { restantes: boolean; onArquivos: (fs: File[]) => void; onDrive: () => void }) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <>
      <MenuSuspenso rotulo="" icone="upload" className="gh-topo-btn gh-topo-menu" direita
        dica={restantes ? 'Importar os comprovantes dos meses que faltam' : 'Importar os comprovantes de todos os meses'}
        conteudo={fechar => (
          <>
            <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); arquivo.current?.click(); }}>
              <Icone nome="upload" /><span className="popover-texto">{restantes ? 'Importar os restantes do computador' : 'Importar do computador'}</span>
            </button>
            <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); onDrive(); }}>
              <LogoDrive cor /><span className="popover-texto">{restantes ? 'Adicionar restantes do Drive' : 'Todos pelo Drive'}</span>
            </button>
          </>
        )} />
      <input ref={arquivo} type="file" multiple accept={ACEITAR} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
  );
}

/** O comprovante que falta no mês: o ícone de importar; clicou, as opções (as mesmas do extrato). */
function FaltaComprovante({ rotulo, direita, comEmail, onArquivos, onDrive, onEmail }: {
  rotulo: string; direita: boolean; comEmail: boolean; onArquivos: (fs: File[]) => void; onDrive: () => void; onEmail: () => void;
}) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <>
      <MenuSuspenso rotulo="" icone="upload" className="gh-topo-btn gh-topo-menu imp-mes-menu" direita={direita} dica={'Importar o comprovante de ' + rotulo}
        conteudo={fechar => (
          <>
            <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); arquivo.current?.click(); }}>
              <Icone nome="upload" /><span className="popover-texto">Importar do computador</span>
            </button>
            <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); onDrive(); }}>
              <LogoDrive cor /><span className="popover-texto">Buscar no Drive</span>
            </button>
            {comEmail && (
              <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); onEmail(); }}>
                <LogoGmail /><span className="popover-texto">Buscar no e-mail</span>
              </button>
            )}
          </>
        )} />
      <input ref={arquivo} type="file" multiple accept={ACEITAR} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
  );
}
