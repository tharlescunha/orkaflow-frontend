/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Cores da marca Regente (guia de identidade visual v3.0). Só acrescenta tokens:
      // as classes blue-*/slate-* que as telas já usam continuam iguais.
      colors: {
        regente: {
          100: "#DBEAFE", // Azul Névoa: selo de versão
          200: "#BFDBFE", // Azul Claro: nó final, textos sobre escuro
          500: "#3B82F6", // início do degradê
          600: "#2563EB", // Azul Ação: botões
          700: "#1D4ED8", // Azul Regente: cor principal
          900: "#1E3A8A", // fim do degradê, fundos escuros
          ink: "#0F172A", // Tinta: títulos e textos
          muted: "#64748B", // Cinza Apoio: legendas
          bg: "#F8FAFC", // Fundo das telas
        },
      },
      backgroundImage: {
        // Degradê dos painéis escuros: 145°, 500 em 0%, 700 em 60%, 900 em 100%.
        "regente-gradient": "linear-gradient(145deg, #3B82F6 0%, #1D4ED8 60%, #1E3A8A 100%)",
      },
    },
  },
  plugins: [],
};
