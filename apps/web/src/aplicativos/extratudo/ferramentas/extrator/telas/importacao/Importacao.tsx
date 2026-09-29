// Importação › Arquivos: as duas caixas (extratos bancários e lançamentos contábeis), a mensagem
// flutuante do resultado e os arquivos importados.
import { Alerta, MensagemFlutuante, useCarregando } from '@nads/ui';
import { ArquivosImportados } from './partes/ArquivosImportados';
import { CaixaImportacao } from './partes/CaixaImportacao';
import { useImportacao, type Mensagem } from './useImportacao';

export function Importacao() {
  const vm = useImportacao();
  useCarregando(vm.ocupado);
  return (
    <section>
      <div className="import-grid ext-import-grid">
        {vm.caixas.map(c => (
          <CaixaImportacao key={c.lado} caixa={c} ocupado={vm.ocupado}
            onEscolher={fs => vm.escolher(c.lado, fs)} onTirar={i => vm.tirar(c.lado, i)} onImportar={() => { void vm.importar(c.lado); }} onTeste={() => { void vm.importarTeste(c.lado); }} />
        ))}
      </div>

      <MensagemFlutuante id="extMsg" chave={vm.seqMensagem} onFechar={vm.fecharMensagem}>
        {vm.mensagem && <MensagemImportacao m={vm.mensagem} onFechar={vm.fecharMensagem} />}
      </MensagemFlutuante>

      <ArquivosImportados arquivos={vm.arquivos} onExcluir={id => { void vm.excluir(id); }} />
    </section>
  );
}

function MensagemImportacao({ m, onFechar }: { m: Mensagem; onFechar: () => void }) {
  return (
    <Alerta titulo={m.titulo} tom={m.tom === 'ok' ? 'ok' : undefined} onFechar={onFechar}>
      {m.textos.map((t, i) => <p key={i} className="alert-text" style={t.tom === 'aviso' ? { color: 'var(--warn)' } : undefined}>{t.texto}</p>)}
    </Alerta>
  );
}
