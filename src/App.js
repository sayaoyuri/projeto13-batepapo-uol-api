import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const app = express();
app.use(cors());
app.use(express.json());

dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
  .then(() => db = mongoClient.db())
  .catch((e) => console.log(e.message));

app.post('/participants', async (req, res) => {
  const schema = Joi.object({ name: Joi.string().required() });
  const { name } = req.body;
  
  const { error } = schema.validate( { name } );
  if(error) return res.sendStatus(422);

  try {
    const checkName = await db.collection('participants').findOne({ name: name });
    if(checkName) return res.sendStatus(409); 
  } catch(e) {
    return res.sendStatus(500);
  }

  const time = Date.now();
  const participantObj = { name, lastStatus: time };
  
  db.collection('participants').insertOne(participantObj)
    .catch(() => { return res.sendStatus(500) });

  const messageObj = {
    from: name,
    to: 'Todos',
    text: 'entra na sala...',
    type: 'status',
    time: dayjs(time).format("HH:mm:ss")
  }

  db.collection('messages').insertOne(messageObj)
    .then(() => res.sendStatus(201))
    .catch(() => res.sendStatus(500));
})

app.post('/messages', async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;

  const schema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().allow('message', 'private_message').only().required()
  })

  const { error } = schema.validate({ from, to, text, type });
  let checkFrom;

  try {
    checkFrom = await db.collection('participants').findOne({ name: from })
  } catch(e) {
    return res.sendStatus(500);
  }

  if(error || !checkFrom) return res.sendStatus(422);

  const messageObj = { from, to, text, type, time: dayjs(Date.now()).format('HH:mm:ss') };

  db.collection('messages').insertOne(messageObj)
    .then(() => res.sendStatus(201))
    .catch(() => res.sendStatus(500));
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Server is running on http:/localhost:${PORT}/`));