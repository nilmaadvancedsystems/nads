// O aceite da política de privacidade (22/11/2026, ficha aceite-lgpd; o dono: "pode fazer tudo"): com a política ligada
// (core: POLITICA_LIGADA, depois de o escritório aprovar o texto), a janela aparece uma vez por versão neste aparelho, antes
// de tudo; "Concordo" grava o aceite no banco (por link e versão) e aqui. Os exemplos não pedem.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createElement, useEffect, useRef } from 'react';
import { repoAreaCliente } from '../dados/repo';

const chave = (token: string) => 'nads-cliente-politica-' + token;
const lerAceite = (token: string) => { try { return localStorage.getItem(chave(token)) || ''; } catch { return ''; } };
const guardarAceite = (token: string, versao: string) => { try { localStorage.setItem(chave(token), versao); } catch { /* sem guardar: pede de novo na próxima */ } };

export function usePolitica(token: string, pronta: boolean) {
  const { modal } = useRetorno();
  const aberta = useRef(false);
  useEffect(() => {
    if (!pronta || !token || aberta.current || !ac.precisaAceitar(lerAceite(token))) return;
    aberta.current = true;
    const corpo = createElement('div', { className: 'cli-politica' }, ...ac.TEXTO_DA_POLITICA.map(p => createElement('section', { key: p.titulo }, createElement('h4', null, p.titulo), createElement('p', null, p.texto))));
    void modal({ titulo: 'Política de privacidade', texto: 'Antes de continuar, leia como a Nilma Contabilidade cuida dos dados da sua empresa.', corpo, botoes: [{ rotulo: 'Concordo', valor: true, variante: 'btn-primary' }] }).then(ok => {
      if (ok !== true) { aberta.current = false; return; }
      guardarAceite(token, ac.VERSAO_DA_POLITICA);
      repoAreaCliente.aceitarPolitica(token, ac.VERSAO_DA_POLITICA).catch(() => undefined);
    });
  }, [token, pronta, modal]);
}
