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

  try {
    if (url.startsWith('data:')) {
      const blobUrl = converterParaBlobUrl(url);
      const isPdf = url.includes('application/pdf') || nome.toLowerCase().endsWith('.pdf');
      
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <title>${nome} - Alpha Soluções Condominiais</title>
              <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; height: 100vh; display: flex; flex-direction: column; }
                header { background: #1e293b; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
                header h1 { font-size: 14px; font-weight: 600; color: #e2e8f0; }
                header .btn { background: #0284c7; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; text-decoration: none; }
                header .btn:hover { background: #0369a1; }
                .viewer { flex: 1; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: auto; background: #0f172a; }
                iframe { width: 100%; height: 100%; border: none; }
                img { max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
              </style>
            </head>
            <body>
              <header>
                <h1>📄 ${nome}</h1>
                <a href="${blobUrl}" download="${nome.includes('.') ? nome : nome + (isPdf ? '.pdf' : '.jpg')}" class="btn">⬇ Baixar Arquivo</a>
              </header>
              <div class="viewer">
                ${isPdf
                  ? `<iframe src="${blobUrl}"></iframe>`
                  : `<img src="${blobUrl}" alt="${nome}" />`
                }
              </div>
            </body>
          </html>
        `);
        win.document.close();
      } else {
        baixarDocumento(url, nome);
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    console.error('Erro ao abrir documento:', err);
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
