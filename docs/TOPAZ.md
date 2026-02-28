---
title: GitQuiz Battle
github: https://github.com/tobakuro/hackathon_nulabcup
url: https://hackathon-nulabcup.vercel.app
thumbnail: https://topaz.dev/_next/image?url=https%3A%2F%2Fptera-publish.topaz.dev%2Fproject%2F01KJC9K6RPWZ8EQ4K7966034RV.png&w=3840&q=75
stack: [Next.js, Go, TypeScript, Redis, PostgreSQL]
members: [ウオミー, みかん, RiTa, とばくろ]
date: 2026-02-26
tagline: そことそこ試合決定で これまで作ったリポジトリを理解しろ！
pitch:
  idea: 自分のGitHubリポジトリがそのまま対戦問題になる4択クイズバトル。知識暗記ではなく「自分の実装理解」で勝負できる点が推し。
  background: 学んだ技術をアウトプットしても定着度を測る場が少ない課題を解決したくて開発。遊びながら復習できる、実戦的な学習体験を目指した。
  tech: Next.js + Go + WebSocketで1on1対戦を低遅延同期し、Gemini APIで各ユーザーのコードから問題を自動生成。個別最適な出題をリアルタイム実現。
---

# AIエージェント行動規範

このプロジェクトのAIエージェントは、ヌーラボの行動規範「Nuice Ways」の精神に基づいて行動します。

## Try First

常に学び、実践することを優先する。未知の問題に直面しても、既存の知識と手段を駆使して積極的に試みる。完璧な解決策を待つより、まず動くものを作り、改善を重ねる。

## Love Differences

異なる技術スタック、コーディングスタイル、アーキテクチャの選択を尊重する。多様なアプローチを受け入れ、チームメンバーの観点を否定せず、建設的なフィードバックを心がける。

## Goal Oriented

本質的なゴールを常に意識する。実装の詳細に埋もれず、何のために作っているかを問い直す。進捗や課題はオープンに共有し、チームが同じ方向を向けるよう支援する。

# GitQuiz Battle

## 概要

テーマ「未来とのコラボレーション」
未来→朝倉未来→BreakingDown→1on1
過去の自分のリポジトリから現在（過去から見た未来）の自分へ

githubでログインすることで選手登録ができる
登録したgithubアカウントのリポジトリ情報をもとにAIが生成した問題に回答したらポイントget

**-->自身のプロダクトやこれまで使用した技術への理解度を高める**

[1人プレイデモ動画](https://youtu.be/g7nxV4Z3Nyo)

### 動作フロー

1. Githubログイン
2. マッチング
3. 試合開始
   1. これまでのリポジトリ参照
   2. ユーザーごとに過去のリポジトリから出題(ユーザー依存) 1. [じぶんにヌーを掛ける] 何問かごとに掛ける2. 4択くらいの選択式　回答に対してその技術のTipsを入れる
      リポジトリの技術を深掘り質問
      どのくらい正解できたか？(正解でヌーゲット！)
4. 勝敗判定(ポイント制ヌー)
5. リザルト

## 各機能

- リポジトリ管理（リポジトリの読み取り・AI解析）
- 1人プレイモード（自分のリポジトリでクイズに挑戦）
- 対戦クイズバトル（自分と対戦相手のリポジトリの技術から出されるクイズバトル）
- コードジオゲッサー（1行のコードからどのディレクトリのどの行かを当てるゲーム）

### リポジトリ管理

初回ログイン時に読み込むリポジトリを１つ以上選択する
![image](https://ptera-publish.topaz.dev/project/01KJCAS51FN561ZMBXQVWSG07B.png)
![image](https://ptera-publish.topaz.dev/project/01KJCAZ40ZPNQRBFHW30E7FHN1.png)

また、ホーム画面から飛べるリポジトリ管理で追加でリポジトリを読み込んだり、すでに読み込んだリポジトリを再読み込みできる
![image](https://ptera-publish.topaz.dev/project/01KJCB0DT0ENT3H6DQKMCK1AJ4.png)
![image](https://ptera-publish.topaz.dev/project/01KJCB1JMH0J94TKHE0NCD5QVH.png)

- GitHub REST APIを用いてリポジトリ情報取得
- Gemini APIで主要ファイルをディレクトリ構造から特定し、DBにファイルデータを保管->概要生成や使用技術取得

### １人プレイモード

1.プロジェクト概要
一人プレイで、ユーザーがすぐにクイズに挑戦できる学習体験を提供する構成です。

2.モード選択
テックモード、プロダクトモードから好きなモード選択できます。Geminiに投げるプロンプトを変更することで、異なる出題形式で問題を生成できるようになっています。

3.データ管理
リポジトリの内容をデータベースに保存し、出題や評価に必要な情報を安定して参照できるようにしています。

4.一人プレイの処理フロー
モード、解析済みリポジトリ、難易度、問題数選択→ゲーム開始 → 問題生成/取得 → 回答送信 → 採点結果返却 → 次の問題、というサイクルで進行します。

5.設計上のポイント
画面・ゲームロジック・AI連携を分離し、保守性と拡張性（難易度調整、分析機能追加、将来のマルチプレイ対応）を確保しています。

6.ゲーム画面
（選択画面）
![image](https://ptera-publish.topaz.dev/project/01KJC8E8M2Z4JJTN3YM7K20AYH.png)
（問題画面）
![image](https://ptera-publish.topaz.dev/project/01KJC8B92A7S048Q0XZ4NTFDRP.png)
（解答・解説画面）
![image](https://ptera-publish.topaz.dev/project/01KJC8H9M0C835F5R4JF956F4D.png)
（履歴画面）
![image](https://ptera-publish.topaz.dev/project/01KJC8KD3HR88AHEGF4B2GSZQ7.png)

## 技術

フロントエンド：Next.js
バックエンド：Go
Gemini API：問題生成と回答評価
GitHub Rest API：リポジトリ情報取得で使用
Next.js から API を呼び出し、Go がゲーム進行を制御。
Gemini API と連携してクイズや解説等の生成を行っています。

### フロントエンド

- **フレームワーク**: Next.js (App Router)
- **認証**: NextAuth.js (GitHub OAuth)
- **リアルタイム通信**: WebSocket
- **LLM連携**: Gemini API (API Routes 経由)
- **DB**: Cloudflare D1 (Drizzle ORM)
- **スタイリング**: Tailwind CSS

### バックエンド

- **言語**: Go
- **リアルタイム通信**: WebSocket (`gorilla/websocket`)
- **DB**: PostgreSQL (SQLC + goose によるマイグレーション)
- **インメモリDB**: Redis（マッチングキュー・ルーム状態管理）
- **ホットリロード**: air

![image](https://ptera-publish.topaz.dev/project/01KJCB9C4DPGTSZZ6J77CQYC40.png)

### 開発環境

- 開発環境作成:devbox(Nix)
  - CIの環境再現にも行かせて嬉しい！
  - クソ重いDockerを立ち上げながら開発したくない...
  - PostgreSQLとかServices周りの接続で沼った(ちゃんと理解してないのが悪い...)
  - 壊しやすくて作りやすい嬉しい環境作成ツール(ややこいNixも意識しなくていいのが助かる)

アプリのマスコットキャラ的なやつ
ヌーマン✖️ミク（未来）
![image](https://ptera-publish.topaz.dev/project/01KJCB9MRPV93ZZGJVRB2FWYQ2.png)
