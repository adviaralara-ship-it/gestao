// src/utils/fileValidation.js
// Validação de tipo real de arquivo inspecionando Magic Bytes (File Signatures)

/**
 * Lê os primeiros N bytes de um arquivo File/Blob no navegador
 */
async function getFileHeaderBytes(file, numBytes = 12) {
  const slice = file.slice(0, numBytes);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Detecta o tipo real do arquivo com base na assinatura binária (Magic Bytes)
 * @param {File|Blob} file
 * @returns {Promise<'pdf'|'jpeg'|'png'|'webp'|'unknown'>}
 */
export async function detectRealFileType(file) {
  if (!file || file.size < 4) return 'unknown';

  const bytes = await getFileHeaderBytes(file, 12);

  // PDF: %PDF- (25 50 44 46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }

  // JPEG / JPG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return 'png';
  }

  // WEBP: RIFF .... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return 'unknown';
}

/**
 * Valida se o arquivo possui um tipo permitido e seguro antes do upload
 * @param {File} file
 * @param {Array<'pdf'|'jpeg'|'png'|'webp'>} allowedTypes
 * @returns {Promise<{ valid: boolean, type: string, error?: string }>}
 */
export async function validateFileUpload(file, allowedTypes = ['pdf', 'jpeg', 'png', 'webp']) {
  if (!file) {
    return { valid: false, type: 'unknown', error: 'Nenhum arquivo fornecido.' };
  }

  // 1. Limite de tamanho (padrão 20MB)
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, type: 'unknown', error: 'O arquivo excede o limite máximo permitido de 20 MB.' };
  }

  // 2. Extensões proibidas (executáveis, scripts, etc.)
  const forbiddenExts = ['.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.js', '.vbs', '.scr', '.msi', '.dll'];
  const fileName = (file.name || '').toLowerCase();
  for (const ext of forbiddenExts) {
    if (fileName.endsWith(ext)) {
      return { valid: false, type: 'unknown', error: `Extensão de arquivo potencialmente perigosa (${ext}) não permitida.` };
    }
  }

  // 3. Inspeção do tipo real via Magic Bytes
  const realType = await detectRealFileType(file);
  if (!allowedTypes.includes(realType)) {
    return {
      valid: false,
      type: realType,
      error: `Formato de arquivo inválido ou disfarçado. Esperado: ${allowedTypes.join(', ').toUpperCase()}. Assinatura detectada: ${realType.toUpperCase()}.`
    };
  }

  return { valid: true, type: realType };
}
