// ViewModel do "Pedir extratos" (Gmail ou WhatsApp): a janela onde a pessoa escolhe os bancos e as
// competências (a da tela já vem marcada; "Mais competências" libera as outras), vê a mensagem pronta e
// envia. O contato vem do cadastro de clientes do Entregas (mesmo login do Drive). E-mail: vai para a fila
// do robô do Entregas, que monta o HTML e envia pelo Gmail do escritório. WhatsApp: o link wa.me com o texto.
import { creditor, extrator as x, tarefas } from '@nads/core';
import { useState } from 'react';
import { useDrive } from '../../dados/repo';
import type { useImportacao } from '../importacao/useImportacao';

type Vm = ReturnType<typeof useImportacao>;

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function usePedirExtratos(vm: Vm, codigo: number | null, empresa: string, semMovimento: string[], pedirLogin: (depois: () => void) => void) {
  const { drive, acesso } = useDrive();
  const [canal, setCanal] = useState<x.CanalDoPedido | null>(null);
  const [contato, setContato] = useState<{ carregando: boolean; erro: string; dados: creditor.ContatoDoCliente | null }>({ carregando: false, erro: '', dados: null });
  const [bancos, setBancos] = useState<string[]>([]);
  const [mais, setMais] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [enviando, setEnviando] = useState('');

  async function carregarContato() {
    if (codigo == null) { setContato({ carregando: false, erro: 'A empresa não tem o código do ERP para achar no cadastro.', dados: null }); return; }
    if (!drive.contatoDoCliente) { setContato({ carregando: false, erro: 'Aberto dentro do Entregas: peça pela tela de Pendências.', dados: null }); return; }
    setContato({ carregando: true, erro: '', dados: null });
    try {
      const dados = await drive.contatoDoCliente(codigo);
      setContato({ carregando: false, erro: dados ? '' : 'A empresa ' + codigo + ' não está no cadastro de clientes do Entregas.', dados });
      setEmails(dados?.emails.slice(0, 1) || []);
    } catch (e) {
      setContato({ carregando: false, erro: mensagemDeErro(e), dados: null });
    }
  }

  function abrir(c: x.CanalDoPedido) {
    if (!acesso.entrou && !drive.exemplos) {
      if (drive.loginDeFora) { vm.avisarErro('Entre no Entregas', 'O pedido usa o cadastro de clientes do Entregas.'); return; }
      pedirLogin(() => abrir(c));
      return;
    }
    // já marcados: os bancos que ainda não têm o extrato da competência (e não estão sem movimento)
    const faltam = vm.bancos.filter(b => !b.extrato.qtdArquivos && !semMovimento.includes(b.id)).map(b => b.id);
    setBancos(faltam.length ? faltam : vm.bancos.map(b => b.id));
    setMais(false); setExtras([]); setEnviando('');
    setCanal(c);
    void carregarContato();
  }

  const competencias = [vm.competencia, ...(mais ? extras : [])];
  const pedido: x.PedidoDeExtratos = {
    cliente: contato.dados?.nome || empresa,
    bancos: vm.bancos.filter(b => bancos.includes(b.id)).map(b => ({ nome: b.nome, conta: b.conta || undefined })),
    competencias,
  };
  const texto = canal ? x.textoDoPedido(pedido, canal) : '';
  const telefone = contato.dados ? x.telefoneParaWhatsApp(contato.dados.telefone) : '';
  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter(i => i !== v) : [...lista, v]);

  async function enviarEmail() {
    if (!contato.dados || !drive.pedirEmail || !emails.length || !bancos.length) return;
    const assunto = x.assuntoDoPedido(pedido);
    const competencia = x.competenciaDoPedido(pedido);
    try {
      const resultados: ('enviado' | 'na-fila')[] = [];
      for (const para of emails) {
        setEnviando('Enviando para ' + para);
        resultados.push(await drive.pedirEmail({ contato: contato.dados, para, assunto, corpo: texto, competencia }, passo => setEnviando(passo)));
      }
      setCanal(null);
      if (resultados.every(r => r === 'enviado')) vm.avisar('E-mail enviado para ' + emails.join(', '));
      else vm.avisar('Pedido na fila do robô do Entregas: o e-mail sai assim que ele estiver online');
    } catch (e) {
      vm.avisarErro('O e-mail não foi', mensagemDeErro(e));
    } finally {
      setEnviando('');
    }
  }

  return {
    canal, abrir, fechar: () => { if (!enviando) setCanal(null); },
    exemplos: drive.exemplos,
    contato,
    bancos: vm.bancos.map(b => ({ id: b.id, nome: b.nome, marca: b.marca, conta: b.conta, marcado: bancos.includes(b.id), temExtrato: b.extrato.qtdArquivos > 0 })),
    alternarBanco: (id: string) => setBancos(v => alternar(v, id)),
    competencia: { valor: vm.competencia, rotulo: tarefas.rotuloCompetencia(vm.competencia) },
    mais, setMais,
    outrasCompetencias: vm.competencias.filter(c => c.valor !== vm.competencia).map(c => ({ ...c, marcado: extras.includes(c.valor) })),
    alternarCompetencia: (c: string) => setExtras(v => alternar(v, c)),
    emails: (contato.dados?.emails || []).map(e => ({ email: e, marcado: emails.includes(e) })),
    alternarEmail: (e: string) => setEmails(v => alternar(v, e)),
    assunto: canal === 'email' ? x.assuntoDoPedido(pedido) : '',
    texto,
    telefone: contato.dados?.telefone || '',
    whatsappOk: !!telefone,
    linkWhatsApp: contato.dados ? x.linkDoWhatsApp(contato.dados.telefone, texto) : '',
    pode: canal === 'email' ? !!contato.dados && emails.length > 0 && bancos.length > 0 && !enviando : !!telefone && bancos.length > 0,
    enviando,
    enviarEmail: () => { void enviarEmail(); },
  };
}
