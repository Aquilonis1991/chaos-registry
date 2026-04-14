export type LoginResult = {
  accessToken: string;
  userId: string;
};

type RequestOptions = {
  method?: string;
  body?: Record<string, unknown>;
  authRequired?: boolean;
};

export class ChaosApiClient {
  private accessToken: string | null = null;

  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const result = await this.request<LoginResult>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      authRequired: false
    });
    this.accessToken = result.accessToken;
    return result;
  }

  async vote(targetId: string, direction: "up" | "down"): Promise<void> {
    await this.request("/api/votes", {
      method: "POST",
      body: { targetId, direction }
    });
  }

  async comment(topicId: string, content: string): Promise<{ commentId: string }> {
    return this.request<{ commentId: string }>("/api/comments", {
      method: "POST",
      body: { topicId, content }
    });
  }

  /**
   * 公共圖片上傳（multipart）。路徑可依主站實際 OpenAPI 調整。
   * 回傳可供留言引用的公開 URL。
   */
  async uploadImage(imageBytes: Uint8Array, filename: string, mimeType: string): Promise<{ url: string; id?: string }> {
    if (!this.accessToken) {
      throw new Error("API /api/uploads requires login token");
    }

    const form = new FormData();
    const buffer = Buffer.from(imageBytes);
    form.append("file", new Blob([buffer], { type: mimeType }), filename);

    const response = await fetch(`${this.baseUrl}/api/uploads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      },
      body: form
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`API /api/uploads failed: ${response.status} ${text}`);
    }

    return (await response.json()) as { url: string; id?: string };
  }

  /**
   * 帶附件的留言（上傳完成後將 imageUrl 一併送出）。
   */
  async commentWithImage(
    topicId: string,
    content: string,
    imageUrl: string
  ): Promise<{ commentId: string }> {
    return this.request<{ commentId: string }>("/api/comments", {
      method: "POST",
      body: { topicId, content, imageUrl, attachmentUrl: imageUrl }
    });
  }

  async enableDataProtection(reason: string): Promise<void> {
    await this.request("/api/user/data-protection", {
      method: "POST",
      body: { enabled: true, reason }
    });
  }

  /**
   * 取得目前登入使用者自己的留言清單（公共 GET）。
   * 不拋錯：用於 self-audit；路徑可依主站實際 API 調整。
   */
  async getMyCommentsUnsafe(): Promise<{ status: number; data?: unknown }> {
    return this.getJsonUnsafe("/api/me/comments");
  }

  /**
   * 單筆留言詳情（公共 GET），用於補強「列表缺 id」時的 404 確認。
   */
  async getCommentByIdUnsafe(commentId: string): Promise<{ status: number; data?: unknown }> {
    return this.getJsonUnsafe(`/api/comments/${encodeURIComponent(commentId)}`);
  }

  private authHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new Error("Not logged in");
    }
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  private async getJsonUnsafe(path: string): Promise<{ status: number; data?: unknown }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        ...this.authHeaders(),
        Accept: "application/json"
      }
    });

    if (response.status === 404) {
      return { status: 404 };
    }

    if (!response.ok) {
      return { status: response.status };
    }

    const data = await response.json().catch(() => undefined);
    return { status: response.status, data };
  }

  private async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const authRequired = options.authRequired ?? true;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (authRequired) {
      if (!this.accessToken) {
        throw new Error(`API ${path} requires login token`);
      }
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`API ${path} failed: ${response.status} ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
