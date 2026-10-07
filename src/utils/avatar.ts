const AVATAR_SIZE = 512;
const THUMBNAIL_SIZE = 128;

export interface ProcessedAvatar {
  avatar: File;
  thumbnail: File;
}

export function getAvatarPath(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const path = data.anhDaiDien ?? data.avatarUrl ?? data.avatar_url;

  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export function resolveAvatarUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  try {
    return new URL(path, import.meta.env.VITE_API_URL || window.location.origin)
      .toString();
  } catch {
    return path;
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Không thể xử lý ảnh đã chọn."));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function processAvatar(file: File): Promise<ProcessedAvatar> {
  const bitmap = await createImageBitmap(file);

  try {
    const cropSize = Math.min(bitmap.width, bitmap.height);
    const cropX = (bitmap.width - cropSize) / 2;
    const cropY = (bitmap.height - cropSize) / 2;

    const render = async (size: number, quality: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#fff";
      context.fillRect(0, 0, size, size);
      context.drawImage(
        bitmap,
        cropX,
        cropY,
        cropSize,
        cropSize,
        0,
        0,
        size,
        size,
      );

      return canvasToJpeg(canvas, quality);
    };

    const [avatarBlob, thumbnailBlob] = await Promise.all([
      render(AVATAR_SIZE, 0.9),
      render(THUMBNAIL_SIZE, 0.82),
    ]);
    const fileName = `${file.name.replace(/\.[^.]+$/, "") || "avatar"}.jpg`;

    return {
      avatar: new File([avatarBlob], fileName, { type: "image/jpeg" }),
      thumbnail: new File([thumbnailBlob], `thumbnail-${fileName}`, {
        type: "image/jpeg",
      }),
    };
  } finally {
    bitmap.close();
  }
}
