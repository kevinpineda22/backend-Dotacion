import supabase from "../supabase/cliente.js";

// Inicializar Supabase

// Helpers
const genId = () => {
  try { return crypto.randomUUID(); } catch (_) {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};
const isValidISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Normaliza items: unidades como número, talla string (o '')
const normalizeItems = (items = {}) =>
  Object.fromEntries(
    Object.entries(items).map(([k, v]) => [
      k,
      {
        talla: v?.talla ? String(v.talla) : '',
        unidades: Number(v?.unidades ?? 1) || 1,
      },
    ])
  );


// Endpoint para confirmar entrega de dotación con firma
export const confirmarDotacion = async (req, res) => {
  try {
    const { dotacionId, firma } = req.body;

    // Validar entrada
    if (!dotacionId || !firma) {
      console.error("Faltan datos: dotacionId o firma no proporcionados");
      return res.status(400).json({
        error: "El dotacionId y la firma son obligatorios",
      });
    }

    console.log("dotacionId recibido:", dotacionId);
    console.log("Tamaño de la firma (base64):", firma.length);

    // Subir la firma a Supabase Storage
    const fileName = `firma_${dotacionId}_${Date.now()}.png`;
    const base64Data = firma.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const { data: storageData, error: storageError } = await supabase.storage
      .from("firmas")
      .upload(fileName, buffer, {
        contentType: "image/png",
      });

    if (storageError) {
      console.error("Error al subir la firma a Storage:", storageError);
      return res.status(500).json({
        error: "Error al subir la firma a Storage",
        details: storageError.message,
      });
    }

    console.log("Firma subida exitosamente:", storageData);

    // Obtener la URL pública
    const { data: publicUrlData } = supabase.storage
      .from("firmas")
      .getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;
    if (!publicUrl) {
      console.error("No se pudo obtener la URL pública de la firma");
      return res.status(500).json({
        error: "No se pudo obtener la URL pública de la firma",
      });
    }
    console.log("URL pública de la firma:", publicUrl);

    // Verificar si el registro existe
    const { data: checkData, error: checkError } = await supabase
      .from("dotaciones")
      .select("id, documento, nombre, firma")
      .eq("id", dotacionId);

    if (checkError) {
      console.error("Error al verificar el registro:", checkError);
      return res.status(500).json({
        error: "Error al verificar el registro",
        details: checkError.message,
      });
    }
    if (!checkData || checkData.length === 0) {
      console.log("No se encontró el registro con id:", dotacionId);
      return res.status(404).json({
        error: "No se encontró la dotación con el ID proporcionado",
      });
    }

    console.log("Registro encontrado:", JSON.stringify(checkData, null, 2));

    // Verificar si ya existe una firma
    if (checkData[0].firma) {
      console.warn("El registro ya tiene una firma:", checkData[0].firma);
      return res.status(400).json({
        error: "La dotación ya tiene una firma registrada",
      });
    }

    // Actualizar el campo firma en la tabla dotaciones
    const { data: updateData, error: updateError } = await supabase
      .from("dotaciones")
      .update({ firma: publicUrl })
      .eq("id", dotacionId)
      .select();

    if (updateError) {
      console.error("Error al actualizar el campo firma:", updateError);
      return res.status(500).json({
        error: "Error al actualizar el campo firma",
        details: updateError.message,
      });
    }

    if (!updateData || updateData.length === 0) {
      console.error("No se devolvieron datos tras la actualización");
      return res.status(500).json({
        error: "No se pudo actualizar el registro",
      });
    }

    console.log(
      "Registro actualizado:",
      JSON.stringify(updateData[0], null, 2)
    );

    // Verificar que la URL se guardó correctamente
    const { data: verifyData, error: verifyError } = await supabase
      .from("dotaciones")
      .select("firma")
      .eq("id", dotacionId)
      .single();

    if (verifyError || !verifyData || !verifyData.firma) {
      console.error(
        "Error al verificar la actualización:",
        verifyError || "No se encontró la firma"
      );
      return res.status(500).json({
        error: "No se pudo verificar la actualización de la firma",
        details: verifyError ? verifyError.message : "No se encontró la firma",
      });
    }

    console.log("Firma verificada en la base de datos:", verifyData.firma);

    return res.status(200).json({
      message: "Firma registrada con éxito",
      data: updateData[0], // Devolver el registro actualizado
    });
  } catch (error) {
    console.error("Error al confirmar la dotación:", error);
    return res.status(500).json({
      error: "Error al registrar la firma",
      details: error.message,
    });
  }
};

export const crearDotacion = async (req, res) => {
  try {
    const formData = req.body;

    const requiredFields = [
      "nombre","empresa","documento","sede","cargo",
      "fechaIngreso","fechaEntrega","dotacionTipo","dotacion"
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return res.status(400).json({ error: `El campo ${field} es obligatorio` });
      }
    }

    const fecha_entrega = formData.fechaEntrega;
    if (!isValidISO(fecha_entrega)) {
      return res.status(400).json({ error: "fechaEntrega debe ser YYYY-MM-DD" });
    }

    // Calcula próxima entrega si no viene
    let proxima_entrega = formData.proxima_entrega;
    if (!proxima_entrega) {
      const d = new Date(fecha_entrega);
      const next = new Date(d.getFullYear(), d.getMonth() + 4, d.getDate());
      proxima_entrega = next.toISOString().slice(0, 10);
    }

    // Mapa del valor visible al key interno
    const dotacionTipoMap = {
      "Auxiliar Cárnico": "carnicero",
      "Auxiliar Fruver": "fruver",
      "Surtidor y Bodeguero": "surtidorBodeguero",
      "Domiciliario": "domiciliario",
      "Servicio Generales": "servicioGenerales",
      "Lider Punto": "liderPunto",
      "Administrativos": "administrativos",
    };
    const categoriaKey = dotacionTipoMap[formData.dotacionTipo] || formData.dotacionTipo;
    const catObj = formData.dotacion?.[categoriaKey] || {};

    // Construir items seleccionados para la entrega inicial (solo los checked)
    const inicialItems = {};
    for (const [k, v] of Object.entries(catObj)) {
      if (!v?.checked) continue;
      // bonoCalzado puede traer valor sin talla/unidades => guarda unidades=1
      const unidades = k === "bonoCalzado"
        ? 1
        : Number(v?.unidades ?? 1) || 1;
      inicialItems[k] = { talla: v?.talla ? String(v.talla) : "", unidades };
    }

    // Si no hay nada seleccionado, error controlado
    if (Object.keys(inicialItems).length === 0) {
      return res.status(400).json({
        error: "Debe seleccionar al menos un ítem para la dotación inicial"
      });
    }

    const entregaInicial = {
      id: genId(),
      tipo: "inicial",
      fecha: fecha_entrega,
      categoria: categoriaKey,
      items: normalizeItems(inicialItems),
      observacion: "",
    };

    const payload = {
      nombre: formData.nombre,
      empresa: formData.empresa,
      documento: formData.documento,
      sede: formData.sede,
      cargo: formData.cargo,
      fecha_ingreso: formData.fechaIngreso,
      fecha_entrega,
      dotacion_tipo: formData.dotacionTipo,
      dotacion: formData.dotacion,      // lo guardas como plantilla viva
      proxima_entrega,
      entregas: [entregaInicial],        // <<--- HISTORIAL arranca con la inicial
    };

    const { data, error } = await supabase
      .from("dotaciones")
      .insert([payload])
      .select();

    if (error) throw new Error(error.message);

    res.status(201).json({
      message: "Dotación registrada con éxito",
      data: data[0],
    });
  } catch (error) {
    console.error("Error al registrar la dotación:", error);
    res.status(500).json({
      error: "Error al registrar la dotación",
      details: error.message,
    });
  }
};


