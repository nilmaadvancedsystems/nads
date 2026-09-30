// ViewModel do Drive na linha do banco (etapa dos extratos): "Buscar no Drive" procura o extrato da
// competência na pasta da empresa (pasta do ano, pelo mapa do robô do Entregas), baixa a cópia, lê e
// importa — o PDF não é guardado, só os lançamentos e de qual arquivo do Drive vieram. Sem login do
// Entregas, pede primeiro (o mesmo usuário das Pendências). Não achou um só: a pessoa escolhe entre os
// candidatos. "Visualizar" pede ao robô um link temporário (~30 min) e só abre; o link não é guardado.
import { creditor, extrator as x } from '@nads/core';
import { useRef, useState } from 'react';
import { useDrive } from '../../dados/repo';
import type { useImportacao } from '../importacao/useImportacao';

type Vm = ReturnType<typeof useImportacao>;
type Linha = Vm['bancos'][number];

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useDriveDaLinha(vm: Vm, codigo: number | null) {
  const { drive, acesso } = useDrive();
  const [login, setLogin] = useState({ aberto: false, usuario: '', senha: '', entrando: false, erro: '' });
  const [pendente, setPendente] = useState<Linha | null>(null);
  const [escolha, setEscolha] = useState<{ linha: Linha; texto: string; candidatos: creditor.ArquivoAchado[] } | null>(null);
  const [buscando, setBuscando] = useState<string | null>(null);
  // o que fazer depois de entrar, quando o login foi pedido por outra coisa (o Pedir extratos)
  const depois = useRef<(() => void) | null>(null);

  async function usar(linha: Linha, a: creditor.ArquivoAchado) {
    setEscolha(null);
    vm.marcarLendo(linha.id);
    try {
      const conteudo = await drive.baixar(a.id, a.nome);
      await vm.importarDoDrive(linha.id, { id: a.id, nome: a.nome }, conteudo);
    } catch (e) {
      vm.marcarLendo(null);
      vm.avisarErro('O extrato não veio do Drive', mensagemDeErro(e));
    }
  }

  async function buscar(linha: Linha) {
    if (!acesso.entrou) {
      // aberto dentro do Entregas: o login é o de lá (sem pedir senha aqui)
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O Drive usa o mesmo login do Entregas.'); return; }
      setPendente(linha); setLogin(l => ({ ...l, aberto: true, erro: '' })); return;
    }
    setBuscando(linha.id);
    try {
      const pasta = await drive.pastaDoCliente(codigo);
      const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, vm.competencia, { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta });
      if (r.situacao === 'achou' && r.arquivo) await usar(linha, r.arquivo);
      else setEscolha({ linha, texto: x.mensagemDaBuscaDoExtrato(r, vm.competencia.slice(5) + '/' + vm.competencia.slice(0, 4)), candidatos: r.candidatos });
    } catch (e) {
      vm.avisarErro('Não consegui olhar o Drive', mensagemDeErro(e));
    } finally {
      setBuscando(null);
    }
  }

  /** No período: procura no Drive o extrato de cada mês que falta daquele banco e importa os que achar. */
  async function buscarNoPeriodo(linha: Linha, meses: string[]) {
    if (!meses.length) return;
    if (!acesso.entrou) {
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O Drive usa o mesmo login do Entregas.'); return; }
      depois.current = () => { void buscarNoPeriodo(linha, meses); };
      setLogin(l => ({ ...l, aberto: true, erro: '' }));
      return;
    }
    setBuscando(linha.id);
    const achados: string[] = [];
    const faltam: string[] = [];
    try {
      const pasta = await drive.pastaDoCliente(codigo);
      for (const mes of meses) {
        const r = x.acharExtratoNoDrive(pasta?.itens || [], pasta?.raiz || null, mes, { nome: linha.nome, marca: linha.marca, conta: linha.numeroConta });
        const rotulo = mes.slice(5) + '/' + mes.slice(0, 4);
        if (r.situacao !== 'achou' || !r.arquivo) { faltam.push(rotulo); continue; }
        const conteudo = await drive.baixar(r.arquivo.id, r.arquivo.nome);
        await vm.importarDoDrive(linha.id, { id: r.arquivo.id, nome: r.arquivo.nome }, conteudo);
        achados.push(rotulo);
      }
      if (faltam.length) vm.avisarErro(linha.nome + ': ' + (achados.length ? 'trouxe ' + achados.join(', ') : 'nada no Drive'), 'Não achei no Drive: ' + faltam.join(', ') + '.');
      else vm.avisar(linha.nome + ': extratos de ' + achados.join(', ') + ' trazidos do Drive');
    } catch (e) {
      vm.avisarErro('Não consegui olhar o Drive', mensagemDeErro(e));
    } finally {
      setBuscando(null);
    }
  }

  async function entrar() {
    setLogin(l => ({ ...l, entrando: true, erro: '' }));
    try {
      await drive.entrarComGoogle();
      setLogin({ aberto: false, usuario: '', senha: '', entrando: false, erro: '' });
      const linha = pendente;
      setPendente(null);
      if (linha) void buscar(linha);
      const f = depois.current;
      depois.current = null;
      f?.();
    } catch (e) {
      setLogin(l => ({ ...l, entrando: false, erro: mensagemDeErro(e) }));
    }
  }

  return {
    exemplos: drive.exemplos,
    entrou: acesso.entrou,
    buscando,
    buscar: (linha: Linha) => { void buscar(linha); },
    buscarNoPeriodo: (linha: Linha, meses: string[]) => { void buscarNoPeriodo(linha, meses); },
    login: { ...login, set: (m: Partial<typeof login>) => setLogin(l => ({ ...l, ...m })), entrar: () => { void entrar(); }, fechar: () => { setPendente(null); depois.current = null; setLogin(l => ({ ...l, aberto: false })); } },
    /** pede o login do Entregas e, ao entrar, faz `f` */
    pedirLogin: (f: () => void) => { depois.current = f; setLogin(l => ({ ...l, aberto: true, erro: '' })); },
    escolha,
    usar: (a: creditor.ArquivoAchado) => { if (escolha) void usar(escolha.linha, a); },
    fecharEscolha: () => setEscolha(null),
    /** o link temporário para ver o arquivo do Drive (não guardar) */
    link: (arquivo: { id: string; nome: string }) => drive.link(arquivo.id, arquivo.nome),
  };
}
