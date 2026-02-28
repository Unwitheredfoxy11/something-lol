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
});