// O aceite da política de privacidade (22/11/2026, ficha aceite-lgpd; o dono: "pode fazer tudo"): com a política ligada
// (core: POLITICA_LIGADA; o dono aprovou o texto em 24/11/2026), a janela aparece uma vez por versão neste aparelho, antes
// de tudo; "Concordo" grava o aceite no banco (por link e versão) e aqui. Os exemplos só pedem com ?politica no endereço.
// (24/11/2026: "Corrigir os dois") a janela é obrigatória: sem ✕, sem fechar por fora e sem Esc (antes, com um botão só,
// o ✕ e o clique fora contavam como "Concordo"); e devolve se o aceite está pendente, para o tutorial esperar.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createElement, useEffect, useRef, useState } from 'react';
import { repoAreaCliente } from '../dados/repo';

const chave = (token: string) => 'nads-cliente-politica-' + token;
const lerAceite = (token: string) => { try { return localStorage.getItem(chave(token)) || ''; } catch { return ''; } };
const guardarAceite = (token: string, versao: string) => { try { localStorage.setItem(chave(token), versao); } catch { /* sem guardar: pede de novo na próxima */ } };

/** Abre a janela quando precisa; devolve true enquanto o aceite está pendente (o tutorial espera). */
/** de novo: mostra mesmo já aceita (a demonstração do exemplo com ?politica, 24/11/2026) */
export function usePolitica(token: string, pronta: boolean, deNovo = false): boolean {
  const { modal } = useRetorno();
  const aberta = useRef(false);
  // o link aceito nesta visita (o localStorage não avisa a tela quando muda)
  const [aceitoAgora, setAceitoAgora] = useState('');
  const pendente = pronta && !!token && aceitoAgora !== token && ac.precisaAceitar(deNovo ? '' : lerAceite(token));
  useEffect(() => {
    if (!pendente || aberta.current) return;
    aberta.current = true;
    const corpo = createElement('div', { className: 'cli-politica' }, ...ac.TEXTO_DA_POLITICA.map(p => createElement('section', { key: p.titulo }, createElement('h4', null, p.titulo), createElement('p', null, p.texto))));
    void modal({ titulo: 'Política de privacidade', texto: 'Antes de continuar, leia como a Nilma Contabilidade cuida dos dados da sua empresa.', corpo, obrigatoria: true, botoes: [{ rotulo: 'Concordo', valor: true, variante: 'btn-primary' }] }).then(ok => {
      aberta.current = false;
      if (ok !== true) return;
      guardarAceite(token, ac.VERSAO_DA_POLITICA);
      setAceitoAgora(token);
      repoAreaCliente.aceitarPolitica(token, ac.VERSAO_DA_POLITICA).catch(() => undefined);
    });
  }, [pendente, token, modal]);
  return pendente;
}
