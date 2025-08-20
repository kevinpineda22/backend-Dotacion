
import supabase from "../supabase/cliente.js";

// Inicializar Supabase

// Endpoint para confirmar entrega de dotación con firma
export const confirmarDotacion = async (req, res) => {
  try {
    const { dotacionId, firma } = req.body;

    if (!dotacionId || !firma) {
      return res.status(400).json({
        error: 'El dotacionId y la firma son obligatorios',
      });
    }

    console.log('dotacionId recibido:', dotacionId);

    const fileName = `firma_${dotacionId}_${Date.now()}.png`;
    const base64Data = firma.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { data: storageData, error: storageError } = await supabase.storage
      .from('firmas')
      .upload(fileName, buffer, {
        contentType: 'image/png',
      });

    if (storageError) {
      console.error('Error en almacenamiento:', storageError);
      throw new Error(storageError.message);
    }

    const { publicUrl } = supabase.storage
      .from('firmas')
      .getPublicUrl(fileName);

    console.log('URL pública de la firma:', publicUrl);

    // Verificar si el registro existe
    const { data: checkData, error: checkError } = await supabase
      .from('dotaciones')
      .select('id')
      .eq('id', dotacionId);

    if (checkError) {
      console.error('Error al verificar el registro:', checkError);
      throw new Error(checkError.message);
    }
    if (!checkData || checkData.length === 0) {
      console.log('No se encontró el registro con id:', dotacionId);
      return res.status(404).json({
        error: 'No se encontró la dotación con el ID proporcionado',
      });
    }

    console.log('Registro encontrado:', checkData);

    const { data, error } = await supabase
      .from('dotaciones')
      .update({ firma: publicUrl })
      .eq('id', dotacionId)
      .select();

    if (error) {
      console.error('Error en la actualización:', error);
      throw new Error(error.message);
    }

    res.status(200).json({
      message: 'Firma registrada con éxito',
      data: data[0],
    });
  } catch (error) {
    console.error('Error al confirmar la dotación:', error);
    res.status(500).json({
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