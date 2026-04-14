import { storage, type AnalysisEmbeddingRecord } from "../storage";

export interface VectorSearchMatch extends AnalysisEmbeddingRecord {
  score: number;
}

export class VectorStoreService {
  private readonly dimensions = 256;

  async upsertAnalysisDocument(input: {
    userId: string;
    analysisId: string;
    summary: string;
  }): Promise<AnalysisEmbeddingRecord> {
    const embedding = this.embedText(input.summary);
    return storage.upsertAnalysisEmbedding({
      userId: input.userId,
      analysisId: input.analysisId,
      summary: input.summary,
      embedding,
    });
  }

  async searchSimilarAnalyses(input: {
    userId: string;
    queryText: string;
    excludeAnalysisIds?: string[];
    limit?: number;
  }): Promise<VectorSearchMatch[]> {
    const queryEmbedding = this.embedText(input.queryText);
    const allDocuments = await storage.getAnalysisEmbeddingsByUser(input.userId);
    const excludedIds = new Set(input.excludeAnalysisIds || []);
    const limit = input.limit ?? 3;

    return allDocuments
      .filter((document) => !excludedIds.has(document.analysisId))
      .map((document) => ({
        ...document,
        score: this.cosineSimilarity(queryEmbedding, document.embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  private embedText(text: string): number[] {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s.%/-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    for (const token of tokens) {
      const index = this.hashToken(token) % this.dimensions;
      const sign = this.hashToken(`${token}:sign`) % 2 === 0 ? 1 : -1;
      vector[index] += sign;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / magnitude);
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (!left.length || !right.length || left.length !== right.length) {
      return 0;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index += 1) {
      const leftValue = left[index] || 0;
      const rightValue = right[index] || 0;
      dot += leftValue * rightValue;
      leftMagnitude += leftValue * leftValue;
      rightMagnitude += rightValue * rightValue;
    }

    const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
    return denominator ? dot / denominator : 0;
  }

  private hashToken(value: string): number {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return Math.abs(hash >>> 0);
  }
}

export const vectorStoreService = new VectorStoreService();
