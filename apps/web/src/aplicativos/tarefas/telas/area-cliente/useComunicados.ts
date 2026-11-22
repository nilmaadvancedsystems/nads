// ViewModel da página Comunicados da Área do Cliente (22/11/2026, ficha comunicados; o dono: "pode fazer tudo"): a lista dos
// comunicados aos clientes e o formulário. A equipe vê; o admin e os diretores escrevem, mudam e apagam. O robô do PC leva
// cada um para a Área do Cliente das empresas do alvo, dentro do período.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { ehDiretor } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import type { RascunhoDoComunicado } from '../../dados/areaCliente';
import { useAreaCliente } from '../../dados/repo';

export type TipoDoAlvo = 'todos' | 'regimes' | 'codigos';
export const REGIMES_DO_ALVO = ['Simples', 'MEI', 'Presumido', 'Real', 'Física', 'Domésticas', 'Isentas'] as const;

const dia = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const br = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

/** os códigos digitados ("292, 515 600") */
export function codigosDoTexto(t: string): number[] {
  return [...new Set(t.split(/[^0-9]+/).filter(Boolean).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 500);
}

/** o texto do alvo para a lista */
export function rotuloDoAlvo(a: ac.AlvoDoComunicado): string {
  if ('todos' in a) return 'Todos os clientes';
  if ('regimes' in a) return 'Regime: ' + a.regimes.join(', ');
  return a.codigos.length === 1 ? 'Empresa ' + a.codigos[0] : a.codigos.length + ' empresas: ' + a.codigos.slice(0, 6).join(', ') + (a.codigos.length > 6 ? '…' : '');
}

export function useComunicados() {
  const repo = useAreaCliente();
  const op = useOperador().operador;
  const { modal, toast } = useRetorno();
  const lista = repo.comunicados();
  const [, setVersao] = useState(0);
  const hoje = dia(new Date());
  const vazio = () => ({ titulo: '', texto: '', tipo: 'todos' as TipoDoAlvo, regimes: [] as string[], codigos: '', publicarEm: hoje, ate: dia(new Date(Date.now() + 30 * 864e5)) });
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const alvo = (): ac.AlvoDoComunicado => (form.tipo === 'todos' ? { todos: true } : form.tipo === 'regimes' ? { regimes: form.regimes } : { codigos: codigosDoTexto(form.codigos) });
  const rascunho = (): RascunhoDoComunicado => ({ titulo: form.titulo, texto: form.texto, alvo: alvo(), publicarEm: form.publicarEm, ate: form.ate });
  return {
    exemplos: repo.exemplos,
    carregando: !lista.carregada,
    erroDaLista: lista.erro,
    podeEditar: ehDiretor(op),
    linhas: lista.lista.map(c => ({
      ...c, alvoTexto: rotuloDoAlvo(c.alvo), periodo: br(c.publicarEm) + ' a ' + br(c.ate),
      situacao: hoje < c.publicarEm ? 'Agendado' : hoje > c.ate ? 'Encerrado' : 'No ar',
      tom: hoje < c.publicarEm ? 'badge-info' : hoje > c.ate ? 'badge-neutral' : 'badge-success',
      quando: c.atualizadoEm ? formatos.diaEmBrasilia(c.atualizadoEm).split('-').reverse().join('/') : '',
    })),
    form, aberto, editando, erro, gravando,
    regimes: REGIMES_DO_ALVO,
    limiteDoTitulo: ac.MAIOR_TITULO_DO_COMUNICADO, limiteDoTexto: ac.MAIOR_TEXTO_DO_COMUNICADO,
    mudar: (m: Partial<ReturnType<typeof vazio>>) => { setForm(f => ({ ...f, ...m })); setErro(''); },
    alternarRegime: (r: string) => setForm(f => ({ ...f, regimes: f.regimes.includes(r) ? f.regimes.filter(x => x !== r) : [...f.regimes, r] })),
    novo: () => { setForm(vazio()); setEditando(null); setErro(''); setAberto(true); },
    editar: (c: ac.Comunicado) => {
      setForm({ titulo: c.titulo, texto: c.texto, tipo: 'todos' in c.alvo ? 'todos' : 'regimes' in c.alvo ? 'regimes' : 'codigos', regimes: 'regimes' in c.alvo ? c.alvo.regimes : [], codigos: 'codigos' in c.alvo ? c.alvo.codigos.join(', ') : '', publicarEm: c.publicarEm, ate: c.ate });
      setEditando(c.id); setErro(''); setAberto(true);
    },
    fechar: () => { if (!gravando) setAberto(false); },
    async salvar() {
      const r = rascunho();
      const e = ac.erroDoComunicado(r);
      if (e) { setErro(e); return; }
      setGravando(true);
      try { await repo.salvarComunicado(r, editando ?? undefined); setAberto(false); setVersao(v => v + 1); toast(editando ? 'Comunicado atualizado.' : 'Comunicado publicado. Ele aparece na Área do Cliente no próximo minuto.'); }
      catch (err) { setErro(err instanceof Error ? err.message : 'Não deu para gravar agora.'); }
      finally { setGravando(false); }
    },
    async apagar(c: ac.Comunicado) {
      const ok = await modal({ titulo: 'Apagar o comunicado?', texto: '"' + c.titulo + '" sai da Área do Cliente de todos.', botoes: [{ rotulo: 'Apagar', valor: true, variante: 'btn-danger' }, { rotulo: 'Voltar', valor: false, variante: 'btn-outline' }] });
      if (!ok) return;
      try { await repo.apagarComunicado(c.id); setVersao(v => v + 1); toast('Comunicado apagado.'); }
      catch (err) { toast(err instanceof Error ? err.message : 'Não deu para apagar agora.'); }
    },
  };
}
