import { createId } from "@paralleldrive/cuid2";
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
  errors: { code: string; message: string }[];
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
  errors: { code: string; message: string }[];
  messages: unknown[];
}

export class ImageUtils<ImageIds extends Record<string, any>> {
  private blacklist: string[] = ["img.clerk.com"];
  private _accountHash: string;
  private _imageIds: ImageIds | undefined;

  constructor(args: {
    accountHash: string;
    blacklist?: string[];
    imageIds?: ImageIds;
  }) {
    this._accountHash = args.accountHash;

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

  get accountHash() {
    return this._accountHash;
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
          const id = createId();
          form.append("id", id);
          form.append("expiry", dayjs().add(5, "minute").toISOString());

          const img = await ofetch<CreateImageUrlResponse>(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountHash}/images/v2/direct_upload`,
            { method: "POST", headers, body: form }
          );

          if (!img.success) {
            throw new Error("Error uploading image");
          }

          return { url: img.result.uploadURL, id };
        } catch (e) {
          console.error("Error uploading image");
          throw e;
        }
      })
    );

    return urls;
  }

  public async clientUpload(url: string, body: FormData) {
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

  public async upload(data: Blob, args: { apiKey: string; id?: string }) {
    const formData = new FormData();
    formData.set("file", data, "file.png");
    formData.set("id", args.id ?? createId());

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${args.apiKey}`);

    const response = await ofetch<UploadImageResponse>(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountHash}/images/v1`,
      {
        method: "POST",
        headers,
        body: formData,
      }
    );

    return response;
  }

  public async delete(id: string, args: { apiKey: string }) {
    if (this.isProtected(id)) {
      return { success: true };
    }

    try {
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${args.apiKey}`);

      await ofetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountHash}/images/v1/${id}`,
        {
          method: "POST",
          headers,
        }
      );
      return { success: true };
    } catch (_e) {
      return { success: false };
    }
  }

  public async batchUpload(
    files: { file: File; url: { id: string; value: string } }[]
  ) {
    return await Promise.all(
      files.map(async (e) => {
        const formData = new FormData();
        formData.append("file", e.file);

        const downloadUrl = await this.clientUpload(e.url.value, formData);

        return {
          url: downloadUrl,
          id: e.url.id,
        };
      })
    );
  }
}
