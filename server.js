require('dotenv').config()

const express = require('express');
const app = express();
const port = process.env.PORT;

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const {MongoClient} = require('mongodb') 
const uri = process.env.MONGO_URL;
const client = new MongoClient(uri)

const fs = require('fs');
const uploadDir = 'public/uploads/';

const multer = require('multer');
const path = require('path');

if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true});

const getDB = async () => {
  await client.connect()
  return client.db('blog')
}

app.get('/', async (req, res) => {
  try{
    const db = await getDB();
    const posts = await db.collection('posts').find().toArray();
    console.log(posts);

    res.render('index', {posts}) // 하나일 때 posts, 여러 개일 때 {posts, ...}
  }catch(e){
    console.error(e);
  }
})

app.get('/', (req, res) => {
  res.render('index');
})

app.get('/write', (req, res) => {
  res.render('write');
})

// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, uploadDir); // 파일이 저장될 경로를 지정
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); // 파일 이름 설정
  }
});

const upload = multer({ storage: storage });

app.post('/write', upload.single('postImg'), async (req, res) => {
  const { title, content, date } = req.body;
  const postImg = req.file ? req.file.filename : null;

  try {
      let db = await getDB();
      const result = await db.collection('counter').findOne({ name: 'counter' });
      await db.collection('posts').insertOne({
          _id: result.totalPost + 1,
          title,
          content,
          date,
          postImgPath: postImg ? `uploads/${postImg}` : null,
      });
      await db.collection('counter').updateOne({ name: 'counter' }, { $inc: { totalPost: 1 } });
      res.redirect('/');
  } catch (error) {
      console.log(error);
  }
});

app.get('/detail/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  try{
    const db = await getDB();
    const post = await db.collection('posts').findOne({_id: id})
    res.render('detail', {post});
  }catch(error){
    console.error(error)
  }
});

app.get('/edit/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  try{
    const db = await getDB()
    const post = await db.collection('posts').findOne({_id: id})
    res.render('edit', {post})
  }catch(error){
    console.error(error)
  }
})

app.post('/delete', async (req, res) => {
  const id = parseInt(req.body.postNum)
  console.log(id)
  try{
    const db = await getDB()
    await db.collection('posts').deleteOne({_id: id})
    res.redirect('/')
  }catch(error){
    console.error(error)
  }
})

app.listen(port, () => {
  console.log(` ====== ${port}`);
});
