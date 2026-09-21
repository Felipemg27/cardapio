export const WHATSAPP_NUMERO = '5521987004814';
export const NOME_RESTAURANTE = 'Sabor & Brasa';

// Google Identity Services — preencha com seu Client ID do Google Cloud Console
// Crie em https://console.cloud.google.com/apis/credentials -> Criar ID do Cliente OAuth 2.0
// e adicione http://localhost:5173 como origem autorizada.
// Se vazio, entra em modo demo (login mockado sem Google real).
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
