const THUMBNAIL_WIDTH = 960;
const THUMBNAIL_HEIGHT = 540;
const THUMBNAIL_MAX_BYTES = 96 * 1024;
const THUMBNAIL_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42] as const;
const THUMBNAIL_WIDTH_STEPS = [THUMBNAIL_WIDTH, 800] as const;

const canvasToWebp = (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> => new Promise((resolve) => {
  canvas.toBlob(resolve, 'image/webp', quality);
});

const drawCover = (
  canvas: HTMLCanvasElement,
  image: ImageBitmap,
  width: number,
): void => {
  const height = Math.round(width * THUMBNAIL_HEIGHT / THUMBNAIL_WIDTH);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable');

  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
};

export const prepareThumbnailUpload = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return file;
  }

  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    return file;
  }
  const canvas = document.createElement('canvas');
  let smallest: Blob | null = null;

  try {
    for (const width of THUMBNAIL_WIDTH_STEPS) {
      drawCover(canvas, image, width);
      for (const quality of THUMBNAIL_QUALITY_STEPS) {
        const candidate = await canvasToWebp(canvas, quality);
        if (!candidate || candidate.type !== 'image/webp') return file;
        if (!smallest || candidate.size < smallest.size) smallest = candidate;
        if (candidate.size <= THUMBNAIL_MAX_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'thumbnail';
          return new File([candidate], `${baseName}.webp`, {
            lastModified: Date.now(),
            type: 'image/webp',
          });
        }
      }
    }
  } catch {
    return file;
  } finally {
    image.close();
  }

  if (!smallest) return file;
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'thumbnail';
  return new File([smallest], `${baseName}.webp`, {
    lastModified: Date.now(),
    type: 'image/webp',
  });
};
