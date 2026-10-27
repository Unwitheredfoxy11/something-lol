const dropZone = document.getElementById("dropZone");
const upload = document.getElementById("upload");
const originalCanvas = document.getElementById("originalCanvas");
const trimmedCanvas = document.getElementById("trimmedCanvas");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const stats = document.getElementById("stats");
const fileSummary = document.getElementById("fileSummary");

const oCtx = originalCanvas.getContext("2d", { willReadFrequently: true });
const tCtx = trimmedCanvas.getContext("2d");

let selectedFiles = [];
let processedFiles = [];
let processing = false;

function setStatus(message, type = "") {
  stats.className = type ? `stats ${type}` : "stats";
  stats.textContent = message;
}

function isPng(file) {
  return file.name.toLowerCase().endsWith(".png") ||
    (file.type && file.type.toLowerCase() === "image/png");
}

function isZip(file) {
  return file.name.toLowerCase().endsWith(".zip") ||
    (file.type && /application\/(zip|x-zip-compressed)/i.test(file.type));
}

function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  if (!incoming.length) return;

  selectedFiles = incoming;
  processedFiles = [];
  downloadBtn.disabled = true;
  processBtn.disabled = false;
  resetBtn.disabled = false;
  trimmedCanvas.width = trimmedCanvas.height = 0;
  originalCanvas.width = originalCanvas.height = 0;

  fileSummary.textContent = selectedFiles.length === 1
    ? `1 archivo seleccionado: ${selectedFiles[0].name}`
    : `${selectedFiles.length} archivos seleccionados`;

  setStatus("Archivos listos. Presiona «Iniciar Inador» para procesarlos.");
}

dropZone.addEventListener("click", (event) => {
  // El input invisible cubre la zona y abre el selector de archivos.
  if (event.target !== upload) upload.click();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    upload.click();
  }
});

upload.addEventListener("change", () => {
  addFiles(upload.files);
  // Permite volver a elegir exactamente los mismos archivos.
  upload.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add("highlight");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });
});

["dragleave", "dragend"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("highlight");
  });
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.remove("highlight");
  addFiles(event.dataTransfer.files);
});

window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

resetBtn.addEventListener("click", () => {
  selectedFiles = [];
  processedFiles = [];
  originalCanvas.width = originalCanvas.height = 0;
  trimmedCanvas.width = trimmedCanvas.height = 0;
  upload.value = "";
  fileSummary.textContent = "Todavía no hay archivos seleccionados.";
  processBtn.disabled = true;
  downloadBtn.disabled = true;
  resetBtn.disabled = true;
  setStatus("Selecciona tus archivos y presiona «Iniciar Inador».");
});

processBtn.addEventListener("click", processSelection);

async function processSelection() {
  if (processing || !selectedFiles.length) return;
  if (typeof JSZip === "undefined") {
    setStatus("No se pudo cargar el lector ZIP. Comprueba tu conexión y recarga la página.", "error");
    return;
  }

  processing = true;
  processBtn.disabled = true;
  downloadBtn.disabled = true;
  processedFiles = [];

  try {
    const pngJobs = [];

    for (const file of selectedFiles) {
      if (isPng(file)) {
        pngJobs.push({ file, name: file.name });
      } else if (isZip(file)) {
        setStatus(`Abriendo ZIP: ${file.name}...`);
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(entry =>
          !entry.dir && entry.name.toLowerCase().endsWith(".png")
        );

        for (const entry of entries) {
          const blob = await entry.async("blob");
          const pngFile = new File([blob], entry.name.split("/").pop(), { type: "image/png" });
          pngJobs.push({ file: pngFile, name: entry.name });
        }
      }
    }

    if (!pngJobs.length) {
      setStatus("No encontré ningún PNG en los archivos seleccionados ni dentro de los ZIP.", "error");
      return;
    }

    for (let i = 0; i < pngJobs.length; i++) {
      const job = pngJobs[i];
      setStatus(`Activando el Inador... (${i + 1}/${pngJobs.length}) ${job.name}`);

      try {
        const result = await trimPngFile(job.file);
        processedFiles.push({
          name: makeOutputName(job.name),
          blob: result.blob,
          originalWidth: result.originalWidth,
          originalHeight: result.originalHeight,
          width: result.width,
          height: result.height
        });
        if (processedFiles.length === 1) drawPreview(job.file, result);
      } catch (error) {
        console.error("No se pudo procesar:", job.name, error);
      }
    }

    if (!processedFiles.length) {
      setStatus("No pude procesar los PNG. Puede que estén dañados o no sean imágenes válidas.", "error");
      return;
    }

    const total = processedFiles.length;
    const failed = pngJobs.length - total;
    const areaBefore = processedFiles.reduce((sum, item) => sum + item.originalWidth * item.originalHeight, 0);
    const areaAfter = processedFiles.reduce((sum, item) => sum + item.width * item.height, 0);
    const reduction = areaBefore ? ((areaBefore - areaAfter) / areaBefore * 100).toFixed(2) : "0.00";

    setStatus(
      `¡Inador completado! ${total} PNG procesados. Reducción total del área: ${reduction}%.${failed ? ` ${failed} archivo(s) no se pudieron procesar.` : ""}`,
      "success"
    );
    downloadBtn.disabled = false;
  } catch (error) {
    console.error(error);
    setStatus("No pude abrir uno de los ZIP. Comprueba que el archivo no esté dañado o protegido por contraseña.", "error");
  } finally {
    processing = false;
    processBtn.disabled = selectedFiles.length === 0;
  }
}

function trimPngFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const W = canvas.width;
        const H = canvas.height;
        const pixels = ctx.getImageData(0, 0, W, H).data;
        let top = H, left = W, right = -1, bottom = -1;

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (pixels[(y * W + x) * 4 + 3] !== 0) {
              if (x < left) left = x;
              if (x > right) right = x;
              if (y < top) top = y;
              if (y > bottom) bottom = y;
            }
          }
        }

        // Si está completamente transparente, conservar sus dimensiones.
        if (right < left || bottom < top) {
          canvas.toBlob(blob => {
            URL.revokeObjectURL(objectUrl);
            if (blob) resolve({
              blob, originalWidth: W, originalHeight: H, width: W, height: H,
              previewCanvas: canvas, fullyTransparent: true
            });
            else reject(new Error("No se pudo exportar el PNG"));
          }, "image/png");
          return;
        }

        const width = right - left + 1;
        const height = bottom - top + 1;
        const output = document.createElement("canvas");
        output.width = width;
        output.height = height;
        output.getContext("2d").drawImage(canvas, left, top, width, height, 0, 0, width, height);
        output.toBlob(blob => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve({
            blob, originalWidth: W, originalHeight: H, width, height,
            previewCanvas: output, fullyTransparent: false
          });
          else reject(new Error("No se pudo exportar el PNG"));
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("PNG inválido"));
    };

    img.src = objectUrl;
  });
}

function drawPreview(file, result) {
  const originalUrl = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    originalCanvas.width = img.naturalWidth;
    originalCanvas.height = img.naturalHeight;
    oCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    oCtx.drawImage(img, 0, 0);
    URL.revokeObjectURL(originalUrl);
  };

  img.onerror = () => URL.revokeObjectURL(originalUrl);
  img.src = originalUrl;

  trimmedCanvas.width = result.width;
  trimmedCanvas.height = result.height;
  tCtx.clearRect(0, 0, result.width, result.height);
  if (result.previewCanvas) tCtx.drawImage(result.previewCanvas, 0, 0);
}

function makeOutputName(path) {
  const slash = path.lastIndexOf("/");
  const folder = slash >= 0 ? path.slice(0, slash + 1) : "";
  const filename = slash >= 0 ? path.slice(slash + 1) : path;
  const base = filename.replace(/\.png$/i, "");
  return `${folder}${base}_inador.png`;
}

downloadBtn.addEventListener("click", async () => {
  if (!processedFiles.length) return;
  downloadBtn.disabled = true;
  setStatus("Empaquetando los PNG procesados en un ZIP...");

  try {
    const zip = new JSZip();
    for (const file of processedFiles) zip.file(file.name, file.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resultados-inador.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`ZIP listo: ${processedFiles.length} PNG recortados.`, "success");
  } catch (error) {
    console.error(error);
    setStatus("No pude crear el ZIP de resultados.", "error");
  } finally {
    downloadBtn.disabled = false;
  }
});