// Importar e conferir na mesma tela — a página que a etapa "Importar e conferir os extratos" da Tarefas abre.
// Em cima, a importação em lista (uma linha para o extrato do banco, outra para o razão), com o que já foi
// importado em uma frase. Ao importar, só uma barrinha por cima da tela, que some em 2,7 s (ou no ×).
// Embaixo, a conferência. Excluir um arquivo fica na barra de baixo da etapa (a Tarefas pede por aqui).
import { BotaoAcao, CampoArquivos, Icone, MensagemFlutuante, useCarregando } from '@nads/ui';
import { useAvisarTarefa } from '../../../../../../comum/ponte';
import { useSessao } from '../../casca/sessao';
import { Conferencia } from '../conferencia/Conferencia';
import { useImportacao, type Mensagem } from '../importacao/useImportacao';

export function TarefaExtratos() {
  const vm = useImportacao();
  const s = useSessao();
  useCarregando(vm.ocupado);
  useAvisarTarefa(vm.arquivos.map(a => ({ id: a.id, lado: a.lado, nome: a.nome, periodo: a.periodo, qtd: a.qtd })), vm.excluirJa);

  return (
    <section className="tarefa-extratos">
      <div className="imp-lista">
        {vm.caixas.map(c => {
          const importados = vm.arquivos.filter(a => a.lado === c.lado);
          const lancamentos = importados.reduce((t, a) => t + a.qtd, 0);
          return (
            <div key={c.lado} className="imp-linha">
              <span className="imp-ico"><Icone nome={c.icone} /></span>
              <div className="imp-txt">
                <b>{c.titulo}</b>
                <span className="hint">{importados.length ? importados.length + (importados.length === 1 ? ' arquivo' : ' arquivos') + ' · ' + lancamentos + ' lançamentos' : c.formato}</span>
              </div>
              {c.escolhidos.length > 0 && (
                <div className="imp-escolhidos">
                  {c.escolhidos.map((f, i) => (
                    <span key={f.name + i} className="imp-chip" title={f.name}>
                      <span>{f.name}</span>
                      <button type="button" aria-label={'Tirar ' + f.name} disabled={c.lendo} onClick={() => vm.tirar(c.lado, i)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="imp-acoes">
                <CampoArquivos id={c.idArquivo} aceitar={c.aceitar} compacto desabilitado={vm.ocupado} rotulo={c.escolhidos.length ? 'Mais arquivos' : 'Escolher arquivos'}
                  onEscolher={fs => vm.escolher(c.lado, fs)} />
                <BotaoAcao className="btn btn-primary btn-sm" carregando={c.lendo} textoCarregando="Importando…" disabled={!c.escolhidos.length || vm.ocupado}
                  onClick={() => { void vm.importar(c.lado); }}>Importar</BotaoAcao>
                <button type="button" className="btn btn-sm btn-outline" disabled={vm.ocupado} title="Protótipo: importa lançamentos inventados, com TESTE no nome do arquivo"
                  onClick={() => { void vm.importarTeste(c.lado); }}><Icone nome="zap" />Teste</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* o resultado da importação: uma barrinha por cima da tela; o que deu certo some em 2,7 s, erro fica até o × */}
      <MensagemFlutuante id="impAviso" className="imp-aviso" chave={vm.seqMensagem} onFechar={vm.fecharMensagem}
        duracao={vm.mensagem?.tom === 'erro' ? null : 2700}>
        {vm.mensagem && <Aviso m={vm.mensagem} onFechar={vm.fecharMensagem} />}
      </MensagemFlutuante>

      {s.falta ? (
        <div className="gh-blank">
          <Icone nome="scale" />
          <h4>{s.falta === 'banco' ? 'Importe o extrato do banco' : 'Importe o razão da conta'}</h4>
          <p>A conferência aparece aqui quando os dois lados estiverem importados.</p>
        </div>
      ) : <Conferencia naTarefa />}
    </section>
  );
}

function Aviso({ m, onFechar }: { m: Mensagem; onFechar: () => void }) {
  return (
    <div className={'imp-aviso-barra' + (m.tom === 'erro' ? ' erro' : '')} role="status">
      <Icone nome={m.tom === 'erro' ? 'alert' : 'checkCircle'} />
      <span><b>{m.titulo}</b>{m.textos.length > 0 && <span className="hint"> · {m.textos.map(t => t.texto).join(' · ')}</span>}</span>
      <button type="button" aria-label="Fechar" title="Fechar" onClick={onFechar}>×</button>
    </div>
  );
}
