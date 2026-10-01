// Uma linha da Importação da Conferência dentro da primeira etapa da Tarefas (Balancete, Entradas, Saídas, Tomados,
// Prestados), no jeito das linhas dos bancos: a setinha (abre o que foi importado), o ícone, o nome, o que já veio
// e, à direita, importar (vira ✓; o × exclui) e reimportar. Mesmo ViewModel da página de Importação: as mesmas
// regras, perguntas e mensagens.
import { conferencia as c } from '@nads/core';
import { Alerta, Icone, MensagemFlutuante } from '@nads/ui';
import { useEffect, useId, useState } from 'react';
import { useImportacao } from '../useImportacao';
import { NotasImportadas, ServicosImportados } from './Importados';
import { PlanoDeContas } from './PlanoDeContas';

const NOME: Record<c.PaginaImportacao, string> = {
  balancete: 'Balancete', entradas: 'Entradas', saidas: 'Saídas', tomados: 'Serviços tomados', prestados: 'Serviços prestados',
};

export function LinhaDaImportacao({ tipo }: { tipo: c.PaginaImportacao }) {
  const vm = useImportacao(tipo);
  const id = useId();
  // escolheu o arquivo: importa já (o ViewModel lê o arquivo guardado, então espera ele chegar)
  const [pedido, setPedido] = useState(false);
  const [aberta, setAberta] = useState(false);
  const { arquivo, importar } = vm;
  useEffect(() => {
    if (!pedido || !arquivo) return;
    setPedido(false);
    void importar();
  }, [pedido, arquivo, importar]);

  const resumo = vm.plano ? vm.plano.resumo.reduce((t, g) => t + g.qtd, 0) + ' contas'
    : vm.notas ? vm.notas.qtd + ' notas · ' + vm.notas.periodo
      : vm.servicos ? vm.servicos.qtd + ' notas · ' + vm.servicos.periodo : '';
  const escolher = (
    <input id={id} type="file" accept={vm.cfg.aceitar} className="sr-only" disabled={vm.carregando}
      onChange={ev => { const f = ev.target.files?.[0] || null; ev.target.value = ''; if (f) { vm.setArquivo(f); setPedido(true); } }} />
  );

  return (
    <div className="imp-bloco">
      <div className="imp-linha imp-linha-conf">
        <button type="button" className={'imp-seta' + (aberta && vm.ja ? ' aberta' : '')} aria-expanded={aberta && vm.ja} disabled={!vm.ja}
          title={!vm.ja ? 'Nada importado ainda' : aberta ? 'Fechar' : 'Ver o que foi importado'} aria-label={'Ver ' + NOME[tipo].toLowerCase()} onClick={() => setAberta(a => !a)}>
          <Icone nome="caretDown" />
        </button>
        <span className="imp-ico imp-ico-conf"><Icone nome={vm.cfg.icone} /></span>
        <div className="imp-txt"><span><b>{NOME[tipo]}</b></span></div>
        <div className="imp-resumo">{resumo && <div><span>{resumo}</span></div>}</div>
        <div className="imp-grupos">
          <div className="imp-grupo" aria-label={NOME[tipo]}>
            {vm.carregando ? (
              <span className="icon-btn icon-btn-sm imp-btn" title="Importando…"><span className="btn-spinner" /></span>
            ) : vm.ja ? (
              <>
                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={() => { void vm.excluir(); }}
                  title={NOME[tipo] + ': importado' + (resumo ? ' (' + resumo + ')' : '') + '. Clique para excluir.'} aria-label={'Excluir ' + NOME[tipo].toLowerCase()}>
                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                </button>
                <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title={'Reimportar ' + NOME[tipo].toLowerCase()} aria-label={'Reimportar ' + NOME[tipo].toLowerCase()}>
                  <Icone nome="repeat" />
                </label>
                {escolher}
              </>
            ) : (
              <>
                <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title={vm.cfg.titulo + ' — ' + vm.cfg.dica} aria-label={vm.cfg.titulo}>
                  <Icone nome="upload" />
                </label>
                {escolher}
              </>
            )}
          </div>
        </div>
      </div>
      {aberta && vm.ja && (
        <div className="imp-conf-dados">
          {vm.plano && <PlanoDeContas plano={vm.plano} onGrupo={vm.alternarGrupo} />}
          {vm.notas && <NotasImportadas r={vm.notas} />}
          {vm.servicos && <ServicosImportados r={vm.servicos} />}
        </div>
      )}
      <MensagemFlutuante id={vm.cfg.idMensagem} chave={vm.seqMensagem} onFechar={vm.fecharMensagem}>
        {vm.mensagem && (
          <Alerta titulo={vm.mensagem.titulo} tom={vm.mensagem.tom === 'ok' ? 'ok' : undefined} onFechar={vm.fecharMensagem}>
            {vm.mensagem.textos.map((t, i) => <p key={i} className="alert-text" style={t.tom === 'aviso' || t.separado ? { color: 'var(--warn)' } : undefined}>{t.texto}</p>)}
          </Alerta>
        )}
      </MensagemFlutuante>
    </div>
  );
}
