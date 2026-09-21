/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './cardapio/index.html',
    './cardapio/src/**/*.{ts,js}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#c0392b',
        'primary-2': '#e67e22',
        secundaria: '#f1c40f',
        acento: '#ff6b35',
        'acento-2': '#e74c3c',
        fundo: '#fff8f0',
        texto: '#2d3436',
        cinza: '#636e72',
        verde: '#27ae60',
        roxo: '#6c5ce7',
        laranja: '#ff9f43'
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