// Endpoint para obtener todas las dotaciones
export const obtenerDotaciones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dotaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.status(200).json({
      message: "Dotaciones obtenidas con éxito",
      data: data,
    });
  } catch (error) {
    console.error("Error al obtener las dotaciones:", error);
    res.status(500).json({
      error: "Error al obtener las dotaciones",
      details: error.message,
    });
  }
};

// Endpoint para buscar dotaciones por número de cédula
export const obtenerDotacionPorDocumento = async (req, res) => {
  try {
    const { documento } = req.params;
    console.log("Cédula recibida:", documento); // Depuración

    if (!documento) {
      return res.status(400).json({
        error: "El documento es obligatorio",
      });
    }

    const { data, error } = await supabase
      .from("dotaciones")
      .select("*")
      .eq("documento", documento);

    console.log("Datos devueltos por Supabase:", data); // Depuración

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        message: "No se encontraron dotaciones para este documento",
        data: [],
      });
    }

    res.status(200).json({
      message: "Dotaciones obtenidas con éxito",
      data: data,
    });
  } catch (error) {
    console.error("Error al obtener la dotación:", error);
    res.status(500).json({
      error: "Error al obtener la dotación",
      details: error.message,
    });
  }
};



// Endpoint para actualizar la dotación (modo seguro opcional)
export const actualizarDotacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { dotacion, entregas, fecha_entrega, proxima_entrega, mode, entregaId } = req.body;

    if (!id) return res.status(400).json({ error: "El ID de la dotación es obligatorio" });
    if (!dotacion && !entregas && !fecha_entrega && !proxima_entrega && !mode) {
      return res.status(400).json({ error: "Debe enviar algún campo para actualizar" });
    }

    // Si viene mode, hacemos merge server-side para no pisar historial:
    if (mode === 'appendEntrega') {
      req.body.entrega = entregas; // entregas=una entrega suelta
      return appendEntrega(req, res);
    }
    if (mode === 'updateEntregaById') {
      req.params.entregaId = entregaId;
      return updateEntrega(req, res);
    }

    // Modo reemplazo total (legacy): ¡PELIGROSO si no controlas concurrencia!
    const updateData = {};
    if (dotacion) updateData.dotacion = dotacion;
    if (entregas) updateData.entregas = Array.isArray(entregas) ? entregas.map(e => ({ ...e, items: normalizeItems(e.items) })) : entregas;
    if (fecha_entrega) updateData.fecha_entrega = fecha_entrega;
    if (proxima_entrega) updateData.proxima_entrega = proxima_entrega;

    const { data, error } = await supabase
      .from("dotaciones")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return res.status(404).json({ error: "Dotación no encontrada" });

    res.status(200).json({ message: "Dotación actualizada con éxito", data: data[0] });
  } catch (error) {
    console.error("Error al actualizar la dotación:", error);
    res.status(500).json({ error: "Error al actualizar la dotación", details: error.message });
  }
};


