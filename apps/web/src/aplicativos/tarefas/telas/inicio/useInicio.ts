// ViewModel do Início da Tarefas: o mural de avisos (o admin e o diretor escrevem, fixam e apagam; todos leem).
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useAvisos } from '../../dados/repo';
import { useOperador, type Operador } from '../../casca/operador';
import { useMuralLido } from '../../casca/useMuralNovo';

export function useInicio() {
  const op = useOperador().operador as Operador;
  const { toast, aviso, modal } = useRetorno();
  const repo = useAvisos();
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const agora = new Date();
  const escreve = op.admin || op.nivel === 'diretor';
  const mural = repo.lista();
  // abriu o Início: os avisos do mural ficam lidos (o número da gaveta some; 06/11/2026)
  useMuralLido(mural.carregados ? mural.avisos.map(x => x.id) : []);


  return {
    nome: op.nome.split(/[ .]/)[0],
    // o mural
    carregandoAvisos: !mural.carregados,
    avisos: t.ordenarAvisos(mural.avisos).map(x => ({ ...x, quando: t.quandoFoi(x.em, agora), quandoCompleto: new Date(x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) })),
    escreve,
    novoAberto, abrirNovo: () => setNovoAberto(true), fecharNovo: () => setNovoAberto(false),
    texto, setTexto,
    faltam: t.MAIOR_AVISO - t.limparAviso(texto).length,
    podePublicar: !publicando && !t.problemaDoAviso(texto),
    publicando,
    async publicar() {
      const problema = t.problemaDoAviso(texto);
      if (problema) { aviso({ tom: 'erro', titulo: problema }); return; }
      setPublicando(true);
      try { await repo.publicar(texto, op.nome); setTexto(''); setNovoAberto(false); toast('Aviso publicado.'); }
      catch (e) { aviso({ tom: 'erro', titulo: 'O aviso não foi publicado', texto: e instanceof Error ? e.message : String(e) }); }
      finally { setPublicando(false); }
    },
    async fixar(id: string, fixado: boolean) {
      try { await repo.fixar(id, fixado); toast(fixado ? 'Aviso fixado no alto.' : 'Aviso solto.'); }
      catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para mudar o aviso', texto: e instanceof Error ? e.message : String(e) }); }
    },
    async apagar(id: string) {
      const ok = await modal({ icone: 'alert', titulo: 'Apagar o aviso?', texto: 'Ele sai do mural de todo o escritório.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      try { await repo.apagar(id); toast('Aviso apagado.'); }
      catch (e) { aviso({ tom: 'erro', titulo: 'O aviso não foi apagado', texto: e instanceof Error ? e.message : String(e) }); }
    },
  };
}
