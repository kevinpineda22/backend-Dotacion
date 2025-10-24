import supabase from "../supabase/cliente.js";

// Obtener todos los datos de dotaciones
export const obtenerTodosDatos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dotaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al obtener datos:", error);
      return res.status(500).json({ error: "Error al obtener datos", details: error.message });
    }

    return res.status(200).json({ data });
  } catch (error) {
    console.error("obtenerTodosDatos error:", error);
    return res.status(500).json({ error: "Error interno", details: error.message });
  }
};

// Obtener estadísticas generales
export const obtenerEstadisticas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dotaciones")
      .select("*");

    if (error) {
      console.error("Error al obtener estadísticas:", error);
      return res.status(500).json({ error: "Error al obtener estadísticas", details: error.message });
    }

    const estadisticas = {
      total: data.length,
      activos: data.filter(item => item.activo === true).length,
      inactivos: data.filter(item => item.activo === false).length,
      conDevolucion: data.filter(item => item.devolvio_dotacion === true).length,
      sinDevolucion: data.filter(item => item.devolvio_dotacion === false).length,
      porcentajeActivos: data.length > 0 ? ((data.filter(item => item.activo === true).length / data.length) * 100).toFixed(2) : 0
    };

    return res.status(200).json({ estadisticas });
  } catch (error) {
    console.error("obtenerEstadisticas error:", error);
    return res.status(500).json({ error: "Error interno", details: error.message });
  }
};

// Obtener datos filtrados por estado activo
export const obtenerPorEstado = async (req, res) => {
  try {
    const { activo } = req.params; // true o false
    const isActive = activo === 'true';

    const { data, error } = await supabase
      .from("dotaciones")
      .select("*")
      .eq("activo", isActive)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al filtrar por estado:", error);
      return res.status(500).json({ error: "Error al filtrar datos", details: error.message });
    }

    return res.status(200).json({ data });
  } catch (error) {
    console.error("obtenerPorEstado error:", error);
    return res.status(500).json({ error: "Error interno", details: error.message });
  }
};

// Obtener resumen por devoluciones
export const obtenerResumenDevoluciones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dotaciones")
      .select("devolvio_dotacion, activo, observacion_desactivacion");

    if (error) {
      console.error("Error al obtener resumen devoluciones:", error);
      return res.status(500).json({ error: "Error al obtener resumen", details: error.message });
    }

    const resumen = {
      totalConDevolucion: data.filter(item => item.devolvio_dotacion === true).length,
      totalSinDevolucion: data.filter(item => item.devolvio_dotacion === false).length,
      activosConDevolucion: data.filter(item => item.activo === true && item.devolvio_dotacion === true).length,
      inactivosConDevolucion: data.filter(item => item.activo === false && item.devolvio_dotacion === true).length,
      conObservaciones: data.filter(item => item.observacion_desactivacion && item.observacion_desactivacion.trim() !== "").length
    };

    return res.status(200).json({ resumen });
  } catch (error) {
    console.error("obtenerResumenDevoluciones error:", error);
    return res.status(500).json({ error: "Error interno", details: error.message });
  }
};
