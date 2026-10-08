// ViewModel dos extratos que chegaram (Vitor, 08/10/2026: "quero que isso aconteça com o contábil, ele já jogue o extrato
// para o nads"; e "extratos prontos de manhã"): o robô do Gmail guarda o extrato do e-mail e o do Drive (a pasta do
// cliente, o mês atual e o anterior) na fila extratosRecebidos, no Entregas. Ao abrir a tarefa de extratos do cliente,
// cada um entra sozinho na linha do banco certo quando ela ainda não tem extrato no mês (sem pergunta: nada a sobrepor),
// com a janela do andamento. O que já veio do Drive antes sai da lista. Os outros (duas contas do mesmo banco sem o
// número, ou a linha que já tem extrato) ficam num aviso: a pessoa escolhe a linha e importa, ou ignora.
import { extrator as x } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { useDrive } from '../../dados/repo';
import type { useImportacao } from '../importacao/useImportacao';
import { tempo, type AndamentoDeExtratos } from './AndamentoDosExtratos';

type Vm = ReturnType<typeof useImportacao>;

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Lote { total: number; feitos: { texto: string; ok: boolean }[]; atual: string; inicio: number; pronto: boolean; aberto: boolean }

export function useRecebidosPorEmail(vm: Vm, codigo: number | null) {
  const { drive, acesso } = useDrive();
  const [lista, setLista] = useState<x.ExtratoRecebido[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [importando, setImportando] = useState<string | null>(null);
  const [lote, setLote] = useState<Lote | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const tentados = useRef(new Set<string>());
  const pode = !!drive.extratosRecebidos && acesso.entrou && codigo != null;
  const competencia = vm.competencia;

  // a lista do cliente e do mês (de novo quando entra no Entregas ou troca o mês)
  useEffect(() => {
    if (!pode || !drive.extratosRecebidos) { setLista([]); return; }
    let vivo = true;
    drive.extratosRecebidos(codigo!, competencia).then(l => { if (vivo) setLista(l); }).catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [pode, codigo, competencia, drive]);

  // o que já foi importado do Drive antes (o mesmo arquivo) sai da lista sem fazer nada
  const doDriveJa = new Set(vm.bancos.flatMap(b => b.extrato.doDrive.map(a => a.id)));
  const repetidos = lista.filter(r => r.fileId && doDriveJa.has(r.fileId));
  useEffect(() => {
    if (!repetidos.length || !drive.marcarRecebido) return;
    for (const r of repetidos) void drive.marcarRecebido(r.id, 'importado', 'ja-importado-do-drive').catch(() => {});
    setLista(l => l.filter(a => !repetidos.some(r => r.id === a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repetidos.map(r => r.id).join(',')]);

  const linhas = vm.bancos.map(b => ({ id: b.id, nome: b.nome, marca: b.marca, numeroConta: b.numeroConta }));
  const destino = (r: x.ExtratoRecebido) => x.linhaDoRecebido(r, linhas);
  const nomeDaLinha = (id: string) => vm.bancos.find(b => b.id === id)?.nome || id;

  async function importar(r: x.ExtratoRecebido, linha: string, sozinho: boolean) {
    if (!drive.baixarRecebido || !drive.marcarRecebido) return false;
    setImportando(r.id);
    let ok = false;
    try {
      const conteudo = await drive.baixarRecebido(r.id);
      ok = await vm.importarRecebido(linha, r.nome, conteudo, sozinho);
      if (ok) {
        await drive.marcarRecebido(r.id, 'importado', linha);
        setLista(l => l.filter(a => a.id !== r.id));
      }
      return ok;
    } catch (e) {
      vm.avisarErro('O extrato não entrou', r.nome + ': ' + mensagemDeErro(e));
      return false;
    } finally {
      setImportando(null);
      if (sozinho) setLote(l => (l ? { ...l, feitos: [...l.feitos, { texto: r.nome + ' → ' + nomeDaLinha(linha), ok }] } : l));
    }
  }

  // sozinho: um de cada vez, só na linha certa e ainda sem extrato no mês (a empresa precisa ter carregado as linhas)
  const sozinhos = lista.filter(r => !tentados.current.has(r.id) && !(r.fileId && doDriveJa.has(r.fileId))).map(r => ({ r, d: destino(r) }))
    .filter(({ d }) => d.linha && vm.bancos.find(b => b.id === d.linha)?.extrato.qtdArquivos === 0);
  const proximo = !importando && !vm.ocupado && vm.bancos.length ? sozinhos[0] : undefined;
  useEffect(() => {
    if (!proximo) return;
    tentados.current.add(proximo.r.id);
    setLote(l => (!l || l.pronto
      ? { total: sozinhos.length, feitos: [], atual: proximo.r.nome, inicio: Date.now(), pronto: false, aberto: true }
      : { ...l, atual: proximo.r.nome, total: Math.max(l.total, l.feitos.length + sozinhos.length) }));
    // sem cancelar na troca do próximo (a janela atualiza o estado e o próximo muda antes de este começar)
    void importar(proximo.r, proximo.d.linha!, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proximo?.r.id]);
  // acabou o lote: a janela mostra o resumo (fica até o ×)
  useEffect(() => {
    if (lote && !lote.pronto && !proximo && !importando && lote.feitos.length >= lote.total) setLote({ ...lote, pronto: true, atual: '' });
  }, [lote, proximo, importando]);
  // o relógio da janela
  useEffect(() => {
    if (!lote || lote.pronto) return;
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(r);
  }, [lote]);

  // os que ficam para a pessoa: os que não entram sozinhos (ou que já tentaram e não entraram)
  const pendentes = lista.filter(r => !(r.fileId && doDriveJa.has(r.fileId)) && (!sozinhos.some(s => s.r.id === r.id) || tentados.current.has(r.id)) && importando !== r.id).map(r => {
    const d = destino(r);
    return {
      id: r.id, nome: r.nome, em: r.em ? new Date(r.em).toLocaleDateString('pt-BR') : '', remetente: r.remetente, doDrive: r.origem === 'drive',
      candidatas: (d.candidatas.length ? d.candidatas : linhas.map(l => l.id)).map(id => ({ id, nome: nomeDaLinha(id), conta: vm.bancos.find(b => b.id === id)?.conta || '' })),
      escolhida: escolhas[r.id] || d.linha || '',
      jaTemExtrato: !!d.linha && (vm.bancos.find(b => b.id === d.linha)?.extrato.qtdArquivos || 0) > 0,
      importando: importando === r.id,
      recebido: r,
    };
  });

  const andamento: AndamentoDeExtratos | null = lote && lote.aberto ? (() => {
    const feitos = lote.feitos.length;
    const pct = lote.pronto ? 100 : Math.min(99, Math.round(((feitos + 0.5) / Math.max(1, lote.total)) * 100));
    const foi = Math.round((agora - lote.inicio) / 1000);
    const falta = feitos ? Math.round((foi / feitos) * (lote.total - feitos)) : null;
    const entraram = lote.feitos.filter(f => f.ok).length;
    return {
      titulo: lote.pronto ? 'Extratos trazidos' : 'Trazendo os extratos',
      subtitulo: lote.pronto ? 'Concluído' : tempo(foi) + (falta ? ' · falta uns ' + tempo(Math.max(1, falta)) : ''),
      pct, pronto: lote.pronto,
      detalhe: lote.pronto ? 'Os extratos do e-mail e do Drive entraram nos bancos' : 'Importando ' + lote.atual,
      numeros: [
        { rotulo: 'Extratos', valor: lote.total, tom: 'info', icone: 'arquivo' },
        { rotulo: 'Entraram', valor: entraram, tom: 'ok', icone: 'check' },
        { rotulo: 'Para escolher', valor: pendentes.length, tom: 'aviso', icone: 'alert' },
      ],
      passos: [
        ...lote.feitos.map(f => ({ texto: f.texto + (f.ok ? '' : ' (não entrou)'), feito: true, atual: false, falhou: !f.ok })),
        ...(lote.atual ? [{ texto: lote.atual, feito: false, atual: true }] : []),
        ...(!lote.pronto && lote.total - feitos - 1 > 0 ? [{ texto: 'Mais ' + (lote.total - feitos - 1), feito: false, atual: false }] : []),
      ],
    };
  })() : null;

  return {
    pendentes,
    /** as linhas que têm extrato na fila (o "Pedir os que faltam" não conta) */
    linhasComRecebido: new Set(lista.map(r => destino(r).linha).filter((l): l is string => !!l)),
    andamento,
    fecharAndamento: () => setLote(l => (l ? { ...l, aberto: false } : l)),
    escolher: (id: string, linha: string) => setEscolhas(e => ({ ...e, [id]: linha })),
    importar: (id: string) => {
      const p = pendentes.find(a => a.id === id);
      if (p && p.escolhida) void importar(p.recebido, p.escolhida, false);
    },
    async ignorar(id: string) {
      if (!drive.marcarRecebido) return;
      try { await drive.marcarRecebido(id, 'ignorado', ''); setLista(l => l.filter(a => a.id !== id)); }
      catch (e) { vm.avisarErro('Não consegui tirar da lista', mensagemDeErro(e)); }
    },
  };
}
