const upload = document.getElementById("upload");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const downloadBtn = document.getElementById("downloadBtn");

let croppedImageData = null;

upload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    trimCanvas();
  };
});

function trimCanvas() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let top = null, left = null, right = null, bottom = null;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const alpha = data[index + 3];

      if (alpha !== 0) {
        if (top === null) top = y;
        if (left === null || x < left) left = x;
        if (right === null || x > right) right = x;
        bottom = y;
      }
    }
  }

  if (top === null) return;

  const width = right - left + 1;
  const height = bottom - top + 1;

  const cropped = ctx.getImageData(left, top, width, height);

  canvas.width = width;
  canvas.height = height;
  ctx.putImageData(cropped, 0, 0);

  croppedImageData = canvas.toDataURL("image/png");
  downloadBtn.disabled = false;
}

downloadBtn.addEventListener("click", () => {
  if (!croppedImageData) return;

  const link = document.createElement("a");
  link.href = croppedImageData;
  link.download = "trimmed.png";
  link.click();
});const dropZone = document.getElementById("dropZone");
const upload = document.getElementById("upload");
const originalCanvas = document.getElementById("originalCanvas");
const trimmedCanvas = document.getElementById("trimmedCanvas");
const downloadBtn = document.getElementById("downloadBtn");
const stats = document.getElementById("stats");

const oCtx = originalCanvas.getContext("2d");
const tCtx = trimmedCanvas.getContext("2d");

let trimmedDataURL = null;

dropZone.addEventListener("click", () => upload.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.background = "rgba(59, 130, 246, 0.2)";
});

dropZone.addEventListener("dragleave", () => {
  dropZone.style.background = "transparent";
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.background = "transparent";
  handleFile(e.dataTransfer.files[0]);
});

upload.addEventListener("change", (e) => {
  handleFile(e.target.files[0]);
});

function handleFile(file) {
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = () => {
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    oCtx.drawImage(img, 0, 0);

    trimImage();
  };
}

function trimImage() {
  const imageData = oCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
  const data = imageData.data;

  let top = null, left = null, right = null, bottom = null;

  for (let y = 0; y < originalCanvas.height; y++) {
    for (let x = 0; x < originalCanvas.width; x++) {
      const index = (y * originalCanvas.width + x) * 4;
      const alpha = data[index + 3];

      if (alpha !== 0) {
        if (top === null) top = y;
        if (left === null || x < left) left = x;
        if (right === null || x > right) right = x;
        bottom = y;
      }
    }
  }

  if (top === null) return;

  const width = right - left + 1;
  const height = bottom - top + 1;

  trimmedCanvas.width = width;
  trimmedCanvas.height = height;

  const cropped = oCtx.getImageData(left, top, width, height);
  tCtx.putImageData(cropped, 0, 0);

  trimmedDataURL = trimmedCanvas.toDataURL("image/png");
  downloadBtn.disabled = false;

  const originalArea = originalCanvas.width * originalCanvas.height;
  const newArea = width * height;
  const reduction = (((originalArea - newArea) / originalArea) * 100).toFixed(2);

  stats.innerHTML = `
    Original: ${originalCanvas.width}x${originalCanvas.height} px<br>
    Nuevo: ${width}x${height} px<br>
    Reducción de área: ${reduction}%
  `;
}

downloadBtn.addEventListener("click", () => {
  if (!trimmedDataURL) return;

  const link = document.createElement("a");
  link.href = trimmedDataURL;
  link.download = "recortado-inador.png";
  link.click();
});