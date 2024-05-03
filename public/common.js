const hd = document.querySelector('.hd');
const hamBtn = document.querySelector('.ham');
const darkmode = document.querySelector('.darkmode');

hamBtn.addEventListener('click', () => {
  hd.classList.toggle('on');
});

darkmode.addEventListener('click', (e) => {
  e.target.classList.toggle('on');
  document.body.classList.toggle('dark');
});
