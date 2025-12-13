import { nanoid } from "nanoid";
import dayjs from "dayjs";
import { ofetch } from "ofetch";

export interface OptimizedImageOptions {
  anim?: boolean;
  background?: string;
  blur?: number;
  brightness?: number;
  compression?: "fast"; // faster compression = larger file size
  contrast?: number;
  dpr?: number;
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  format?: "webp" | "avif" | "json";
  gamma?: number;
  width?: number;
  height?: number;
  metadata?: "keep" | "copyright" | "none";
  quality?: number;
  rotate?: number;
  sharpen?: number;
}

export interface CreateImageUrlResponse {
  result: {
    id: string;
    uploadURL: string;
  };
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

interface UploadImageResponse {
  result: {
    id: string;
    filename: string;
    uploaded: string;
    requireSignedURLs: boolean;
    variants: string[];
  };
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

interface CloudflareImagesV1Response {
  result: {
    images: CloudflareImage[];
  };
  success: boolean;
  errors: CloudflareApiError[];
  messages: string[];
}

interface CloudflareImage {
  id: string; // Unique image identifier
  filename: string; // Original filename
  uploaded: string; // ISO 8601 date-time string
  requireSignedURLs: boolean;
  variants: string[]; // Array of URLs for the image variants
  meta?: Record<string, any>; // User modifiable key-value store (max 1024 bytes)
  creator?: string | null; // Internal user ID (optional)
}

interface CloudflareApiError {
  code: number;
  message: string;
}

export class ImageUtils<ImageIds extends Record<string, any>> {
  private blacklist: string[] = ["img.clerk.com"];
  private accountId: string;
  private accountHash: string;
  private _imageIds: ImageIds | undefined;

  constructor(args: {
    accountId: string;
    accountHash: string;
    blacklist?: string[];
    imageIds?: ImageIds;
  }) {
    this.accountId = args.accountId;
    this.accountHash = args.accountHash;

    this._imageIds = args.imageIds;

    if (args.blacklist) {
      this.blacklist.push(...args.blacklist);
    }
  }

  get imageIds() {
    if (!this._imageIds) {
      throw new Error("imageIds was not supplied in constructor");
    }

    return this._imageIds;
  }

  public url(id: string) {
    return `https://imagedelivery.net/${this.accountHash}/${id}/public`;
  }

  private isBlacklisted(url: string) {
    return this.blacklist.some((u) => url.includes(u));
  }

  private isProtected(id: string) {
    if (!this._imageIds) {
      return false;
    }

    return Object.values(this._imageIds).some((e) => e === id);
  }

  /**
   * Will only operate on images that have been uploaded via cloudflare images
   */
  public optimizeUrl(url: string, options: OptimizedImageOptions) {
    if (this.isBlacklisted(url)) {
      return url;
    }

    // Final format should look similar to: https://imagedelivery.net/<ACCOUNT_HASH>/<IMAGE_ID>/w=400,sharpen=3
    return url.replace("public", this.createImageOptionsString(options));
  }

  public optimizeId(id: string, options: OptimizedImageOptions) {
    return this.optimizeUrl(this.url(id), options);
  }

  public createOptionsSearchParams(options: OptimizedImageOptions) {
    const params = new URLSearchParams();

    const pairs = Object.entries(options);

    for (const [key, val] of pairs) {
      if (val === undefined) {
        continue;
      }

      params.set(key, val.toString());
    }

    return params;
  }

  public createImageOptionsString(options: OptimizedImageOptions) {
    const params = this.createOptionsSearchParams(options);

    return Array.from(params.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join(",");
  }

  public async createUploadUrls(count: number, args: { apiKey: string }) {
    if (count === 0) {
      return [];
    }

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${args.apiKey}`);

    const urls = await Promise.all(
      Array.from({ length: count }).map(async () => {
        try {
          const form = new FormData();
          const id = nanoid();
          form.append("id", id);
          form.append("expiry", dayjs().add(5, "minute").toISOString());

          const img = await ofetch<CreateImageUrlResponse>(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v2/direct_upload`,
            { method: "POST", headers, body: form },
          );

          if (!img.success) {
            throw new Error("Error uploading image");
          }

          return { url: img.result.uploadURL, id };
        } catch (e) {
          console.error("Error uploading image");
          throw e;
        }
      }),
    );

    return urls;
  }

  public async serverUpload(data: Blob, args: { id: string; apiKey: string }) {
    const formData = new FormData();
    formData.append("file", data, nanoid());

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${args.apiKey}`);

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`, {
      method: "POST",
      headers,
      body: formData,
    });

    const json: CloudflareImagesV1Response = await response.json();

    return json;
  }

  public async upload(url: string, body: FormData) {
    const fetchResponse = await ofetch<UploadImageResponse>(url, {
      method: "POST",
      body,
    });

    if (!fetchResponse.success) {
      throw new Error("Failed to upload image");
    }

    const downloadUrl = fetchResponse.result.variants[0];

    if (!downloadUrl) {
      throw new Error("Could not find download URL");
    }

    return downloadUrl;
  }

  public async delete(id: string, args: { apiKey: string }) {
    if (this.isProtected(id)) {
      return { success: true };
    }

    try {
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${args.apiKey}`);

      await ofetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1/${id}`, {
        method: "POST",
        headers,
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  public async batchUpload(files: { file: File; url: { id: string; value: string } }[]) {
    return await Promise.all(
      files.map(async (e) => {
        const formData = new FormData();
        formData.append("file", e.file);

        const downloadUrl = await this.upload(e.url.value, formData);

        return {
          url: downloadUrl,
          id: e.url.id,
        };
      }),
    );
  }
}
