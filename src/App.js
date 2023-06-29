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

setInterval( async () => {
  const time = (Date.now() - 10000);

  try {
    const inactiveUsers = await db.collection('participants').find({ lastStatus: { $lt: time } }).toArray();
    let del;

    if(inactiveUsers) del = await db.collection('participants').deleteMany({ lastStatus: { $lt: time} });
    if(del) {
      inactiveUsers.forEach( async user => {
        const messageObj = { 
          from: user.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs(time).format('HH:mm:ss')
        };
        await db.collection('messages').insertOne(messageObj);
      })
    }
  } catch (e) {
    console.log(e.message);
  }
}, 10000)

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

app.post('/status', async (req, res) => {
  const schema = Joi.object({ user: Joi.string().required() })
  const { user } = req.headers;

  const { error } = schema.validate({ user });
  if(error) return res.sendStatus(404);

  try {
    const ret = await db.collection('participants').findOne({ name: user });
    if(!ret) return res.sendStatus(404);
  } catch(e) {
    return res.sendStatus(500);
  }

  try {
    const ret = await db.collection('participants').updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    if(ret) return res.sendStatus(200);
  } catch(e) {
    res.sendStatus(500);
  }
})

app.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    res.send(participants);
  } catch(e) {
    res.sendStatus(500);
  }
})

app.get('/messages', async (req, res) => {
  const schema = Joi.object({ from: Joi.string().required(), limit: Joi.number().greater(0) })
  const from = req.headers.user;
  let { limit } = req.query;

  const { error } = schema.validate({ from, limit });
  if(error) return res.sendStatus(422);
  
  try {
    if(!limit) limit = 0;
    const constraints = [{ to: 'Todos' }, { from: from }, { to: from } ];

    const messages = await db.collection('messages').find({ $or: constraints }).sort({ _id: -1 }).limit(parseInt(limit)).toArray();
    res.send(messages);
  } catch (e) {
    console.log(e.message);
    res.sendStatus(500);
  }
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Server is running on http:/localhost:${PORT}/`));