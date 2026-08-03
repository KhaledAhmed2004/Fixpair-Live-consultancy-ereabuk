import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  title: 'Fixpair Specs',
  description:
    'Product + Backend Feature Operating System for Fixpair Live Consultancy',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/operating-system' },
      { text: 'Product', link: '/product/overview' },
      { text: 'Features', link: '/features/template' },
      { text: 'Standards', link: '/standards/response-architecture' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'System',
          items: [
            {
              text: 'Operating System',
              link: '/guide/operating-system',
            },
            {
              text: 'Dual-role Workflow',
              link: '/guide/dual-role-workflow',
            },
            {
              text: 'User Journey (Visual)',
              link: '/guide/user-journey',
            },
          ],
        },
      ],
      '/product/': [
        {
          text: 'Product (full app)',
          items: [
            { text: 'Overview', link: '/product/overview' },
            {
              text: 'Information Architecture',
              link: '/product/information-architecture',
            },
            { text: 'Data Model', link: '/product/data-model' },
            { text: 'Card Sorting', link: '/product/card-sorting' },
            { text: 'Glossary', link: '/product/glossary' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Feature Template', link: '/features/template' },
            {
              text: 'Instant Consultation',
              link: '/features/instant-consultation',
            },
          ],
        },
      ],
      '/standards/': [
        {
          text: 'Standards',
          items: [
            {
              text: 'Response Architecture',
              link: '/standards/response-architecture',
            },
            { text: 'API Response', link: '/standards/api-response' },
            { text: 'Response Gaps', link: '/standards/response-gaps' },
            { text: 'Error Codes', link: '/standards/error-codes' },
            { text: 'HTTP Status', link: '/standards/http-status' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
    },
    socialLinks: [],
    footer: {
      message: 'Fixpair Product + Backend Spec System',
      copyright: 'Internal docs — keep contracts before code',
    },
  },
  mermaid: {
    theme: 'base',
    themeVariables: {
      darkMode: true,
      background: 'transparent',
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fontSize: '14px',
      primaryColor: '#1e293b',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#38bdf8',
      secondaryColor: '#312e81',
      secondaryTextColor: '#e0e7ff',
      secondaryBorderColor: '#818cf8',
      tertiaryColor: '#0f172a',
      tertiaryTextColor: '#cbd5e1',
      tertiaryBorderColor: '#475569',
      lineColor: '#94a3b8',
      textColor: '#e2e8f0',
      mainBkg: '#1e293b',
      nodeBorder: '#38bdf8',
      clusterBkg: '#111827',
      clusterBorder: '#334155',
      titleColor: '#f8fafc',
      edgeLabelBackground: '#0f172a',
      nodeTextColor: '#e2e8f0',
      actorBkg: '#1e293b',
      actorBorder: '#38bdf8',
      actorTextColor: '#e2e8f0',
      labelBoxBkgColor: '#1e293b',
      labelBoxBorderColor: '#64748b',
      labelTextColor: '#e2e8f0',
      signalColor: '#94a3b8',
      signalTextColor: '#e2e8f0',
    },
    flowchart: {
      curve: 'basis',
      padding: 20,
      nodeSpacing: 50,
      rankSpacing: 55,
      // Keep labels on ONE line so Mermaid sizes the box correctly.
      // Multi-line wrap + custom theme often clips the last line.
      wrappingWidth: 9999,
      htmlLabels: true,
    },
  },
})
