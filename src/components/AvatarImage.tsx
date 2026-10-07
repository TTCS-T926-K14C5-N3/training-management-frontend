import { useEffect, useState } from "react";
import api from "../services/api";

interface AvatarImageProps {
  source?: string | null;
  userId?: number;
  fallback: string;
  alt: string;
}

const AvatarImage: React.FC<AvatarImageProps> = ({
  source,
  userId,
  fallback,
  alt,
}) => {
  const [loadedImage, setLoadedImage] = useState<{
    endpoint: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    const endpoint = source || (userId ? `/users/${userId}/avatar` : null);
    if (!endpoint || endpoint.startsWith("data:image/")) {
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    api
      .get<Blob>(endpoint, {
        responseType: "blob",
        signal: controller.signal,
      })
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        if (!response.data.type.startsWith("image/")) {
          throw new Error("API không trả về dữ liệu ảnh.");
        }

        objectUrl = URL.createObjectURL(response.data);
        setLoadedImage({ endpoint, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error("Không thể tải ảnh đại diện:", error);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [source, userId]);

  const endpoint = source || (userId ? `/users/${userId}/avatar` : null);
  const imageUrl = source?.startsWith("data:image/")
    ? source
    : loadedImage?.endpoint === endpoint
      ? loadedImage.url
      : null;

  return imageUrl ? (
    <img src={imageUrl} alt={alt} />
  ) : (
    <span aria-label={alt}>{fallback}</span>
  );
};

export default AvatarImage;
