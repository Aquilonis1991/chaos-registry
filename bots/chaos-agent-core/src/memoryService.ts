import { ChromaClient } from "chromadb";
import OpenAI from "openai";
import { config } from "./config.js";

export type MemoryRecord = {
  id: string;
  agentId: string;
  counterpartId: string;
  content: string;
  createdAt: string;
  tags: string[];
};

type SearchMemory = {
  id: string;
  content: string;
  score: number;
  counterpartId: string;
  createdAt: string;
};

export class MemoryService {
  private readonly chroma = new ChromaClient({ path: config.CHROMA_URL });
  private readonly openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  private async embed(input: string): Promise<number[]> {
    if (config.AI_PROVIDER !== "google") {
      const embedding = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input
      });
      return embedding.data[0]?.embedding ?? [];
    }

    if (!config.GOOGLE_API_KEY) {
      throw new Error("AI_PROVIDER=google 需要設定 GOOGLE_API_KEY");
    }
    const model = encodeURIComponent(config.GEMINI_EMBED_MODEL);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(
      config.GOOGLE_API_KEY
    )}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: {
          parts: [{ text: input }]
        },
        taskType: "RETRIEVAL_DOCUMENT"
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini embedContent failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      embedding?: { values?: number[] };
    };
    return data.embedding?.values ?? [];
  }

  private async getCollection() {
    return this.chroma.getOrCreateCollection({
      name: config.CHROMA_COLLECTION_NAME
    });
  }

  async addConversationMemory(record: MemoryRecord): Promise<void> {
    const collection = await this.getCollection();
    const embeddings = await this.embed(record.content);

    await collection.add({
      ids: [record.id],
      documents: [record.content],
      embeddings: [embeddings],
      metadatas: [
        {
          agentId: record.agentId,
          counterpartId: record.counterpartId,
          createdAt: record.createdAt,
          tags: record.tags.join(",")
        }
      ]
    });
  }

  async searchRelevantMemories(agentId: string, query: string, topK = 5): Promise<SearchMemory[]> {
    const collection = await this.getCollection();
    const queryEmbedding = await this.embed(query);
    const result = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      where: { agentId }
    });

    const ids = result.ids[0] ?? [];
    const docs = result.documents[0] ?? [];
    const distances = result.distances?.[0] ?? [];
    const metadatas = result.metadatas?.[0] ?? [];

    return ids.map((id, index) => {
      const metadata = (metadatas[index] ?? {}) as Record<string, unknown>;
      const distance = Number(distances[index] ?? 1);
      return {
        id,
        content: String(docs[index] ?? ""),
        score: Math.max(0, 1 - distance),
        counterpartId: String(metadata.counterpartId ?? ""),
        createdAt: String(metadata.createdAt ?? "")
      };
    });
  }
}
