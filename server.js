import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import FormularioDotacion from './routes/FormularioDotacion.js';
import ActasDotacion from './routes/ActasDotacion.js'; // <-- agregado


dotenv.config();
const app = express();

// Configurar CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json());
app.use('/api', FormularioDotacion);
app.use('/api', ActasDotacion); // <-- montar rutas de actas

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));

// Endpoint para verificar que el servidor está corriendo
app.get('/', (req, res) => {
  res.send('Backend funcionando');
});
