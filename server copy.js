require('dotenv').config()

const express = require('express')
const app = express()
const port = process.env.PORT

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.use(express.json())
app.use(express.urlencoded({extended: true}))

const { MongoClient } = require('mongodb') 
const uri = process.env.MONGO_URL
const client = new MongoClient(uri)

const fs = require('fs')
const uploadDir = 'public/uploads/'

const multer = require('multer');
const path = require('path');

// methodOverride
const methodOverride = require('method-override')
app.use(methodOverride('_method'))

// 업로드 디렉션이 없을 경우 만들어 낸다
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true});

const getDB = async () => {
  await client.connect()
  return client.db('blog')
}

app.get('/', async (req, res) => {
  try{
    const db = await getDB();
    const posts = await db.collection('posts').find().toArray();
    res.render('index', {posts}) // 하나일 때 posts, 여러 개일 때 {posts: posts, ...}
  }catch(e){
    console.error(e);
  }
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
          postImgPath: postImg ? `/uploads/${postImg}` : null,
      });
      await db.collection('counter').updateOne({ name: 'counter' }, { $inc: { totalPost: 1 } });
      res.redirect('/');
  } catch (error) {
      console.log(error);
  }
});

// detail
app.get('/detail/:id', async (req, res) => {
  console.log(req.params.id);
  let id = parseInt(req.params.id);
  try{
    const db = await getDB();
    const posts = await db.collection('posts').findOne({_id: id});
    console.log(posts);
    res.render('detail', {posts}) // 하나일 때 posts, 여러 개일 때 {posts: posts, ...}
  }catch(e){
    console.error(e);
  }
})

// delete
app.post('/delete/:id', async (req, res) => {
  let id = parseInt(req.params.id)
  try{
    const db = await getDB()
    await db.collection('posts').deleteOne({_id: id})
    res.redirect('/')
  }catch(e){
    console.error(e);
  }
})

// edit 페이지로 데이터 바인딩
app.get('/edit/:id', async (req, res) => {
  let id = parseInt(req.params.id)
  try{
    const db = await getDB()
    const posts = await db.collection('posts').findOne({_id: id})
    res.render('edit', {posts}) 
  }catch(e){
    console.error(e)
  }
})

// /edit post 요청 왔을 때
app.post('/edit', upload.single('postImg'), async (req, res) => {
  console.log("----------", req.body)
  const {id, title, content, date} = req.body
  const postImgOld = req.body.postImgOld.replace('uploads/', '')
  const postImg = req.file ? req.file.filename : postImgOld

  try{
    const db = await getDB()
    await db.collection('posts').updateOne({_id: parseInt(id)}, {
      $set: {
        title, 
        content, 
        date, 
        postImgPath: postImg ? `/uploads/${postImg}` : null,
      }
    })
    res.redirect('/')
  }catch(e){
    console.error(e)
  }
})

app.listen(port, () => {
  console.log(`====== ${port}`);
});
