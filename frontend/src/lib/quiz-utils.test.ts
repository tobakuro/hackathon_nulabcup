import { describe, it, expect } from "vitest";
import { isQuizCandidatePath } from "./quiz-utils";

describe("isQuizCandidatePath", () => {
  describe("対象ファイル（trueを返す）", () => {
    it.each([
      ["src/components/Button.tsx", ".tsx"],
      ["src/lib/utils.ts", ".ts"],
      ["src/pages/index.js", ".js"],
      ["src/app/layout.jsx", ".jsx"],
      ["main.go", ".go"],
      ["app.py", ".py"],
      ["index.php", ".php"],
      ["widget.dart", ".dart"],
      ["Program.cs", ".cs"],
      ["app.rb", ".rb"],
      ["src/deep/nested/file.ts", "ネストされた .ts"],
      ["FILE.TS", "大文字拡張子"],
    ])("%s (%s) → true", (path) => {
      expect(isQuizCandidatePath(path)).toBe(true);
    });
  });

  describe("除外ファイル（falseを返す）", () => {
    it("README.md はfalse", () => {
      expect(isQuizCandidatePath("README.md")).toBe(false);
    });

    it("readme.md（小文字）はfalse", () => {
      expect(isQuizCandidatePath("readme.md")).toBe(false);
    });

    it("サブディレクトリの README.md はfalse", () => {
      expect(isQuizCandidatePath("src/components/README.md")).toBe(false);
    });

    it("/docs/ を含むパスはfalse", () => {
      expect(isQuizCandidatePath("src/docs/guide.ts")).toBe(false);
    });

    it("docs/ で始まるパスはfalse", () => {
      expect(isQuizCandidatePath("docs/api.ts")).toBe(false);
    });

    it("対象外の拡張子（.md）はfalse", () => {
      expect(isQuizCandidatePath("CHANGELOG.md")).toBe(false);
    });

    it("対象外の拡張子（.json）はfalse", () => {
      expect(isQuizCandidatePath("package.json")).toBe(false);
    });

    it("拡張子なしはfalse", () => {
      expect(isQuizCandidatePath("Makefile")).toBe(false);
    });

    it("空文字はfalse", () => {
      expect(isQuizCandidatePath("")).toBe(false);
    });
  });
});
