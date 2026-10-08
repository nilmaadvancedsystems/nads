// ViewModel dos extratos que chegaram por e-mail (Vitor, 08/10/2026: "quero que isso aconteça com o contábil, ele já jogue
// o extrato para o nads"): o robô do Gmail guarda o arquivo (extratosRecebidos, no Entregas); ao abrir a tarefa de
// extratos do cliente, cada um entra sozinho na linha do banco certo quando ela ainda não tem extrato no mês (sem
// pergunta: nada a sobrepor). Os outros (duas contas do mesmo banco sem o número, ou a linha que já tem extrato) ficam
// num aviso: a pessoa escolhe a linha e importa (aí o Extrator pergunta "apenas novas" ou "sobrepor"), ou ignora.
import { extrator as x } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { useDrive } from '../../dados/repo';
import type { useImportacao } from '../importacao/useImportacao';

type Vm = ReturnType<typeof useImportacao>;

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useRecebidosPorEmail(vm: Vm, codigo: number | null) {
  const { drive, acesso } = useDrive();
  const [lista, setLista] = useState<x.ExtratoRecebido[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [importando, setImportando] = useState<string | null>(null);
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

  const linhas = vm.bancos.map(b => ({ id: b.id, nome: b.nome, marca: b.marca, numeroConta: b.numeroConta }));
  const destino = (r: x.ExtratoRecebido) => x.linhaDoRecebido(r, linhas);

  async function importar(r: x.ExtratoRecebido, linha: string, sozinho: boolean) {
    if (!drive.baixarRecebido || !drive.marcarRecebido) return false;
    setImportando(r.id);
    try {
      const conteudo = await drive.baixarRecebido(r.id);
      const ok = await vm.importarRecebido(linha, r.nome, conteudo);
      if (!ok) return false;
      await drive.marcarRecebido(r.id, 'importado', linha);
      setLista(l => l.filter(a => a.id !== r.id));
      if (sozinho) vm.avisar('Chegou por e-mail e já entrou: ' + r.nome + ' (' + (vm.bancos.find(b => b.id === linha)?.nome || linha) + ')');
      return true;
    } catch (e) {
      vm.avisarErro('O extrato do e-mail não entrou', r.nome + ': ' + mensagemDeErro(e));
      return false;
    } finally { setImportando(null); }
  }

  // sozinho: um de cada vez, só na linha certa e ainda sem extrato no mês (a empresa precisa ter carregado as linhas)
  const sozinhos = lista.filter(r => !tentados.current.has(r.id)).map(r => ({ r, d: destino(r) }))
    .filter(({ d }) => d.linha && vm.bancos.find(b => b.id === d.linha)?.extrato.qtdArquivos === 0);
  const proximo = !importando && !vm.ocupado && vm.bancos.length ? sozinhos[0] : undefined;
  useEffect(() => {
    if (!proximo) return;
    tentados.current.add(proximo.r.id);
    const t = setTimeout(() => { void importar(proximo.r, proximo.d.linha!, true); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proximo?.r.id]);

  // os que ficam para a pessoa: os que não entram sozinhos (ou que já tentaram e não entraram)
  const pendentes = lista.filter(r => !sozinhos.some(s => s.r.id === r.id) || tentados.current.has(r.id)).map(r => {
    const d = destino(r);
    return {
      id: r.id, nome: r.nome, em: r.em ? new Date(r.em).toLocaleDateString('pt-BR') : '', remetente: r.remetente,
      candidatas: (d.candidatas.length ? d.candidatas : linhas.map(l => l.id)).map(id => ({ id, nome: linhas.find(l => l.id === id)?.nome || id, conta: vm.bancos.find(b => b.id === id)?.conta || '' })),
      escolhida: escolhas[r.id] || d.linha || '',
      jaTemExtrato: !!d.linha && (vm.bancos.find(b => b.id === d.linha)?.extrato.qtdArquivos || 0) > 0,
      importando: importando === r.id,
      recebido: r,
    };
  });

  return {
    pendentes,
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
