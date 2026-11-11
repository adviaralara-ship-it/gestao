// src/utils/fileViewer.js

/**
 * Converte uma string base64 / data URL para um Blob binário real com o MIME type adequado
 */
export function converterParaBlob(dataUrl, mimeFallback = 'application/pdf') {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:')) {
    return null;
  }

  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : mimeFallback;

    const cleanBase64 = (parts[1] || '').replace(/[\s\r\n]+/g, '');
    const byteCharacters = atob(cleanBase64);
    const sliceSize = 1024;
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mimeType });
  } catch (err) {
    console.error('Erro ao converter dataUrl para Blob:', err);
    return null;
  }
}

/**
 * Converte data URL em Blob URL utilizável em tags e links nativos
 */
export function converterParaBlobUrl(dataUrl, mimeFallback = 'application/pdf') {
  if (!dataUrl) return '';
  if (!dataUrl.startsWith('data:')) return dataUrl;

  try {
    const blob = converterParaBlob(dataUrl, mimeFallback);
    if (!blob) return dataUrl;
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Erro ao gerar Blob URL:', err);
    return dataUrl;
  }
}

/**
 * Abre o documento diretamente no visualizador nativo do navegador em uma nova aba.
 * Não utiliza iframes em about:blank para evitar bloqueios de segurança e folhas cinzas no Chrome.
 */
export function visualizarDocumento(url, nome = 'Documento') {
  if (!url) {
    alert('Aviso: Este documento não possui arquivo anexado ou a URL não está disponível.');
    return;
  }

  try {
    if (url.startsWith('data:')) {
      const isImage = url.startsWith('data:image/') || /\.(png|jpe?g|webp)$/i.test(nome);
      const mime = isImage
        ? (url.match(/data:(.*?);/)?.[1] || 'image/jpeg')
        : 'application/pdf';

      const blob = converterParaBlob(url, mime);
      if (!blob) {
        baixarDocumento(url, nome);
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');

      if (!win) {
        // Se o popup foi bloqueado pelo navegador, faz o download automático
        baixarDocumento(url, nome);
      }
    } else {
      // URL remota (Firebase Storage ou CDN)
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    console.error('Erro ao abrir documento em nova aba:', err);
    baixarDocumento(url, nome);
  }
}

/**
 * Dispara o download seguro e imediato do arquivo para a máquina do usuário
 */
export function baixarDocumento(url, nome = 'documento.pdf') {
  if (!url) {
    alert('Aviso: Não há arquivo anexado disponível para download.');
    return;
  }

  try {
    let finalUrl = url;
    let deveRevogar = false;

    if (url.startsWith('data:')) {
      const isImage = url.startsWith('data:image/') || /\.(png|jpe?g|webp)$/i.test(nome);
      const mime = isImage
        ? (url.match(/data:(.*?);/)?.[1] || 'image/jpeg')
        : 'application/pdf';
      const blob = converterParaBlob(url, mime);
      if (blob) {
        finalUrl = URL.createObjectURL(blob);
        deveRevogar = true;
      }
    }

    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = nome && nome.includes('.') ? nome : `${nome || 'documento'}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      if (deveRevogar) {
        URL.revokeObjectURL(finalUrl);
      }
    }, 1000);
  } catch (err) {
    console.error('Erro ao baixar documento:', err);
    window.open(url, '_blank');
  }
}
