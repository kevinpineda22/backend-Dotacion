
import supabase from "../supabase/cliente.js";

// Inicializar Supabase

// Endpoint para confirmar entrega de dotación con firma
export const confirmarDotacion = async (req, res) => {
  try {
    const { dotacionId, firma } = req.body;

    // Validar entrada
    if (!dotacionId || !firma) {
      console.error('Faltan datos: dotacionId o firma no proporcionados');
      return res.status(400).json({
        error: 'El dotacionId y la firma son obligatorios',
      });
    }

    console.log('dotacionId recibido:', dotacionId);
    console.log('Tamaño de la firma (base64):', firma.length);

    // Subir la firma a Supabase Storage
    const fileName = `firma_${dotacionId}_${Date.now()}.png`;
    const base64Data = firma.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { data: storageData, error: storageError } = await supabase.storage
      .from('firmas')
      .upload(fileName, buffer, {
        contentType: 'image/png',
      });

    if (storageError) {
      console.error('Error al subir la firma a Storage:', storageError);
      return res.status(500).json({
        error: 'Error al subir la firma a Storage',
        details: storageError.message,
      });
    }

    console.log('Firma subida exitosamente:', storageData);

    // Obtener la URL pública
    const { data: publicUrlData } = supabase.storage.from('firmas').getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;
    if (!publicUrl) {
      console.error('No se pudo obtener la URL pública de la firma');
      return res.status(500).json({
        error: 'No se pudo obtener la URL pública de la firma',
      });
    }
    console.log('URL pública de la firma:', publicUrl);

    // Verificar si el registro existe
    const { data: checkData, error: checkError } = await supabase
      .from('dotaciones')
      .select('id, documento, nombre, firma')
      .eq('id', dotacionId);

    if (checkError) {
      console.error('Error al verificar el registro:', checkError);
      return res.status(500).json({
        error: 'Error al verificar el registro',
        details: checkError.message,
      });
    }
    if (!checkData || checkData.length === 0) {
      console.log('No se encontró el registro con id:', dotacionId);
      return res.status(404).json({
        error: 'No se encontró la dotación con el ID proporcionado',
      });
    }

    console.log('Registro encontrado:', JSON.stringify(checkData, null, 2));

    // Verificar si ya existe una firma
    if (checkData[0].firma) {
      console.warn('El registro ya tiene una firma:', checkData[0].firma);
      return res.status(400).json({
        error: 'La dotación ya tiene una firma registrada',
      });
    }

    // Actualizar el campo firma en la tabla dotaciones
    const { data: updateData, error: updateError } = await supabase
      .from('dotaciones')
      .update({ firma: publicUrl })
      .eq('id', dotacionId)
      .select();

    if (updateError) {
      console.error('Error al actualizar el campo firma:', updateError);
      return res.status(500).json({
        error: 'Error al actualizar el campo firma',
        details: updateError.message,
      });
    }

    if (!updateData || updateData.length === 0) {
      console.error('No se devolvieron datos tras la actualización');
      return res.status(500).json({
        error: 'No se pudo actualizar el registro',
      });
    }

    console.log('Registro actualizado:', JSON.stringify(updateData[0], null, 2));

    // Verificar que la URL se guardó correctamente
    const { data: verifyData, error: verifyError } = await supabase
      .from('dotaciones')
      .select('firma')
      .eq('id', dotacionId)
      .single();

    if (verifyError || !verifyData || !verifyData.firma) {
      console.error('Error al verificar la actualización:', verifyError || 'No se encontró la firma');
      return res.status(500).json({
        error: 'No se pudo verificar la actualización de la firma',
        details: verifyError ? verifyError.message : 'No se encontró la firma',
      });
    }

    console.log('Firma verificada en la base de datos:', verifyData.firma);

    return res.status(200).json({
      message: 'Firma registrada con éxito',
      data: updateData[0], // Devolver el registro actualizado
    });
  } catch (error) {
    console.error('Error al confirmar la dotación:', error);
    return res.status(500).json({
      error: 'Error al registrar la firma',
      details: error.message,
    });
  }
};

export const crearDotacion = async (req, res) => {
  try {
    const formData = req.body;

    // Validar campos requeridos
    const requiredFields = [
      'nombre',
      'empresa',
      'documento',
      'sede',
      'cargo',
      'fechaIngreso',
      'fechaEntrega',
      'dotacionTipo',
      'dotacion',

    ];

    for (const field of requiredFields) {
      if (!formData[field]) {
        return res.status(400).json({
          error: `El campo ${field} es obligatorio`,
        });
      }
    }

    // Insertar datos en Supabase
    const { data, error } = await supabase
      .from('dotaciones')
      .insert([
        {
          nombre: formData.nombre,
          empresa: formData.empresa,
          documento: formData.documento,
          sede: formData.sede,
          cargo: formData.cargo,
          fecha_ingreso: formData.fechaIngreso,
          fecha_entrega: formData.fechaEntrega,
          dotacion_tipo: formData.dotacionTipo,
          dotacion: formData.dotacion,
          proxima_entrega: formData.proxima_entrega,

        },
      ])
      .select();

    if (error) {
      throw new Error(error.message);
    }

    res.status(201).json({
      message: 'Dotación registrada con éxito',
      data: data[0],
    });
  } catch (error) {
    console.error('Error al registrar la dotación:', error);
    res.status(500).json({
      error: 'Error al registrar la dotación',
      details: error.message,
    });
  }
};

export const obtenerDotaciones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dotaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.status(200).json({
      message: 'Dotaciones obtenidas con éxito',
      data: data,
    });
  } catch (error) {
    console.error('Error al obtener las dotaciones:', error);
    res.status(500).json({
      error: 'Error al obtener las dotaciones',
      details: error.message,
    });
  }
};


// Endpoint para buscar dotaciones por número de cédula
export const obtenerDotacionPorDocumento = async (req, res) => {
  try {
    const { documento } = req.params;
    console.log('Cédula recibida:', documento); // Depuración

    if (!documento) {
      return res.status(400).json({
        error: 'El documento es obligatorio',
      });
    }

    const { data, error } = await supabase
      .from('dotaciones')
      .select('*')
      .eq('documento', documento);

    console.log('Datos devueltos por Supabase:', data); // Depuración

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        message: 'No se encontraron dotaciones para este documento',
        data: [],
      });
    }

    res.status(200).json({
      message: 'Dotaciones obtenidas con éxito',
      data: data,
    });
  } catch (error) {
    console.error('Error al obtener la dotación:', error);
    res.status(500).json({
      error: 'Error al obtener la dotación',
      details: error.message,
    });
  }
};