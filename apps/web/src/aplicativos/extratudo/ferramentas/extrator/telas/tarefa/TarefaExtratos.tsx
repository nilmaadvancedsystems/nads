// Importar e conferir na mesma tela — a página que a etapa "Importar e conferir os extratos" da Tarefas abre.
// Em cima, à direita (como o "New issue" do GitHub): Pedir extrato e Adicionar banco ▾ (escolhe o banco e
// pede agência e conta). Depois, uma linha por conta da empresa (logo, nome, agência e conta), com o extrato
// e o razão lado a lado em botões só de ícone: clicar escolhe o arquivo e já importa; importado, vira um
// check verde que, com o mouse em cima, vira um × vermelho para excluir. O logo do banco e o do Drive ficam
// coloridos quando o extrato está importado. "Não teve movimento" trava a linha toda e vira "Desfazer" (quem
// guarda é a Tarefas). Ao importar, só uma barrinha por cima da tela, que some em 2,7 s. Embaixo, a conferência.
import { extrator as x, type empresas } from '@nads/core';
import { Icone, LogoBanco, LogoDrive, MensagemFlutuante, MenuSuspenso, useCarregando } from '@nads/ui';
import { useCallback, useId, useState } from 'react';
import { usePonteDaTarefa } from '../../../../../../comum/ponte';
import { useSessao } from '../../casca/sessao';
import { Conferencia } from '../conferencia/Conferencia';
import { useImportacao, type Mensagem } from '../importacao/useImportacao';

type Vm = ReturnType<typeof useImportacao>;
type Lado = { qtdArquivos: number; qtdLancamentos: number; lendo: boolean };

/** Botão só de ícone de um lado (extrato ou razão): importar → check verde → (mouse em cima) × para excluir. */
function BotaoLado({ lado, titulo, aceitar, travado, onArquivos, onExcluir }: {
  lado: Lado; titulo: string; aceitar: string; travado: boolean;
  onArquivos: (fs: File[]) => void; onExcluir: () => void;
}) {
  const id = useId();
  if (lado.lendo) return <span className="icon-btn icon-btn-sm imp-btn" title="Importando…"><span className="btn-spinner" /></span>;
  if (lado.qtdArquivos) {
    return (
      <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={onExcluir} disabled={travado}
        title={titulo + ': importado (' + lado.qtdLancamentos + ' lançamentos). Clique para excluir.'} aria-label={'Excluir ' + titulo.toLowerCase()}>
        <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
      </button>
    );
  }
  return (
    <>
      <label htmlFor={id} className={'icon-btn icon-btn-sm imp-btn' + (travado ? ' is-locked' : '')} title={'Importar ' + titulo.toLowerCase()} aria-label={'Importar ' + titulo.toLowerCase()}>
        <Icone nome="upload" />
      </label>
      <input id={id} type="file" multiple accept={aceitar} className="sr-only" disabled={travado}
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
  );
}

/** "Adicionar banco ▾": a lista dos bancos (com logo) e, escolhido um, agência e conta. */
function AdicionarBanco({ bancos, onAdicionar, fechar }: {
  bancos: readonly empresas.BancoDaEmpresa[];
  onAdicionar: (b: empresas.BancoDaEmpresa, agencia: string, conta: string) => void;
  fechar: () => void;
}) {
  const [escolhido, setEscolhido] = useState<empresas.BancoDaEmpresa | null>(null);
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const pronto = !!agencia.trim() && !!conta.trim();
  const adicionar = () => { if (!escolhido || !pronto) return; onAdicionar(escolhido, agencia, conta); fechar(); };

  if (!escolhido) {
    return (
      <div className="add-banco-lista" role="menu">
        {bancos.map(b => (
          <button key={b.id} type="button" className="popover-item add-banco-item" role="menuitem" onClick={() => setEscolhido(b)}>
            <span className="add-banco-logo"><LogoBanco banco={b.id} /></span>{b.nome}
          </button>
        ))}
      </div>
    );
  }
  return (
    <form className="add-banco-form" onSubmit={e => { e.preventDefault(); adicionar(); }}>
      <div className="add-banco-titulo">
        <span className="add-banco-logo"><LogoBanco banco={escolhido.id} cor /></span><b>{escolhido.nome}</b>
      </div>
      <label className="field"><span className="hint">Agência</span>
        <input type="text" autoFocus inputMode="numeric" value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="Ex.: 3001" />
      </label>
      <label className="field"><span className="hint">Conta</span>
        <input type="text" inputMode="numeric" value={conta} onChange={e => setConta(e.target.value)} placeholder="Ex.: 12345-6" />
      </label>
      <div className="add-banco-acoes">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEscolhido(null)}>Voltar</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!pronto}>Adicionar</button>
      </div>
    </form>
  );
}

