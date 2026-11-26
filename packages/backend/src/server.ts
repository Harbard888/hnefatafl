import express from 'express';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const app = express();
app.use(createApp());

if (process.env.WEB_DIST) {
  app.use(express.static(process.env.WEB_DIST));
}

app.listen(port, () => {
  console.log(`Hnefatafl listening on http://localhost:${port}`);
});
