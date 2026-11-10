// Fonte única de verdade para dados institucionais.
// Tudo que aparece em mais de uma página (contatos, CNPJ, URLs do portal, condições da oferta)
// vem daqui — nunca digitado à mão nos templates.
export const site = {
  name: 'Empresas na Planta S.A.',
  shortName: 'Empresas na Planta',
  slogan: 'Fortalecendo quem quer prosperar',
  url: 'https://empresasnaplanta.com.br',
  locale: 'pt_BR',
  cnpj: '51.240.306/0001-56',
  legalType: 'Sociedade anônima de capital fechado',
  address: {
    street: 'Rua Deputado Leoberto Leal, 623',
    district: 'Guabirotuba',
    city: 'Curitiba',
    state: 'PR',
    zip: '81510-090',
  },
  email: 'contato@empresasnaplanta.com.br',
  // Dois números aparecem no site atual. Mantidos com papéis explícitos — ver AUDITORIA.md (P1-07).
  whatsAtendimento: { display: '(41) 99823-0937', e164: '5541998230937' },
  whatsEspecialistas: { display: '(41) 99875-5323', e164: '5541998755323' },
  instagram: 'https://www.instagram.com/empresasnaplanta/',
  facebook: 'https://www.facebook.com/empresasnaplanta',
  portal: {
    login: 'https://ia.empresasnaplanta.com.br/login.php',
    cadastro: 'https://ia.empresasnaplanta.com.br/cadastro',
  },
  // Condições comerciais publicadas na FAQ oficial (não alterar sem aprovação jurídica/comercial).
  oferta: {
    precoAcao: 50,
    loteMinimo: 100,
    parcelasMax: 5,
    bonificacaoMensal: 0.02,
    mesesPreOperacao: 6,
    primeiroSaqueMeses: 12,
  },
  foundedProject: 2023,
  year: 2026,
};
