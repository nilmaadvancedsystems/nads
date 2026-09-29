// Importar e conferir na mesma tela — a página que a etapa "Importar e conferir os extratos" da Tarefas abre.
// Em cima, à direita (como o "New issue" do GitHub): Pedir extrato e Adicionar banco ▾. Depois, uma linha por
// banco da empresa (logo e nome do banco), com o extrato e o razão lado a lado em botões só de ícone: clicar
// escolhe o arquivo e já importa; importado, vira um check verde que, com o mouse em cima, vira um × vermelho
// para excluir. Drive no extrato. "Não teve movimento" escurece a linha (quem guarda é a Tarefas). Ao
// importar, só uma barrinha por cima da tela, que some em 2,7 s. Embaixo, a conferência.
import { Icone, LogoBanco, LogoDrive, MensagemFlutuante, MenuSuspenso, useCarregando } from '@nads/ui';
import { extrator as x } from '@nads/core';
import { useCallback, useId, useState } from 'react';
import { usePonteDaTarefa } from '../../../../../../comum/ponte';
import { useSessao } from '../../casca/sessao';
import { Conferencia } from '../conferencia/Conferencia';
import { useImportacao, type Mensagem } from '../importacao/useImportacao';

type Vm = ReturnType<typeof useImportacao>;
type Lado = { qtdArquivos: number; qtdLancamentos: number; lendo: boolean };

/** Botão só de ícone de um lado (extrato ou razão): importar → check verde → (mouse em cima) × para excluir. */
function BotaoLado({ lado, titulo, aceitar, desabilitado, onArquivos, onExcluir }: {
  lado: Lado; titulo: string; aceitar: string; desabilitado: boolean;
  onArquivos: (fs: File[]) => void; onExcluir: () => void;
}) {
  const id = useId();
  if (lado.lendo) return <span className="icon-btn icon-btn-sm imp-btn" title="Importando…"><span className="btn-spinner" /></span>;
  if (lado.qtdArquivos) {
    return (
      <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={onExcluir}
        title={titulo + ': importado (' + lado.qtdLancamentos + ' lançamentos). Clique para excluir.'} aria-label={'Excluir ' + titulo.toLowerCase()}>
        <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
      </button>
    );
  }
  return (
    <>
      <label htmlFor={id} className={'icon-btn icon-btn-sm imp-btn' + (desabilitado ? ' is-locked' : '')} title={'Importar ' + titulo.toLowerCase()} aria-label={'Importar ' + titulo.toLowerCase()}>
        <Icone nome="upload" />
      </label>
      <input id={id} type="file" multiple accept={aceitar} className="sr-only" disabled={desabilitado}
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
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
        <MenuSuspenso rotulo="Adicionar banco" icone="plus" className="btn btn-primary btn-sm" direita titulo={'A partir de ' + vm.competencia.slice(5) + '/' + vm.competencia.slice(0, 4)} largura={240}
          itens={vm.bancosParaAdicionar.map(b => ({ rotulo: b.nome, onClick: () => vm.adicionarBanco(b) }))} />
      </div>

      <div className="imp-lista">
        {vm.bancos.map(b => {
          const semMov = ponte.semMovimento.includes(b.id);
          const ocupado = vm.ocupado || b.extrato.lendo || b.razao.lendo;
          return (
            <div key={b.id} className={'imp-linha' + (semMov ? ' sem-movimento' : '')}>
              <span className="imp-ico imp-logo"><LogoBanco banco={b.id} /></span>
              <div className="imp-txt">
                <b>{b.nome}</b>
                <span className="hint">{resumo(b, semMov)}</span>
              </div>
              <div className="imp-grupos">
                <div className="imp-grupo" aria-label="Extrato do banco">
                  <span className="imp-rotulo">Extrato</span>
                  <BotaoLado lado={b.extrato} titulo="Extrato" aceitar={cxExtrato.aceitar} desabilitado={ocupado}
                    onArquivos={fs => { void vm.importarArquivos(b.id, 'banco', fs); }} onExcluir={() => { void vm.excluirDoBanco(b.id, 'banco'); }} />
                  <button type="button" className="icon-btn icon-btn-sm imp-btn imp-drive" title="Buscar no Drive" aria-label="Buscar no Drive"
                    onClick={() => vm.avisar('Buscar no Drive: em desenvolvimento')}><LogoDrive /></button>
                  {!b.extrato.qtdArquivos && (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={ocupado} title="Protótipo: importar um extrato de teste" aria-label="Extrato de teste"
                      onClick={() => { void vm.importarTeste('banco', b.id); }}><Icone nome="zap" /></button>
                  )}
                </div>
                <div className="imp-grupo" aria-label="Razão da conta">
                  <span className="imp-rotulo">Razão</span>
                  <BotaoLado lado={b.razao} titulo="Razão" aceitar={cxRazao.aceitar} desabilitado={ocupado}
                    onArquivos={fs => { void vm.importarArquivos(b.id, 'sistema', fs); }} onExcluir={() => { void vm.excluirDoBanco(b.id, 'sistema'); }} />
                  {!b.razao.qtdArquivos && (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={ocupado} title="Protótipo: importar um razão de teste" aria-label="Razão de teste"
                      onClick={() => { void vm.importarTeste('sistema', b.id); }}><Icone nome="zap" /></button>
                  )}
                </div>
                {ponte.naTarefa && (
                  <button type="button" className={'btn btn-sm imp-sem-mov' + (semMov ? ' marcado' : ' btn-outline')} aria-pressed={semMov}
                    onClick={() => ponte.marcarSemMovimento(b.id, !semMov)}>Não teve movimento</button>
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
            <button key={b.id} type="button" className={'chip-f' + (b.id === conf?.id ? ' on' : '')} onClick={() => setBancoConf(b.id)}>{b.nome}</button>
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
