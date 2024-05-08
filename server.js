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

const methodOverride = require('method-override')
app.use(methodOverride('_method'))

const jwt = require('jsonwebtoken');
const SECRET = process.env.SECRET_KEY;

const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.use(async (req, res, next) => {
  const token = req.cookies.token;
  
  if(token){ 
    try{
      const data = jwt.verify(token, SECRET);
      const db = await getDB();
      const user = await db.collection('users').findOne({userId: data.userId});
      req.user = user ? user : null;
    }catch(e){
      console.error(e);
    }
  }
  next();
})


if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true});

const getDB = async () => {
  await client.connect()
  return client.db('blog')
}

app.get('/', async (req, res) => {
  try{
    const db = await getDB();
    const posts = await db.collection('posts').find().toArray();
    res.render('index', {posts, user: req.user})
  }catch(e){
    console.error(e);
  }
})

app.get('/write', (req, res) => {
  res.render('write', {user: req.user});
})

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, uploadDir); 
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage });

app.post('/write', upload.single('postImg'), async (req, res) => {
  const { title, content, date, userId } = req.body;
  const postImg = req.file ? req.file.filename : null;

  try {
      let db = await getDB();
      const result = await db.collection('counter').findOne({ name: 'counter' });
      await db.collection('posts').insertOne({
          _id: result.totalPost + 1,
          title,
          content,
          userId: req.user.userId,
          userName: req.user.userName,
          date,
          postImgPath: postImg ? `/uploads/${postImg}` : null,
      });
      await db.collection('counter').updateOne({ name: 'counter' }, { $inc: { totalPost: 1 } });
      await db.collection('like').insertOne({post_id: result.totalPost + 1, totalLike: 0, likeMember: []})
      res.redirect('/');
  } catch (error) {
      console.log(error);
  }
});

// detail
app.get('/detail/:id', async (req, res) => {
  let id = parseInt(req.params.id);
  try{
    const db = await getDB();
    const posts = await db.collection('posts').findOne({_id: id});
    const like = await db.collection('like').findOne({post_id: id});
    res.render('detail', {posts, user: req.user, like});
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
  const user = req.user ? req.user : null;
  let id = parseInt(req.params.id)
  try{
    const db = await getDB()
    const posts = await db.collection('posts').findOne({_id: id})
    res.render('edit', {posts, user: req.user}) 
  }catch(e){
    console.error(e)
  }
})

// /edit post 요청 왔을 때
app.post('/edit', upload.single('postImg'), async (req, res) => {
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

// npm에서 bcrypt 참고하여 설치
const bcrypt = require('bcrypt');
const saltRounds = 10;

app.get('/signup', (req, res) => {
  res.render('signup', {user: req.user})
})

app.post('/signup', async (req, res) => {
  const { userId, pw, userName } = req.body;

  try{
    const hashedPw = await bcrypt.hash(pw, saltRounds);
    const db = await getDB();
    await db.collection('users').insertOne({
      userId,
      pw: hashedPw,
      userName
    })
    res.redirect('/login')
  }catch(e){
    console.error(e);
  }
})

// login
app.get('/login', async (req, res) => {
  res.render('login', {user: req.user})
})

app.post('/login', async (req, res) => {
  const {userId, pw} = req.body; 
  
  try{
    const db = await getDB();
    const user = await db.collection('users').findOne({userId});

    if(user){
      const compareResult = await bcrypt.compare(pw, user.pw);
      if(compareResult){
        const token = jwt.sign({userId: user.userId}, SECRET);
        res.cookie('token', token)
        res.redirect('/')
      } else {
        res.status(401).send()
      }
    } else {
      res.status(404).send()
    }
  }catch(e){
    console.error(e);
  }
})

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
})

// personal
app.get('/personal/:userId', async (req, res) => {
  const postUser = req.params.userId;
  try{
    const db = await getDB();
    const user = await db.collection('users').findOne({ userId: postUser });
    const posts = await db.collection('posts').find({userId: postUser}).toArray();
    console.log(postUser, posts);
    res.render('personal', {
      posts, 
      user: req.user, 
      userName: user.userName, 
      postUser
    })
  }catch(e){
    console.error(e);
  }
})

// mypage
app.get('/mypage', (req, res) => {
  res.render('mypage', {user: req.user});
})

// like
app.post('/like/:id', async (req, res)=>{
  const postId = parseInt(req.params.id); 
  const userId = req.user.userId;
  try{
    const db = await getDB();
    const like = await db.collection('like').findOne({post_id: postId});
    if(like.likeMember.includes(userId)){
      await db.collection('like').updateOne({post_id: postId}, {
        $inc: {totalLike: -1},
        $pull: {likeMember: userId}
      })
    } else {
      await db.collection('like').updateOne({post_id: postId}, {
        $inc: {totalLike: 1},
        $push: {likeMember: userId}
      })
    }
    res.redirect('/detail/' + postId)
  }catch(e){
    console.error(e)
  }
})

app.listen(port, () => {
  console.log(`서버 실행 중 ${port}`);
});
