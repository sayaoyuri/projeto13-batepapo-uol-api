import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { stripHtml } from "string-strip-html";
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
    if(del.deletedCount > 0) {
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
}, 10000);

app.post('/participants', async (req, res) => {
  const schema = Joi.object({ name: Joi.string().required() });
  let name;
  try {
    name = stripHtml(req.body.name).result.trim();
  } catch(e) {
    return res.sendStatus(422);
  }

  const { error } = schema.validate( { name } );
  if(error) return res.sendStatus(422);

  try {
    const activeUser = await db.collection('participants').findOne({ name: name });
    if(activeUser) return res.sendStatus(409); 
  } catch(e) {
    return res.sendStatus(500);
  }

  const time = Date.now();
  const participantObj = { name, lastStatus: time };

  await db.collection('participants').insertOne(participantObj).catch(() => { return res.sendStatus(500) });

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
  const schema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().allow('message', 'private_message').only().required()
  })

  const requestData = {};
  try {
    requestData.from = stripHtml(req.headers.user).result.trim();
    requestData.to = stripHtml(req.body.to).result.trim();
    requestData.text = stripHtml(req.body.text).result.trim();
    requestData.type = stripHtml(req.body.type).result.trim();
  } catch(e) {
    return res.sendStatus(422);
  }

  const { error } = schema.validate(requestData);
  if(error) return res.sendStatus(422);

  try {
    const activeUser = await db.collection('participants').findOne({ name: requestData.from });
    if(!activeUser) return res.sendStatus(422);
  } catch(e) {
    return res.sendStatus(500);
  }

  requestData.time = dayjs(Date.now()).format('HH:mm:ss');

  db.collection('messages').insertOne(requestData)
    .then(() => res.sendStatus(201))
    .catch(() => res.sendStatus(500));
})

app.post('/status', async (req, res) => {
  const schema = Joi.object({ user: Joi.string().required() })
  let user;
  try {
    user = stripHtml(req.headers.user).result.trim();
  } catch (e) {
    return res.sendStatus(422);
  }

  const { error } = schema.validate({ user });
  if(error) return res.sendStatus(404);

  try {
    const result = await db.collection('participants').findOne({ name: user });
    if(!result) return res.sendStatus(404);
  } catch(e) {
    return res.sendStatus(500);
  }

  try {
    const result = await db.collection('participants').updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    if(result) return res.sendStatus(200);
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
});

app.delete('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const schema = Joi.object({ user: Joi.string().required(), id: Joi.string().min(24).max(24).required() });

  const requestData = {};
  try {
    requestData.id  = stripHtml(req.params.ID_DA_MENSAGEM).result.trim();
    requestData.user = stripHtml(req.headers.user).result.trim();
  } catch(e) {
    return res.sendStatus(422);
  }

  const { error } = schema.validate(requestData);
  if(error) return res.sendStatus(422);

  try{
    const msg = await db.collection('messages').findOne({ _id: new ObjectId(requestData.id) });
    if(!msg) return res.sendStatus(404);
    if(msg.from !== requestData.user) return res.sendStatus(401);

   await db.collection('messages').deleteOne({ _id: new ObjectId(requestData.id) });
    return res.send();
  } catch(e) {
    return res.sendStatus(500);
  }
})

app.put('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const requestData = {};
  try{
    requestData.from = stripHtml(req.headers.user).result.trim();
    requestData.to = stripHtml(req.body.to).result.trim();
    requestData.text = stripHtml(req.body.text).result.trim();
    requestData.type = stripHtml(req.body.type).result.trim();
    requestData.msgId = stripHtml(req.params.ID_DA_MENSAGEM).result.trim();
  } catch(e) {
    return res.sendStatus(422);
  }
  const schema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().allow('message', 'private_message').only().required(),
    msgId: Joi.string().min(24).max(24).required()
  })

  const { error } = schema.validate(requestData);
  const activeUser = await db.collection('participants').findOne({ name: requestData.from });
  if(error || !activeUser) return res.sendStatus(422);

  const msg = await db.collection('messages').findOne({ _id: new ObjectId(requestData.msgId) });
  if(!msg) return res.sendStatus(404);
  if(msg.from !== requestData.from) return res.sendStatus(401);
  try {
    const result = await db.collection('messages').updateOne(
      { _id: new ObjectId(requestData.msgId) },
       { $set: { to: requestData.to, text: requestData.text, type: requestData.type } }
    );
    if(result.modifiedCount === 1) return res.send();
  } catch(e) {
    return res.sendStatus(500);
  }
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Server is running on http:/localhost:${PORT}/`));