function resumo(b: Vm['bancos'][number], semMovimento: boolean): string {
  if (semMovimento) return 'Sem movimento nesta competência';
  const parte = (nome: string, l: Lado) => (l.qtdArquivos ? nome + ' ' + l.qtdLancamentos + ' lanç.' : '');
  return [parte('Extrato', b.extrato), parte('Razão', b.razao)].filter(Boolean).join(' · ') || 'Nada importado';
}

export function TarefaExtratos() {
  const vm = useImportacao();
  const s = useSessao();
  const ponte = usePonteDaTarefa();
  useCarregando(vm.ocupado || vm.bancos.some(b => b.extrato.lendo || b.razao.lendo));
  const [cxExtrato, cxRazao] = vm.caixas;
  // a conferência é de um banco por vez (com mais de um, escolhe nos chips)
  const [bancoConf, setBancoConf] = useState<string | null>(null);
  const prontos = vm.bancos.filter(b => b.extrato.qtdArquivos && b.razao.qtdArquivos);
  const conf = vm.bancos.find(b => b.id === bancoConf) || prontos[0] || vm.bancos[0];
  const doArquivo = useCallback((a: x.ArquivoImportado) => x.bancoDoArquivo(a, vm.primeiro) === conf?.id, [vm.primeiro, conf?.id]);
  const umSo = vm.bancos.length <= 1;
  const faltaNoBanco = !conf || !conf.extrato.qtdArquivos ? 'banco' : !conf.razao.qtdArquivos ? 'sistema' : null;
  const falta = umSo ? s.falta : faltaNoBanco;

  return (
    <section className="tarefa-extratos">
      <div className="imp-topo">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.avisar('Pedir extrato ao cliente: em desenvolvimento')}>
          <Icone nome="link" />Pedir extrato
        </button>
        <MenuSuspenso rotulo="Adicionar banco" icone="plus" className="btn btn-primary btn-sm" direita largura={260}
          conteudo={fechar => <AdicionarBanco bancos={vm.bancosParaAdicionar} onAdicionar={vm.adicionarBanco} fechar={fechar} />} />
      </div>

      <div className="imp-lista">
        {vm.bancos.map(b => {
          const semMov = ponte.semMovimento.includes(b.id);
          // sem movimento: a linha toda trava (só o Desfazer fica)
          const travado = semMov || vm.ocupado || b.extrato.lendo || b.razao.lendo;
          const colorido = b.extrato.qtdArquivos > 0 && !semMov;
          return (
            <div key={b.id} className={'imp-linha' + (semMov ? ' sem-movimento' : '')}>
              <span className="imp-ico imp-logo"><LogoBanco banco={b.marca} cor={colorido} /></span>
              <div className="imp-txt">
                <span><b>{b.nome}</b>{b.conta && <span className="imp-conta">{b.conta}</span>}</span>
                <span className="hint">{resumo(b, semMov)}</span>
              </div>
              <div className="imp-grupos">
                <div className="imp-grupo" aria-label="Extrato do banco">
                  <span className="imp-rotulo">Extrato</span>
                  <BotaoLado lado={b.extrato} titulo="Extrato" aceitar={cxExtrato.aceitar} travado={travado}
                    onArquivos={fs => { void vm.importarArquivos(b.id, 'banco', fs); }} onExcluir={() => { void vm.excluirDoBanco(b.id, 'banco'); }} />
                  <button type="button" className="icon-btn icon-btn-sm imp-btn imp-drive" disabled={travado} title="Buscar no Drive" aria-label="Buscar no Drive"
                    onClick={() => vm.avisar('Buscar no Drive: em desenvolvimento')}><LogoDrive cor={colorido} /></button>
                  {!b.extrato.qtdArquivos && (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={travado} title="Protótipo: importar um extrato de teste" aria-label="Extrato de teste"
                      onClick={() => { void vm.importarTeste('banco', b.id); }}><Icone nome="zap" /></button>
                  )}
                </div>
                <div className="imp-grupo" aria-label="Razão da conta">
                  <span className="imp-rotulo">Razão</span>
                  <BotaoLado lado={b.razao} titulo="Razão" aceitar={cxRazao.aceitar} travado={travado}
                    onArquivos={fs => { void vm.importarArquivos(b.id, 'sistema', fs); }} onExcluir={() => { void vm.excluirDoBanco(b.id, 'sistema'); }} />
                  {!b.razao.qtdArquivos && (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={travado} title="Protótipo: importar um razão de teste" aria-label="Razão de teste"
                      onClick={() => { void vm.importarTeste('sistema', b.id); }}><Icone nome="zap" /></button>
                  )}
                </div>
                {ponte.naTarefa && (
                  <button type="button" className={'btn btn-sm btn-outline imp-sem-mov' + (semMov ? ' marcado' : '')} aria-pressed={semMov}
                    disabled={!semMov && (vm.ocupado || b.extrato.lendo || b.razao.lendo)}
                    onClick={() => ponte.marcarSemMovimento(b.id, !semMov)}>{semMov ? 'Desfazer' : 'Não teve movimento'}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* o resultado: uma barrinha por cima da tela; o que deu certo some em 2,7 s, erro fica até o × */}
      <MensagemFlutuante id="impAviso" className="imp-aviso" chave={vm.seqMensagem} onFechar={vm.fecharMensagem}
        duracao={vm.mensagem?.tom === 'erro' ? null : 2700}>
        {vm.mensagem && <Aviso m={vm.mensagem} onFechar={vm.fecharMensagem} />}
      </MensagemFlutuante>

      {!umSo && (
        <div className="chip-row imp-conf-bancos" aria-label="Conferência de qual banco">
          {vm.bancos.map(b => (
            <button key={b.id} type="button" className={'chip-f' + (b.id === conf?.id ? ' on' : '')} onClick={() => setBancoConf(b.id)}>
              {b.nome}{b.conta ? ' · ' + b.conta : ''}
            </button>
          ))}
        </div>
      )}
      {falta ? (
        <div className="gh-blank">
          <Icone nome="scale" />
          <h4>{falta === 'banco' ? 'Importe o extrato' + (umSo ? ' do banco' : ' do ' + conf?.nome) : 'Importe o razão' + (umSo ? ' da conta' : ' do ' + conf?.nome)}</h4>
          <p>A conferência aparece aqui quando os dois lados estiverem importados.</p>
        </div>
      ) : <Conferencia naTarefa doArquivo={umSo ? undefined : doArquivo} />}
    </section>
  );
}

function Aviso({ m, onFechar }: { m: Mensagem; onFechar: () => void }) {
  return (
    <div className={'imp-aviso-barra ' + m.tom} role="status">
      <Icone nome={m.tom === 'erro' ? 'alert' : m.tom === 'info' ? 'clock' : 'checkCircle'} />
      <span><b>{m.titulo}</b>{m.textos.length > 0 && <span className="hint"> · {m.textos.map(t => t.texto).join(' · ')}</span>}</span>
      <button type="button" aria-label="Fechar" title="Fechar" onClick={onFechar}>×</button>
    </div>
  );
}
