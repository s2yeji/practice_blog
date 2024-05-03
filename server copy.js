require('dotenv').config()

const express = require('express');
const app = express();
const port = 8080;

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const {MongoClient} = require('mongodb') 
const uri = process.env.MONGO_URL;
const client = new MongoClient(uri)

const getDB = async () => {
  await client.connect()
  return client.db('blog')
}

app.get('/', (req, res) => {
  res.render('index');
})

app.get('/write', (req, res) => {
  res.render('write');
})

const fs = require('fs');
const uploadDir = 'public/uploads/';

if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const multer = require('multer');
const path = require('path');

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
  const { title, content, createAtDate } = req.body;
  const postImg = req.file ? req.file.filename : null;

  try {
      let db = await getDB();
      const result = await db.collection('counter').findOne({ name: 'counter' });
      await db.collection('posts').insertOne({
          _id: result.totalPost + 1,
          title,
          content,
          createAtDate,
          postImgPath: postImg ? `uploads/${postImg}` : null,
      });
      await db.collection('counter').updateOne({ name: 'counter' }, { $inc: { totalPost: 1 } });
      res.redirect('/');
  } catch (error) {
      console.log(error);
  }
});


app.listen(port, () => {
  console.log(` ====== ${port}`);
});
