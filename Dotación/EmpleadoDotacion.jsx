import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import './EmpleadoDotacion.css';

const EmpleadoDotacion = ({ onConfirmEntrega }) => {
  const [documento, setDocumento] = useState('');
  const [dotaciones, setDotaciones] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedDotacionId, setSelectedDotacionId] = useState(null);
  const [entregaFirmando, setEntregaFirmando] = useState(null);
  const [signatureError, setSignatureError] = useState('');
  const [autorizaFirma, setAutorizaFirma] = useState(false);

  // Estados por entrega
  const [facturaFiles, setFacturaFiles] = useState({});       // { [entregaId]: File }
  const [facturaPreviews, setFacturaPreviews] = useState({}); // { [entregaId]: string }
  const [facturaErrors, setFacturaErrors] = useState({});     // { [entregaId]: string }
  const [facturaLoading, setFacturaLoading] = useState({});   // { [entregaId]: boolean }

  // Toggle manual para mostrar el campo aun si no se detecta bono
  const [forceFactura, setForceFactura] = useState({});       // { [entregaId]: boolean }

  const sigCanvasRef = useRef();

  // ───────── Helpers ─────────
  const isValidHttpUrl = (value) => {
    if (!value || typeof value !== 'string') return false;
    const bad = ['n/a', '-', 'null', 'undefined'];
    if (bad.includes(value.trim().toLowerCase())) return false;
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const normalizeKey = (str) =>
    String(str)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  // Detecta bono calzado con variantes (Bono Calzado, bono_calzado, etc.)
  const findBonoCalzadoItem = (items) => {
    if (!items || typeof items !== 'object') return { present: false, key: null, item: null };
    for (const [k, it] of Object.entries(items)) {
      const nk = normalizeKey(k);
      const isBonoCalzado = nk.includes('calzado') || nk.includes('zapato') || nk.includes('bonocalzado');
      if (isBonoCalzado) {
        const checked = Boolean(it?.checked);
        const hasQty = Number(it?.unidades) > 0;
        const hasVal = Number(it?.valor) > 0;
        if (checked || hasQty || hasVal) return { present: true, key: k, item: it };
        // Aunque no tenga qty/valor/checked, si existe el item lo consideramos presente
        return { present: true, key: k, item: it };
      }
    }
    return { present: false, key: null, item: null };
  };

  // Ubica una URL de factura válida en distintas propiedades
  const getFacturaUrl = (entrega) => {
    const candidates = [
      entrega?.facturaUrl,
      entrega?.factura_url,
      entrega?.factura,
      entrega?.archivos?.facturaUrl,
    ];
    for (const c of candidates) {
      if (isValidHttpUrl(c)) return c;
    }
    return '';
  };

  const updateFacturaState = (entregaId, { file, preview, error, loading }) => {
    if (file !== undefined) setFacturaFiles(prev => ({ ...prev, [entregaId]: file }));
    if (preview !== undefined) setFacturaPreviews(prev => ({ ...prev, [entregaId]: preview }));
    if (error !== undefined) setFacturaErrors(prev => ({ ...prev, [entregaId]: error }));
    if (loading !== undefined) setFacturaLoading(prev => ({ ...prev, [entregaId]: loading }));
  };

  const resetFacturaState = (entregaId) => {
    setFacturaFiles(p => { const x = { ...p }; delete x[entregaId]; return x; });
    setFacturaPreviews(p => { const x = { ...p }; delete x[entregaId]; return x; });
    setFacturaErrors(p => { const x = { ...p }; delete x[entregaId]; return x; });
    setFacturaLoading(p => { const x = { ...p }; delete x[entregaId]; return x; });
    setForceFactura(p => { const x = { ...p }; delete x[entregaId]; return x; });
  };

  // Optimiza imagen a WebP si es posible
  // ✅ REEMPLAZA TU FUNCIÓN imageFileToWebP COMPLETA
  // ✅ FUNCIÓN MEJORADA: Acepta cualquier archivo y límite de 2000KB
  const optimizeFile = async (file, maxSizeKB = 1500) => {  // Reducido a 1.5MB para mayor seguridad
    try {
      // Si no es imagen, devolver el archivo original si está dentro del límite
      if (!file.type.startsWith('image/')) {
        if (file.size <= maxSizeKB * 1024) {
          return file;
        } else {
          throw new Error('El archivo es demasiado grande (máximo 1.5MB para documentos)');
        }
      }
      
      // 🔥 DETECCIÓN DE iOS - Más agresivo para dispositivos Apple
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const iosSettings = {
        maxWidth: 600,        // Mucho más pequeño para iOS
        maxHeight: 800,       // Límite de altura también
        quality: 0.3,         // Calidad muy baja
        maxSizeKB: 1200       // Límite aún más estricto
      };
      
      const androidSettings = {
        maxWidth: 1000,
        maxHeight: 1200,
        quality: 0.5,
        maxSizeKB: maxSizeKB
      };
      
      const settings = isIOS ? iosSettings : androidSettings;
      
      console.log(`📱 Dispositivo detectado: ${isIOS ? 'iOS' : 'Android/Otros'}`);
      console.log(`📏 Archivo original: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      
      // 🔥 REDIMENSIONAMIENTO AGRESIVO
      let { width, height } = bitmap;
      
      // Calcular nuevas dimensiones respetando aspect ratio
      if (width > settings.maxWidth || height > settings.maxHeight) {
        const aspectRatio = width / height;
        
        if (width > height) {
          width = Math.min(width, settings.maxWidth);
          height = width / aspectRatio;
        } else {
          height = Math.min(height, settings.maxHeight);
          width = height * aspectRatio;
        }
        
        // Asegurar que ninguna dimensión exceda los límites
        if (width > settings.maxWidth) {
          width = settings.maxWidth;
          height = width / aspectRatio;
        }
        if (height > settings.maxHeight) {
          height = settings.maxHeight;
          width = height * aspectRatio;
        }
      }
      
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      
      const ctx = canvas.getContext('2d');
      
      // 🔥 OPTIMIZACIÓN DE CALIDAD DEL CANVAS
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';  // Baja calidad para menor tamaño
      
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      
      console.log(`📐 Redimensionado a: ${canvas.width}x${canvas.height}`);
      
      // 🔥 MÚLTIPLES INTENTOS CON CONFIGURACIONES CADA VEZ MÁS AGRESIVAS
      const compressionAttempts = [
        { quality: settings.quality, format: 'image/webp' },
        { quality: settings.quality * 0.7, format: 'image/webp' },
        { quality: settings.quality * 0.5, format: 'image/webp' },
        { quality: settings.quality * 0.3, format: 'image/jpeg' },  // JPEG para máxima compresión
        { quality: 0.1, format: 'image/jpeg' }  // Último recurso
      ];
      
      for (let i = 0; i < compressionAttempts.length; i++) {
        const { quality, format } = compressionAttempts[i];
        
        // Si es un intento desesperado, reducir aún más el tamaño
        if (i >= 3) {
          canvas.width *= 0.8;
          canvas.height *= 0.8;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          console.log(`🔥 Intento ${i + 1}: Reduciendo a ${canvas.width}x${canvas.height}`);
        }
        
        const blob = await new Promise((resolve) => 
          canvas.toBlob(resolve, format, quality)
        );
        
        if (blob && blob.size <= settings.maxSizeKB * 1024) {
          console.log(`✅ Compresión exitosa en intento ${i + 1}: ${(blob.size / 1024).toFixed(1)} KB (${format}, ${(quality * 100).toFixed(0)}% calidad)`);
          
          const extension = format === 'image/webp' ? '.webp' : '.jpg';
          return new File([blob], file.name.replace(/\.\w+$/, extension), { 
            type: format 
          });
        }
        
        console.log(`⚠️ Intento ${i + 1} falló: ${blob ? (blob.size / 1024).toFixed(1) : 'N/A'} KB`);
      }
      
      throw new Error(`No se pudo comprimir la imagen lo suficiente. Tamaño original: ${(file.size / 1024).toFixed(1)} KB. Intente con una imagen más pequeña o capture la foto desde más cerca.`);
      
    } catch (error) {
      console.error('❌ Error al optimizar archivo:', error);
      if (error.message.includes('No se pudo comprimir')) {
        throw error;  // Mantener el mensaje específico
      }
      throw new Error('Error al procesar el archivo. Intente capturar la foto nuevamente con menor resolución.');
    }
  };

  // ───────── Data fetch ─────────
  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setDotaciones([]);
    setLoading(true);

    const cleanedDocumento = documento.replace(/\D/g, '');
    try {
      const response = await fetch(`https://backend-dotacion.vercel.app/api/dotacion/${cleanedDocumento}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error al buscar las dotaciones (código ${response.status})`);
      }
      const data = await response.json();
      if (!Array.isArray(data.data)) throw new Error('Formato de datos inválido: se esperaba un arreglo');

      const parseEntregas = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
        return [];
      };

      const valid = data.data
        .filter(d => d && typeof d === 'object' && 'id' in d)
        .map(d => ({ ...d, entregas: parseEntregas(d.entregas) }));

      setDotaciones(valid);
      if (valid.length === 0) setError('No se encontraron dotaciones válidas para este documento');
    } catch (err) {
      setError(err.message || 'Error al buscar las dotaciones');
    } finally {
      setLoading(false);
    }
  };

  // ───────── Firma ─────────
  const handleFirmarEntrega = (dotacionId, entregaId) => {
    setSelectedDotacionId(dotacionId);
    setEntregaFirmando(entregaId);
    setShowSignatureModal(true);
    setSignatureError('');
    setAutorizaFirma(false);
    if (sigCanvasRef.current) sigCanvasRef.current.clear();
  };

  const handleSignatureClear = () => {
    sigCanvasRef.current.clear();
    setSignatureError('');
  };

  // Helper: convierte File a DataURL (base64)
  const fileToDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  // Subir factura al backend esperando body JSON { dotacionId, entregaId, factura: dataUrl }
  const uploadFacturaAndGetUrl = async (file, dotacionId, entregaId) => {
    // convertir a data URL (por ejemplo "data:image/webp;base64,....")
    const dataUrl = await fileToDataURL(file);

    const resp = await fetch('https://backend-dotacion.vercel.app/api/dotacion/factura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dotacionId,
        entregaId,
        factura: dataUrl,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.url) {
      console.error('Error backend:', data);
      throw new Error(data.error || data.details || 'Error al subir la factura');
    }
    return data.url;
  };

  const handleSignatureSubmit = async () => {
    // Validación básica de selección
    if (!selectedDotacionId || !entregaFirmando) {
      setSignatureError('No se ha seleccionado una entrega válida.');
      return;
    }

    const entrega = dotaciones
      .find(d => d.id === selectedDotacionId)
      ?.entregas.find(e => e.id === entregaFirmando);

    if (!entrega) {
      setSignatureError('No se encontró la entrega seleccionada.');
      return;
    }

    // Nota: ya no bloqueamos la firma si falta factura. Solo dejamos una advertencia visual.
    const bono = findBonoCalzadoItem(entrega?.items || {}).present;
    const facturaYaGuardada = getFacturaUrl(entrega);
    const manualOn = !!forceFactura[entregaFirmando];
    const requiereFactura = bono || manualOn;

    // si requiere factura pero no hay, mostramos un error en estado pero no impedimos firmar
    if (requiereFactura && !facturaFiles[entregaFirmando] && !isValidHttpUrl(facturaYaGuardada)) {
      updateFacturaState(entregaFirmando, { error: 'Recuerda que puedes adjuntar la factura después de firmar.' });
      // no hacemos return; permitimos la firma
    }

    if (!autorizaFirma) {
      setSignatureError('Debe aceptar la autorización de firma digital para continuar.');
      return;
    }

    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      setSignatureError('Por favor, dibuje su firma antes de confirmar.');
      return;
    }

    try {
      // No subimos la factura aquí — la subida se hace por separado con handleAdjuntarFactura
      const signatureData = sigCanvasRef.current.toDataURL('image/png');

      const response = await fetch('https://backend-dotacion.vercel.app/api/dotacion/confirmada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dotacionId: selectedDotacionId,
          entregaId: entregaFirmando,
          firma: signatureData,
          // no enviar facturaUrl aquí (se gestionará después)
        }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        setSignatureError(responseData.error || 'Error al guardar la firma');
        return;
      }

      // Actualizar estado local con la firma recibida (si el backend devolvió la URL en responseData)
      const firmaUrl = responseData?.data?.firma || responseData?.data?.firmaUrl || null;
      setDotaciones(prev =>
        prev.map(dotacion =>
          dotacion.id === selectedDotacionId
            ? {
                ...dotacion,
                entregas: dotacion.entregas.map(e =>
                  e.id === entregaFirmando ? { ...e, firma: firmaUrl || signatureData } : e
                ),
              }
            : dotacion
        )
      );

      setShowSignatureModal(false);
      setEntregaFirmando(null);
      resetFacturaState(entregaFirmando);
      setSignatureError('');
      alert('¡Firma registrada exitosamente!');

      // refrescar datos posteriormente
      setTimeout(() => {
        handleSearch({ preventDefault: () => {} });
      }, 400);
    } catch (err) {
      setSignatureError(err.message || 'No se pudo registrar la firma. Intente de nuevo.');
    } finally {
      updateFacturaState(entregaFirmando, { loading: false });
    }
  };

  // ───────── Factura (tarjeta) ─────────
  // ✅ VALIDACIÓN ACTUALIZADA para cualquier tipo de archivo
  const handleFacturaChange = (entregaId, e) => {
    const file = e.target.files?.[0];
    if (!file) {
      updateFacturaState(entregaId, { error: 'Por favor, seleccione un archivo.' });
      return;
    }
    
    // 🔥 LÍMITE MÁS ESTRICTO para iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const maxInputSize = isIOS ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // iOS: 10MB, Otros: 5MB
    
    if (file.size > maxInputSize) {
      updateFacturaState(entregaId, { 
        error: `El archivo es demasiado grande (máximo ${maxInputSize / (1024 * 1024)}MB). ${isIOS ? 'En iOS, intente capturar la foto con menor resolución o usar el formato HEIF optimizado.' : 'Por favor, seleccione un archivo más pequeño.'}` 
      });
      return;
    }
    
    // Mostrar información del dispositivo y archivo
    console.log(`📱 Dispositivo: ${isIOS ? 'iOS' : 'Otros'}`);
    console.log(`📁 Archivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type})`);
    
    updateFacturaState(entregaId, {
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      error: '',
    });
  };

  const handleAdjuntarFactura = async (dotacionId, entregaId) => {
    const file = facturaFiles[entregaId];
    if (!file) {
      updateFacturaState(entregaId, { error: 'Por favor, seleccione una factura antes de adjuntarla.' });
      return;
    }
    
    try {
      updateFacturaState(entregaId, { loading: true, error: '' });
      
      console.log(`🔄 Procesando archivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      
      // 🔥 LÍMITE MÁS ESTRICTO: 1.5MB para mayor compatibilidad
      const optimized = await optimizeFile(file, 1500);
      
      console.log(`✅ Archivo procesado: ${(optimized.size / 1024).toFixed(1)} KB`);
      
      // Verificar tamaño final con margen de seguridad
      if (optimized.size > 1600 * 1024) {  // > 1.6MB
        throw new Error('El archivo procesado aún es muy grande. Intente con una imagen capturada más de cerca o con menor resolución.');
      }
      
      const facturaUrl = await uploadFacturaAndGetUrl(optimized, dotacionId, entregaId);

      setDotaciones(prev =>
        prev.map(dotacion =>
          dotacion.id === dotacionId
            ? {
                ...dotacion,
                entregas: dotacion.entregas.map(entrega =>
                  entrega.id === entregaId ? { ...entrega, facturaUrl } : entrega
                ),
              }
            : dotacion
        )
      );

      alert('¡Factura adjuntada exitosamente!');
      resetFacturaState(entregaId);

      setTimeout(() => {
        handleSearch({ preventDefault: () => {} });
      }, 400);
      
    } catch (err) {
      console.error('❌ Error en handleAdjuntarFactura:', err);
      let errorMessage = 'No se pudo adjuntar la factura.';
      
      if (err.message.includes('too large') || err.message.includes('PayloadTooLargeError')) {
        errorMessage = 'La imagen es demasiado grande para el servidor. En iOS, intente: 1) Capturar la foto más de cerca, 2) Usar una app de compresión, 3) Tomar la foto en formato HEIF si está disponible.';
      } else if (err.message.includes('comprimir') || err.message.includes('procesar')) {
        errorMessage = err.message;
      } else if (err.message.includes('Error al subir')) {
        errorMessage = 'Error del servidor al subir la factura. La imagen puede ser demasiado grande incluso después de la compresión.';
      }
      
      updateFacturaState(entregaId, { error: errorMessage });
    } finally {
      updateFacturaState(entregaId, { loading: false });
    }
  };

  // ───────── UI ─────────
  return (
    <div className="ed-container">
      <h2 className="ed-title">Validar Dotación Entregada</h2>

      <form className="ed-form" onSubmit={handleSearch}>
        <label htmlFor="documento" className="ed-label">Número de Cédula:</label>
        <input
          type="text"
          id="documento"
          value={documento}
          onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
          placeholder="Ingrese su número de cédula"
          className="ed-input"
          required
        />
        <button type="submit" disabled={loading} className="ed-button">
          {loading ? 'Buscando...' : 'Buscar Dotación'}
        </button>
      </form>

      {error && <p className="ed-error">{error}</p>}

      {dotaciones.length > 0 ? (
        <div className="ed-dotacion-info">
          <h3 className="ed-subtitle">Historial de Dotaciones</h3>

          {dotaciones.map((dotacion) => (
            <div key={dotacion.id} className="ed-dotacion-item">
              <div className="ed-dotacion-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                    {dotacion.nombre || 'N/A'}
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9 }}>
                    {dotacion.empresa || 'N/A'}
                  </p>
                </div>
                <div className={`ed-status-badge ${dotacion.entregas.some(e => e.firma) ? 'ed-status-confirmed' : 'ed-status-pending'}`}>
                  {dotacion.entregas.some(e => e.firma) ? '✓ Confirmado' : '⏳ Pendiente'}
                </div>
              </div>

              <div className="ed-dotacion-info-grid">
                <div className="ed-info-item">
                  <span className="ed-info-label">Documento</span>
                  <span className="ed-info-value">{dotacion.documento || 'N/A'}</span>
                </div>
                <div className="ed-info-item">
                  <span className="ed-info-label">Sede</span>
                  <span className="ed-info-value">{dotacion.sede || 'N/A'}</span>
                </div>
                <div className="ed-info-item">
                  <span className="ed-info-label">Cargo</span>
                  <span className="ed-info-value">{dotacion.cargo || 'N/A'}</span>
                </div>
                <div className="ed-info-item">
                  <span className="ed-info-label">Fecha de Ingreso</span>
                  <span className="ed-info-value">{dotacion.fecha_ingreso || 'N/A'}</span>
                </div>
                <div className="ed-info-item">
                  <span className="ed-info-label">Tipo de Dotación</span>
                  <span className="ed-info-value">{dotacion.dotacion_tipo || 'N/A'}</span>
                </div>
              </div>

              <div className="ed-dotacion-entregas">
                <h4>Entregas realizadas</h4>
                {dotacion.entregas.length === 0 ? (
                  <p className="ed-no-results">No hay entregas registradas.</p>
                ) : (
                  dotacion.entregas.map((entrega) => {
                    const eId = entrega.id;
                    const bono = findBonoCalzadoItem(entrega.items || {}).present;
                    const urlFactura = getFacturaUrl(entrega);
                    const loadingFactura = Boolean(facturaLoading[eId]);
                    const errorFactura = facturaErrors[eId];
                    const previewFactura = facturaPreviews[eId];

                    const showFacturaSection = bono || forceFactura[eId];

                    return (
                      <div key={eId} className="ed-dotacion-entrega-card">
                        <div className="ed-entrega-header">
                          <div>
                            <span className="ed-entrega-date">📅 {entrega.fecha}</span>
                          </div>
                          <span className="ed-entrega-category">{entrega.categoria}</span>
                        </div>

                        <div className="ed-dotacion-items">
                          <h5>Elementos entregados</h5>
                          {renderEntregaItems(entrega.items)}
                        </div>

                        <div className="ed-signature-section">
                          <div className="ed-info-label">Estado de la firma</div>
                          {entrega.firma ? (
                            <div>
                              <span className="ed-status-badge ed-status-confirmed">✓ Firmado</span>
                              <img src={entrega.firma} alt="Firma" className="ed-signature-image" />
                            </div>
                          ) : (
                            <span className="ed-status-badge ed-status-pending">⏳ Sin confirmar</span>
                          )}
                        </div>

                        {/* Botón para abrir sección de factura si no se detecta bono */}
                        {!showFacturaSection && (
                          <div className="ed-factura-toggle">
                            <button
                              type="button"
                              className="ed-secondary-button"
                              onClick={() => setForceFactura(prev => ({ ...prev, [eId]: true }))}
                            >
                              Adjuntar factura de compra
                            </button>
                          </div>
                        )}

                        {/* FACTURA */}
                        {showFacturaSection && (
                          <div className="ed-factura-section">
                            <strong>Factura de compra de calzado:</strong>

                            {isValidHttpUrl(urlFactura) ? (
                              <>
                                <a href={urlFactura} target="_blank" rel="noopener noreferrer">
                                  <img src={urlFactura} alt="Factura" className="ed-factura-preview" />
                                </a>

                                {/* Permitir ACTUALIZAR */}
                                <div className="ed-factura-actions">
                                  <input
                                    type="file"
                                    accept="*/*"
                                    onChange={(e) => handleFacturaChange(eId, e)}
                                    disabled={loadingFactura}
                                  />
                                  {previewFactura && (
                                    <>
                                      <img src={previewFactura} alt="Factura preview" className="ed-factura-preview" />
                                      <button
                                        onClick={() => handleAdjuntarFactura(dotacion.id, eId)}
                                        className="ed-confirm-button"
                                        disabled={loadingFactura || !facturaFiles[eId]}
                                      >
                                        {loadingFactura ? 'Subiendo...' : 'Actualizar factura'}
                                      </button>
                                    </>
                                  )}
                                  {errorFactura && <p className="ed-error">{errorFactura}</p>}
                                </div>
                              </>
                            ) : (
                              <>
                                <input
                                  type="file"
                                  accept="*/*"
                                  onChange={(e) => handleFacturaChange(eId, e)}
                                  disabled={loadingFactura}
                                />
                                {previewFactura && (
                                  <>
                                    <img src={previewFactura} alt="Factura preview" className="ed-factura-preview" />
                                    <button
                                      onClick={() => handleAdjuntarFactura(dotacion.id, eId)}
                                      className="ed-confirm-button"
                                      disabled={loadingFactura || !facturaFiles[eId]}
                                    >
                                      {loadingFactura ? 'Subiendo...' : 'Confirmar factura'}
                                    </button>
                                  </>
                                )}
                                {errorFactura && <p className="ed-error">{errorFactura}</p>}
                              </>
                            )}
                          </div>
                        )}

                        <div className="ed-confirmation-section">
                          <button
                            onClick={() => handleFirmarEntrega(dotacion.id, eId)}
                            className="ed-confirm-button"
                            disabled={!!entrega.firma}
                          >
                            {entrega.firma ? 'Entrega Confirmada' : 'Confirmar Entrega'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading &&
        !error &&
        documento && (
          <p className="ed-no-results">No se encontraron dotaciones para este documento.</p>
        )
      )}

      {showSignatureModal && (
        <div className="ed-signature-modal">
          <div className="ed-signature-modal-content">
            <h3>Firma electrónica de recepción</h3>
            <p>Por favor, dibuje su firma para confirmar la entrega de la dotación.</p>

            {(() => {
              const entrega = dotaciones
                .find(d => d.id === selectedDotacionId)
                ?.entregas.find(e => e.id === entregaFirmando);

              if (!entrega) return null;

              const bono = findBonoCalzadoItem(entrega.items || {}).present;
              const manualOn = !!forceFactura[entregaFirmando];
              const requiereSeccion = bono || manualOn;

              const urlFactura = getFacturaUrl(entrega);
              const preview = facturaPreviews[entregaFirmando];
              const err = facturaErrors[entregaFirmando];
              const loadingUp = Boolean(facturaLoading[entregaFirmando]);

              return requiereSeccion ? (
                <div className="ed-factura-section">
                  <strong>Adjuntar factura de compra de calzado{bono ? ' (requerido por bono)' : ''}:</strong>

                  {isValidHttpUrl(urlFactura) ? (
                    <a href={urlFactura} target="_blank" rel="noopener noreferrer">
                      <img src={urlFactura} alt="Factura" className="ed-factura-preview" />
                    </a>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="*/*"
                        onChange={(e) => handleFacturaChange(entregaFirmando, e)}
                        disabled={loadingUp}
                      />
                      {preview && facturaFiles[entregaFirmando]?.type?.startsWith('image/') && <img src={preview} alt="Factura preview" className="ed-factura-preview" />}
                      {preview && !facturaFiles[entregaFirmando]?.type?.startsWith('image/') && (
                        <div className="ed-file-info">
                          <span>📄 {facturaFiles[entregaFirmando]?.name}</span>
                          <span>({(facturaFiles[entregaFirmando]?.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                      {err && <p className="ed-error">{err}</p>}
                    </>
                  )}
                </div>
              ) : (
                // Si el bono no se detectó y el usuario no forzó, ofrecemos habilitarlo aquí también
                <div className="ed-factura-toggle">
                  <button
                    type="button"
                    className="ed-secondary-button"
                    onClick={() => setForceFactura(prev => ({ ...prev, [entregaFirmando]: true }))}
                  >
                    Adjuntar factura de compra
                  </button>
                </div>
              );
            })()}

            {/* Autorización de firma digital */}
            <div className="ed-autoriza-firma">
              <label className="ed-autoriza-firma-label">
                <input
                  type="checkbox"
                  checked={autorizaFirma}
                  onChange={(e) => { setAutorizaFirma(e.target.checked); setSignatureError(''); }}
                  className="ed-autoriza-firma-checkbox"
                />
                <span>
                  Autorizo el uso de mi firma digital como constancia de recepción de la dotación entregada.
                  Declaro que he recibido los elementos descritos en buen estado y acepto las condiciones de uso.
                </span>
              </label>
            </div>

            <SignatureCanvas
              ref={sigCanvasRef}
              penColor="black"
              canvasProps={{ width: 400, height: 150, className: 'ed-signature-canvas' }}
            />

            {signatureError && <p className="ed-error">{signatureError}</p>}

            <div className="ed-signature-actions">
              <button onClick={handleSignatureClear}>Limpiar</button>
              <button onClick={handleSignatureSubmit}>Confirmar Firma</button>
              <button onClick={() => { setShowSignatureModal(false); setEntregaFirmando(null); setAutorizaFirma(false); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const renderEntregaItems = (items) => {
  if (!items) return <p className="ed-no-results">No hay elementos registrados</p>;
  
  return Object.entries(items).map(([key, item]) => (
    <div key={key} className="ed-dotacion-item-detail">
      <div>
        <div className="ed-item-name">
          {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
        </div>
        <div className="ed-item-details">
          {item.talla && item.talla.trim() !== '' && <span>Talla: {item.talla}</span>}
          {item.unidades && <span>Unidades: {item.unidades}</span>}
          {item.valor && <span>Valor: ${item.valor}</span>}
        </div>
      </div>
      {(item.checked || Number(item.unidades) > 0) && (
        <span className="ed-item-badge">Incluido</span>
      )}
    </div>
  ));
};

export { EmpleadoDotacion };
