// Puxar o extrato sem subir à mão, na Contabilização do minimum (27/11/2026, o Vitor: "pega aquela logica de integracao de extrato
// bancario de comprovante do tarefas e coloca la tbm… pra poder puxar os extratos"): as mesmas três vias da etapa dos extratos do
// Tarefas, com a empresa, o banco e o mês daqui:
//   - o Drive: a pasta da empresa pelo mapa do robô do Entregas (EXTRATOS/AAAA/MM/BANCÁRIOS/<BANCO>), o extrato do mês e do banco;
//   - os recebidos: o que o robô do Gmail/Drive já guardou para a empresa no mês (extratosRecebidos);
//   - o e-mail: a busca no Gmail do escritório (a janela do Tarefas, useBuscarNoEmail).
// Em todas, o arquivo vira um File e entra pela mesma leitura do "Subir o extrato" (importar).
import { extrator as x, type creditor } from '@nads/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { driveDoExtrator } from '../../etapas/extrator/dados/fonte';
import { useBuscarNoEmail } from '../../etapas/extrator/telas/tarefa/JanelaBuscarNoEmail';

/** O banco da empresa como a busca precisa: o id do Cadastro, o nome, a marca e o número da conta. */
export interface BancoParaBuscar { id: string; nome: string; marca: string; conta: string }

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** aaaa-mm do mês passado (o mês do contábil) */
const mesPassado = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const rotuloDoMes = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? NOMES[Number(m.slice(5)) - 1] + ' de ' + m.slice(0, 4) : m);

export function useBuscaDoExtrato(o: { codigo: number | null; bancos: readonly BancoParaBuscar[]; importar: (f: File) => Promise<unknown> }) {
  const drive = driveDoExtrator();
  useSyncExternalStore(drive.assinar, drive.versao, drive.versao);
  const acesso = drive.acesso();
  const [mes, setMes] = useState(mesPassado);
  const [bancoId, setBancoId] = useState('');
  const banco = o.bancos.find(b => b.id === bancoId) || o.bancos[0] || null;
  const [lendo, setLendo] = useState('');
  const [erro, setErro] = useState('');
  // o "varios" e o "nada" do Drive: os arquivos para a pessoa escolher
  const [candidatos, setCandidatos] = useState<creditor.ArquivoAchado[]>([]);
  const [recebidos, setRecebidos] = useState<x.ExtratoRecebido[]>([]);

  const entrar = async () => {
    setErro('');
    try { await drive.entrarComGoogle(); } catch (e) { setErro('Não consegui entrar: ' + mensagem(e)); }
  };
  // o login do Entregas antes de tudo (o mesmo do Tarefas); entrou, faz o que foi pedido
  const comLogin = async (fazer: () => Promise<void>) => {
    if (!drive.exemplos && acesso.pronto && !acesso.entrou) { await entrar(); if (!drive.acesso().entrou) return; }
    await fazer();
  };

  async function usarDoDrive(a: { id: string; nome: string }) {
    setLendo('Baixando do Drive: ' + a.nome);
    try {
      const bytes = await drive.baixar(a.id, a.nome, t => setLendo(t));
      setCandidatos([]);
      setLendo('Lendo ' + a.nome);
      await o.importar(new File([bytes], a.nome));
    } catch (e) { setErro('Não consegui baixar do Drive: ' + mensagem(e)); } finally { setLendo(''); }
  }

  const buscarNoDrive = () => comLogin(async () => {
    if (o.codigo == null) return;
    setErro(''); setCandidatos([]);
    setLendo('Procurando a pasta da empresa no Drive…');
    try {
      const pasta = await drive.pastaDoCliente(o.codigo);
      if (!pasta) { setErro('A empresa não tem pasta no Drive (pelo código ' + o.codigo + ').'); return; }
      const r = x.acharExtratoNoDrive(pasta.itens, pasta.raiz, mes, banco ? { nome: banco.nome, marca: banco.marca, conta: banco.conta } : { nome: '' });
      if (r.situacao === 'achou' && r.arquivo) { await usarDoDrive(r.arquivo); return; }
      setCandidatos(r.candidatos);
      setErro(x.mensagemDaBuscaDoExtrato(r, rotuloDoMes(mes)));
    } catch (e) { setErro('Não consegui olhar o Drive: ' + mensagem(e)); } finally { setLendo(l => (l.startsWith('Procurando') ? '' : l)); }
  });

  // os recebidos do mês (o robô do Gmail/Drive), lidos de novo quando troca o mês
  const temRecebidos = !!drive.extratosRecebidos && !!drive.baixarRecebido;
  useEffect(() => {
    if (!temRecebidos || o.codigo == null || !acesso.entrou) { setRecebidos([]); return; }
    let vale = true;
    drive.extratosRecebidos!(o.codigo, mes).then(l => { if (vale) setRecebidos(l); }, () => { if (vale) setRecebidos([]); });
    return () => { vale = false; };
  }, [drive, temRecebidos, o.codigo, mes, acesso.entrou]);
  async function usarRecebido(r: x.ExtratoRecebido) {
    setErro('');
    setLendo('Baixando ' + r.nome);
    try {
      const bytes = await drive.baixarRecebido!(r.id);
      setLendo('Lendo ' + r.nome);
      await o.importar(new File([bytes], r.nome));
      if (drive.marcarRecebido) await drive.marcarRecebido(r.id, 'importado', banco?.id || 'banco').catch(() => {});
      setRecebidos(l => l.filter(x => x.id !== r.id));
    } catch (e) { setErro('Não consegui trazer o extrato recebido: ' + mensagem(e)); } finally { setLendo(''); }
  }

  // o e-mail: a janela do Tarefas; o anexo escolhido entra pela leitura daqui
  const email = useBuscarNoEmail((_linha, fs) => { if (fs[0]) void o.importar(fs[0]); }, depois => { void entrar().then(() => { if (drive.acesso().entrou) depois(); }); }, o.codigo);

  return {
    mes, setMes: (m: string) => { setMes(m); setCandidatos([]); setErro(''); },
    bancos: o.bancos, banco, setBanco: (id: string) => { setBancoId(id); setCandidatos([]); setErro(''); },
    lendo, erro, candidatos,
    /** o Drive precisa do login do Entregas (o Google do escritório) */
    precisaEntrar: !drive.exemplos && acesso.pronto && !acesso.entrou,
    entrar: () => { void entrar(); },
    buscarNoDrive: () => { void buscarNoDrive(); },
    usarDoDrive: (a: { id: string; nome: string }) => { void usarDoDrive(a); },
    recebidos, usarRecebido: (r: x.ExtratoRecebido) => { void usarRecebido(r); },
    email,
    temEmail: email.existe,
    abrirEmail: () => { if (banco || !o.bancos.length) email.abrir({ id: banco?.id || 'banco', nome: banco?.nome || 'Banco' }, mes); },
  };
}

export type BuscaDoExtrato = ReturnType<typeof useBuscaDoExtrato>;
