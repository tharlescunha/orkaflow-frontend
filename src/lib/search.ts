// Busca sem diferenciar acento e maiúscula ("credito" acha "CRÉDITO").
export function normalizeSearch(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