// Endpoint para agregar una nueva entrega de dotación
export const appendEntrega = async (req, res) => {
  try {
    const { id } = req.params;
    const { entrega, fecha_entrega, proxima_entrega } = req.body;
    // entrega = { id?, tipo: 'regular', fecha, categoria, items, observacion }

    if (!id || !entrega) {
      return res.status(400).json({ error: "id y entrega son obligatorios" });
    }

    const entregaToAdd = {
      id: entrega.id || genId(),
      tipo: entrega.tipo || "regular",
      fecha: entrega.fecha,
      categoria: entrega.categoria,
      items: normalizeItems(entrega.items || {}),
      observacion: entrega.observacion || "",
    };

    const { data: row, error: selErr } = await supabase
      .from("dotaciones")
      .select("entregas")
      .eq("id", id)
      .single();

    if (selErr) throw new Error(selErr.message);

    const actuales = Array.isArray(row?.entregas) ? row.entregas : [];
    const nuevas = [...actuales, entregaToAdd];

    const updateObj = { entregas: nuevas };
    if (fecha_entrega) updateObj.fecha_entrega = fecha_entrega;
    if (proxima_entrega) updateObj.proxima_entrega = proxima_entrega;

    const { data, error } = await supabase
      .from("dotaciones")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    res.json({ message: "Entrega agregada", data });
  } catch (error) {
    console.error("appendEntrega error:", error);
    res.status(500).json({ error: "No se pudo agregar la entrega", details: error.message });
  }
};

// Endpoint para actualizar una entrega específica dentro de una dotación
export const updateEntrega = async (req, res) => {
  try {
    const { id, entregaId } = req.params;
    const { items, observacion, fecha } = req.body;

    if (!id || !entregaId) {
      return res.status(400).json({ error: "id y entregaId son obligatorios" });
    }

    const { data: row, error: selErr } = await supabase
      .from("dotaciones")
      .select("entregas")
      .eq("id", id)
      .single();

    if (selErr) throw new Error(selErr.message);

    const actuales = Array.isArray(row?.entregas) ? row.entregas : [];
    const nuevas = actuales.map(e => {
      if (e.id !== entregaId) return e;
      return {
        ...e,
        items: items ? normalizeItems(items) : e.items,
        observacion: typeof observacion === "string" ? observacion : e.observacion,
        fecha: fecha || e.fecha,
      };
    });

    const { data, error } = await supabase
      .from("dotaciones")
      .update({ entregas: nuevas })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ message: "Entrega actualizada", data });
  } catch (error) {
    console.error("updateEntrega error:", error);
    res.status(500).json({ error: "No se pudo actualizar la entrega", details: error.message });
  }
};

