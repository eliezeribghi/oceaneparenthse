import express from 'express';
import compression from 'compression'; // Importez le module compression



const app = express();

// Utilisez le middleware compression
app.use(compression());

