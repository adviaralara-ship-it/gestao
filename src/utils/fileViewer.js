// src/utils/fileViewer.js

export function converterParaBlobUrl(dataUrl) {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
    
    const byteCharacters = atob(parts[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Erro ao converter dataUrl para Blob:", err);
    return dataUrl;
  }
}

export function visualizarDocumento(url, nome = 'Documento') {
  if (!url) {
    alert('Documento não disponível para visualização.');
    return;
  }

  const finalUrl = url.startsWith('data:') ? converterParaBlobUrl(url) : url;
  
  // Abrir em nova aba com Blob seguro que o Chrome/Edge renderiza perfeitamente
  const win = window.open(finalUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    baixarDocumento(url, nome);
  }
}

export function baixarDocumento(url, nome = 'documento.pdf') {
  if (!url) return;
  
  try {
    const finalUrl = url.startsWith('data:') ? converterParaBlobUrl(url) : url;
    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = nome.endsWith('.pdf') || nome.includes('.') ? nome : `${nome}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 200);
  } catch (err) {
    console.error("Erro ao baixar documento:", err);
    window.open(url, '_blank');
  }
}
