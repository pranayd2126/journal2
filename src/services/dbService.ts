const AUTH_KEY = "trading_journal_user";
async function request(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, credentials: "same-origin" });
  const data = await response
    .json()
    .catch(() => ({ error: "Unexpected server response" }));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(AUTH_KEY);
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}
function endpoint(path: string, id?: string) {
  const user = dbService.getCurrentUser();
  if (!user) throw new Error("Please sign in");
  const collection = [
    "trades",
    "settings",
    "checklists",
    "insights",
    "notebook",
  ].find((c) => path.split("/").includes(c));
  if (!collection) throw new Error("Invalid collection");
  return `/api/${user.id}/${collection}${id && collection !== "settings" ? `/${id}` : ""}`;
}
export const dbService = {
  getCurrentUser(): { id: string; email: string } | null {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) ?? "null");
    } catch {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
  },
  setCurrentUser(user: any) {
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_KEY);
  },
  async restoreSession() {
    try {
      const u = await request("/api/auth/session");
      this.setCurrentUser(u);
      return u;
    } catch {
      this.setCurrentUser(null);
      return null;
    }
  },
  async logout() {
    await request("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    this.setCurrentUser(null);
  },
  async getCollection<T>(path: string, _constraints: any[] = []): Promise<T[]> {
    return request(endpoint(path));
  },
  async getDocument<T>(path: string, id: string): Promise<T | null> {
    return request(endpoint(path, id));
  },
  async saveNotebook(
    data: import("../types").NotebookEntry,
  ): Promise<import("../types").NotebookEntry> {
    return request(endpoint("notebook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async addDocument<T>(
    path: string,
    data: T,
    submissionId = crypto.randomUUID(),
  ): Promise<string> {
    const result = await request(endpoint(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": submissionId,
      },
      body: JSON.stringify(data),
    });
    return result.id;
  },
  async updateDocument<T>(
    path: string,
    id: string,
    data: Partial<T>,
  ): Promise<any> {
    return request(endpoint(path, id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async setDocument<T>(path: string, id: string, data: T): Promise<void> {
    await this.updateDocument(path, id, data);
  },
  async deleteDocument(path: string, id: string): Promise<void> {
    await request(endpoint(path, id), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  },
};
