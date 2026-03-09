const dropZone = document.getElementById("dropZone");
const upload = document.getElementById("upload");
const originalCanvas = document.getElementById("originalCanvas");
const trimmedCanvas = document.getElementById("trimmedCanvas");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const stats = document.getElementById("stats");
const dropText = document.getElementById("dropText");

const oCtx = originalCanvas.getContext("2d");
const tCtx = trimmedCanvas.getContext("2d");

let currentFile = null;
let imageLoaded = false;
let trimmedDataURL = null;

function setStatus(text, type = "") {
  stats.className = type ? `stats ${type}` : "stats";
  stats.innerHTML = text;
}

/* --- UX: click/keyboard triggers el input --- */
dropZone.addEventListener("click", () => {
  // reset value para garantizar que change se dispare incluso con mismo archivo
  upload.value = "";
  upload.click();
});
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    upload.value = "";
    upload.click();
  }
});

/* --- Drag & drop UX --- */
["dragenter", "dragover"].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("highlight");
    e.dataTransfer && (e.dataTransfer.dropEffect = "copy");
  });
});
["dragleave", "dragend"].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("highlight");
  });
});
["dragover","drop"].forEach(name => {
  window.addEventListener(name, e => {
    e.preventDefault();
    e.stopPropagation();
  });
});
dropZone.addEventListener("drop", (e) => {
  dropZone.classList.remove("highlight");
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  loadFile(file);
});

/* input change */
upload.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    setStatus("No se seleccionó archivo.", "error");
    return;
  }
  // guardamos y limpiamos el valor para permitir re-selección
  loadFile(file);
  upload.value = "";
});

/* Reset */
resetBtn.addEventListener("click", () => {
  originalCanvas.width = originalCanvas.height = 0;
  trimmedCanvas.width = trimmedCanvas.height = 0;
  downloadBtn.disabled = true;
  resetBtn.disabled = true;
  processBtn.disabled = true;
  trimmedDataURL = null;
  currentFile = null;
  imageLoaded = false;
  setStatus("Sube un PNG para comenzar.");
});

/* Procesar manualmente */
processBtn.addEventListener("click", () => {
  if (!imageLoaded) {
    setStatus("No hay imagen cargada para procesar.", "error");
    return;
  }
  setStatus("Iniciando el Inador...");
  setTimeout(() => trimImage(), 120);
});

function loadFile(file) {
  if (!file) {
    setStatus("No se detectó archivo.", "error");
    return;
  }

  // validación tolerante: acepta por type o por extensión .png
  const isPNGbyType = file.type && file.type.toLowerCase() === "image/png";
  const isPNGbyName = file.name && file.name.toLowerCase().endsWith(".png");

  if (!isPNGbyType && !isPNGbyName) {
    setStatus("Por favor sube únicamente archivos PNG con transparencia.", "error");
    return;
  }

  currentFile = file;
  setStatus("Cargando imagen...");

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = URL.createObjectURL(file);

  img.onload = () => {
    URL.revokeObjectURL(img.src);
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    oCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    oCtx.drawImage(img, 0, 0);

    imageLoaded = true;
    trimmedDataURL = null;
    downloadBtn.disabled = true;
    resetBtn.disabled = false;
    processBtn.disabled = false;
    setStatus(`Imagen cargada: ${img.width}x${img.height}px — Presiona "Iniciar Inador" cuando quieras.`);
  };

  img.onerror = () => {
    setStatus("Error al cargar la imagen. ¿El archivo está dañado?", "error");
    currentFile = null;
    imageLoaded = false;
    processBtn.disabled = true;
  };
}

function trimImage() {
  if (!originalCanvas.width || !originalCanvas.height) {
    setStatus("Canvas vacío — no hay imagen para recortar.", "error");
    return;
  }

  const W = originalCanvas.width;
  const H = originalCanvas.height;
  const imageData = oCtx.getImageData(0, 0, W, H);
  const data = imageData.data;

  let top = null, left = null, right = null, bottom = null;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const alpha = data[idx + 3];
      if (alpha !== 0) {
        if (top === null) top = y;
        if (left === null || x < left) left = x;
        if (right === null || x > right) right = x;
        bottom = y;
      }
    }
  }

  if (top === null) {
    setStatus("La imagen no tiene píxeles no transparentes (todo transparente).", "error");
    return;
  }

  const width = right - left + 1;
  const height = bottom - top + 1;

  trimmedCanvas.width = width;
  trimmedCanvas.height = height;

  const cropped = oCtx.getImageData(left, top, width, height);
  tCtx.clearRect(0,0,width,height);
  tCtx.putImageData(cropped, 0, 0);

  trimmedDataURL = trimmedCanvas.toDataURL("image/png");
  downloadBtn.disabled = false;

  const originalArea = W * H;
  const newArea = width * height;
  const reduction = (((originalArea - newArea) / originalArea) * 100).toFixed(2);

  setStatus(
    `¡Listo! Original: ${W}x${H}px — Nuevo: ${width}x${height}px — Reducción de área: ${reduction}%`,
    "success"
  );
}

/* Descargar */
downloadBtn.addEventListener("click", () => {
  if (!trimmedDataURL) return;
  const link = document.createElement("a");
  link.href = trimmedDataURL;
  link.download = "recortado-inador.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
});