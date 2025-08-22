const fileElem = document.getElementById('fileElem');
const dropArea = document.getElementById('drop-area');
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const runBtn = document.getElementById('runBtn');
const resultArea = document.getElementById('result');
const status = document.getElementById('status');
const progressFill = document.getElementById('progressFill');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const preproc = document.getElementById('preproc');
const langSelect = document.getElementById('lang');

let currentImage = null;

// Drag & drop handlers
['dragenter','dragover','dragleave','drop'].forEach(ev=>{
  dropArea.addEventListener(ev, e => {
    e.preventDefault();
    e.stopPropagation();
  });
});

dropArea.addEventListener('drop', e => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFile(f);
});

dropArea.addEventListener('click', ()=> fileElem.click());
fileElem.addEventListener('change', e => {
  if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
});

function loadFile(file){
  if (!file.type.startsWith('image/')) {
    alert('Vui lòng chọn file ảnh.');
    return;
  }
  const reader = new FileReader();
  reader.onload = ()=> {
    const img = new Image();
    img.onload = ()=> {
      const maxW = 1200;
      let w = img.width, h = img.height;
      if (w > maxW) {
        const ratio = maxW / w;
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      currentImage = { img, w, h };
      status.innerText = 'Ảnh sẵn sàng';
      progressFill.style.width = '0%';
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// Simple preprocessing: grayscale + slight contrast
function preprocessImage() {
  if (!currentImage) return;
  const { w, h } = currentImage;
  const imageData = ctx.getImageData(0,0,w,h);
  const d = imageData.data;
  for (let i=0;i<d.length;i+=4){
    const r = d[i], g = d[i+1], b = d[i+2];
    const y = 0.299*r + 0.587*g + 0.114*b;
    d[i]=d[i+1]=d[i+2]=y;
    const factor = 1.05;
    d[i] = Math.max(0, Math.min(255, (d[i]-128)*factor +128));
    d[i+1] = Math.max(0, Math.min(255, (d[i+1]-128)*factor +128));
    d[i+2] = Math.max(0, Math.min(255, (d[i+2]-128)*factor +128));
  }
  ctx.putImageData(imageData,0,0);
}

// OCR function (Tesseract.js v4)
async function runOCR(){
  if (!currentImage) { alert('Chưa có ảnh.'); return; }
  if (!window.Tesseract) { alert('Tesseract chưa sẵn sàng.'); return; }

  runBtn.disabled = true;
  status.innerText = 'Đang nhận diện...';
  progressFill.style.width = '0%';
  resultArea.value = '';

  try {
    if (preproc.checked) preprocessImage();
    const lang = langSelect.value || 'eng';
    const dataUrl = canvas.toDataURL('image/png');

    const { data: { text } } = await Tesseract.recognize(
      dataUrl,
      lang,
      {
        logger: m => {
          if (m.status) status.innerText = m.status;
          if (m.progress) {
            const p = Math.round(m.progress * 100);
            progressFill.style.width = p + '%';
          }
        }
      }
    );

    resultArea.value = text.trim();
    status.innerText = 'Hoàn thành';
    progressFill.style.width = '100%';
  } catch (err) {
    console.error(err);
    alert('Lỗi khi OCR: ' + (err && err.message ? err.message : err));
    status.innerText = 'Lỗi';
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener('click', runOCR);

copyBtn.addEventListener('click', async ()=>{
  try {
    await navigator.clipboard.writeText(resultArea.value);
    alert('Đã copy vào clipboard');
  } catch {
    alert('Trình duyệt không hỗ trợ copy tự động');
  }
});

downloadBtn.addEventListener('click', ()=>{
  const text = resultArea.value || '';
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ocr-result.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', ()=>{
  ctx.clearRect(0,0,canvas.width,canvas.height);
  currentImage = null;
  resultArea.value = '';
  status.innerText = 'Đã xóa';
  progressFill.style.width = '0%';
});