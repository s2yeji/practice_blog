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

// jsonwebtoken
// 로그인 성공 시 토큰 발행(어떤 정보를 넣어서 발행할지 결정할 수 있음)
// 쿠키에 토큰 저장
// 토큰 정보를 header.ejs에 반영
// 로그아웃 시 쿠키 삭제
// 로그인 했을 때 ui를 다르게 할 수 있음
// 토큰 만료 시간 설정 가능
const jwt = require('jsonwebtoken');
const SECRET = process.env.SECRET_KEY;

// cookie-parser
// 쿠키 파싱
// 쿠키 생성 및 삭제
// 쿠키를 데이터에 저장
const cookieParser = require('cookie-parser');
app.use(cookieParser()) // cookieParser에 대한 미들웨어 혹은 라이브러리 내지는 서드파티

// 모든 요청에 대해 쿠키를 검사
// 토큰이 있다면 토큰을 해독해서 user 정도만 추출
// req.user 영역에 userId를 저장
app.use(async (req, res, next) => {
  const token = req.cookies.token;
  
  if(token){ // true인 경우 로그인 됨을 의미
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


// 업로드 디렉션이 없을 경우 만들어 낸다
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true});

const getDB = async () => {
  await client.connect()
  return client.db('blog')
}

app.get('/', async (req, res) => {
  // const user = req.user ? req.user : null;
  console.log("--------------", req.user);
  try{
    const db = await getDB();
    const posts = await db.collection('posts').find().toArray();
    res.render('index', {posts, user: req.user}) // 하나일 때 posts, 여러 개일 때 {posts: posts, ...}
  }catch(e){
    console.error(e);
  }
})

app.get('/write', (req, res) => {
  res.render('write', {user: req.user});
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
  // const user = req.user ? req.user : null;
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
      // 좋아요 기본값 세팅 
      await db.collection('like').insertOne({post_id: result.totalPost + 1, totalLike: 0, likeMember: []})
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
    const like = await db.collection('like').findOne({post_id: id});
    res.render('detail', {posts, user: req.user, like}) // 하나일 때 posts, 여러 개일 때 {posts: posts, ...}
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

// npm에서 bcrypt 참고하여 설치
const bcrypt = require('bcrypt');
const saltRounds = 10;

app.get('/signup', (req, res) => {
  res.render('signup', {user: req.user})
})

app.post('/signup', async (req, res) => {
  const { userId, pw, userName } = req.body
  console.log('가입 정보 확인', req.body);

  try{
    const hashedPw = await bcrypt.hash(pw, saltRounds); // 비밀번호 암호화
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
  const {userId, pw} = req.body; // 인풋 요소에서 받아온 것
  
  try{
    const db = await getDB();
    const user = await db.collection('users').findOne({userId});
    console.log('로그인 데이터', user);

    if(user){
      const compareResult = await bcrypt.compare(pw, user.pw);
      if(compareResult){
        const token = jwt.sign({userId: user.userId}, SECRET) // 토큰 발행
        res.cookie('token', token)
        res.redirect('/')
      } else {
        // 비밀번호가 맞지 않을 경우
        res.status(401).send()
      }
    } else {
      // 아이디가 없을 때
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
    }) // posts[0].userName = 닉네임, postUser = 아이디 노출
  }catch(e){
    console.error(e);
  }
})

// mypage
app.get('/mypage', (req, res) => {
  console.log(req.user);
  res.render('mypage', {user: req.user});
})

// like
// /like/2 post 요청이 들어오면 로그인된 userId
app.post('/like/:id', async (req, res)=>{
  const postId = parseInt(req.params.id); // 몇 번째 포스트를 클릭했는지 즉 포스트 아이디
  const userId = req.user.userId; // 로그인된 사용자
  try{
    const db = await getDB();
    const like = await db.collection('like').findOne({post_id: postId});
    if(like.likeMember.includes(userId)){ // 이미 좋아요를 누른 경우
      await db.collection('like').updateOne({post_id: postId}, {
        $inc: {totalLike: -1},
        $pull: {likeMember: userId}
      })
    } else { // 좋아요를 처음 누르는 경우
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
