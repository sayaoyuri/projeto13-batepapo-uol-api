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

app.post('/messages', (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;

  const schema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().allow('message', 'private_message').only().required()
  })

  const { error } = schema.validate({ from, to, text, type });
  if(error || !participants.map(user => user.name).includes(from)) return res.sendStatus(422);

  messages.push( { from, to, text, type, time: dayjs(Date.now()).format('HH:mm:ss') } );

  res.sendStatus(201);
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Server is running on http:/localhost:${PORT}/`));