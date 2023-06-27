import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';

import { messages, participants } from './mockData.js';

const app = express();
app.use(cors());
app.use(express.json());


app.post('/participants', (req, res) => {
  const schema = Joi.object({ name: Joi.string().alphanum().required() });
  const { name } = req.body;
  
  const { error } = schema.validate( { name } );
  if(error) return res.sendStatus(422);
  
  if(participants.map(user => user.name).includes(name)) return res.sendStatus(409);

  const time = Date.now();
  
  participants.push({ name, lastStatus: time });
  messages.push(
    { 
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs(time).format("HH:mm:ss")
    }
  );

  console.log(participants);
  
  res.sendStatus(201);
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Server is running on http:/localhost:${PORT}/`));