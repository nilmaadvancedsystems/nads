// O Início da Tarefas: os avisos do escritório em faixas, os fixados em cima (o admin e o diretor fixam e apagam em cada
// faixa e escrevem na janela do Novo aviso), e as tarefas (09/11/2026: a última empresa e o progresso do mês saíram; sem
// aviso, nada ocupa a tela). Só as peças do catálogo; nada anima.
import { Alerta, BotaoFechar, BotaoIcone, Esqueleto, Icone, useCarregando, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useNovidade } from '../../../../comum/novidades';
import { PaginaDeTarefas } from '../delegador/PaginaDeTarefas';
import { DadosDeTesteDoInicio } from './DadosDeTesteDoInicio';
import { InicioNovo } from './InicioNovo';
import { useInicio } from './useInicio';

type Vm = ReturnType<typeof useInicio>;

function Avisos({ vm }: { vm: Vm }) {
  if (vm.carregandoAvisos) return <Esqueleto linhas={1} />;
  if (!vm.avisos.length) return null;
  return (
    <div className="mural-faixas">
      {vm.avisos.map(a => (
        <div key={a.id} className="alerta-linha">
          <Alerta naLinha titulo="" texto={<span className="mural-aviso-texto">{a.texto}</span>}>
            <span className="hint" title={a.quandoCompleto}>{a.fixado && <><Icone nome="mapaPin" width={12} height={12} /> Fixado · </>}{a.por} · {a.quando}</span>
            {vm.escreve && (
              <>
                <span className="tarefas-barra-espaco" />
                <BotaoIcone pequeno icone="mapaPin" titulo={a.fixado ? 'Soltar do alto' : 'Fixar no alto'} aria-pressed={!!a.fixado} onClick={() => void vm.fixar(a.id, !a.fixado)} />
                <BotaoIcone pequeno icone="lixeira" titulo="Apagar o aviso" onClick={() => void vm.apagar(a.id)} />
              </>
            )}
          </Alerta>
        </div>
      ))}
    </div>
  );
}

// clicar fora não fecha; o texto fica guardado se a pessoa fechar sem publicar
function NovoAviso({ vm }: { vm: Vm }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharNovo);
  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal" role="dialog" aria-modal="true" aria-label="Novo aviso">
        <BotaoFechar canto onClick={vm.fecharNovo} />
        <h3>Novo aviso</h3>
        <div className="field">
          <label htmlFor="mural-novo-texto">Aviso para todo o escritório</label>
          <textarea id="mural-novo-texto" value={vm.texto} autoFocus onChange={e => vm.setTexto(e.target.value)} placeholder="Escreva o aviso"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.publicar(); } }} />
        </div>
        <div className="mural-novo-pe">
          {vm.faltam < 100 && <span className={'hint' + (vm.faltam < 0 ? ' cor-entrada' : '')}>{vm.faltam} caracteres</span>}
          <button type="button" className="btn btn-primary" disabled={!vm.podePublicar} onClick={() => void vm.publicar()}>
            <Icone nome="envelope" width={16} height={16} />{vm.publicando ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// o Início novo é uma novidade em teste (comum/novidades.ts): só no modo desenvolvedor até o Vitor aprovar; os outros
// continuam neste, sem mudança nenhuma
export function Inicio() {
  return useNovidade('inicio-novo') ? <InicioNovo /> : <InicioDeHoje />;
}

function InicioDeHoje() {
  const vm = useInicio();
  useCarregando(vm.carregandoAvisos);
  // as tarefas na mesma tela (Vitor, 09/11/2026: "coloque o que está no menu lateral em uma tela só"); ?aba= diz por qual abrir
  const [params] = useSearchParams();
  const pedida = params.get('aba');
  const aba = pedida === 'delegadas' || pedida === 'concluidas' ? pedida : 'minhas';
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <p className="hint" style={{ margin: 0 }}>Olá, {vm.nome}.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {vm.dev && <DadosDeTesteDoInicio teste={vm.teste} />}
          {vm.escreve && <button type="button" className="btn btn-outline" onClick={vm.abrirNovo}><Icone nome="plus" width={16} height={16} />Novo aviso</button>}
        </div>
      </div>
      <Avisos vm={vm} />
      {vm.novoAberto && <NovoAviso vm={vm} />}
      <div style={{ marginTop: 24 }}><PaginaDeTarefas key={aba} aba={aba} /></div>
    </section>
  );
}
