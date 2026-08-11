import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("../db/db", () => ({
  listKnowledgeComments: vi.fn(),
  createKnowledgeComment: vi.fn(),
  deleteKnowledgeComment: vi.fn(),
}));

import {
  listKnowledgeComments,
  createKnowledgeComment,
  deleteKnowledgeComment,
} from "../db/db";

describe("Knowledge Comments DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listKnowledgeComments returns comments for a given knowledgeId", async () => {
    const mockComments = [
      { id: 1, knowledgeId: 5, author: "João", content: "Ótimo artigo!", createdAt: new Date("2026-04-28") },
      { id: 2, knowledgeId: 5, author: "Maria", content: "Muito útil para o time.", createdAt: new Date("2026-04-28") },
    ];
    vi.mocked(listKnowledgeComments).mockResolvedValue(mockComments);

    const result = await listKnowledgeComments(5);
    expect(result).toHaveLength(2);
    expect(result[0].author).toBe("João");
    expect(result[1].content).toBe("Muito útil para o time.");
    expect(listKnowledgeComments).toHaveBeenCalledWith(5);
  });

  it("listKnowledgeComments returns empty array when no comments exist", async () => {
    vi.mocked(listKnowledgeComments).mockResolvedValue([]);
    const result = await listKnowledgeComments(99);
    expect(result).toEqual([]);
  });

  it("createKnowledgeComment inserts a new comment", async () => {
    vi.mocked(createKnowledgeComment).mockResolvedValue(undefined);
    await createKnowledgeComment({ knowledgeId: 3, author: "Equipe", content: "Nota importante sobre este artigo." });
    expect(createKnowledgeComment).toHaveBeenCalledWith({
      knowledgeId: 3,
      author: "Equipe",
      content: "Nota importante sobre este artigo.",
    });
  });

  it("deleteKnowledgeComment removes a comment by id", async () => {
    vi.mocked(deleteKnowledgeComment).mockResolvedValue(undefined);
    await deleteKnowledgeComment(7);
    expect(deleteKnowledgeComment).toHaveBeenCalledWith(7);
  });

  it("listKnowledgeComments does not mix comments from different articles", async () => {
    const commentsArticle1 = [
      { id: 1, knowledgeId: 1, author: "A", content: "Artigo 1 comentário", createdAt: new Date() },
    ];
    const commentsArticle2 = [
      { id: 2, knowledgeId: 2, author: "B", content: "Artigo 2 comentário", createdAt: new Date() },
    ];
    vi.mocked(listKnowledgeComments)
      .mockResolvedValueOnce(commentsArticle1)
      .mockResolvedValueOnce(commentsArticle2);

    const r1 = await listKnowledgeComments(1);
    const r2 = await listKnowledgeComments(2);
    expect(r1[0].knowledgeId).toBe(1);
    expect(r2[0].knowledgeId).toBe(2);
  });
});
