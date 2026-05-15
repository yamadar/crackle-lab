# Crackle Lab

貫入（クラック）図鑑。各アルゴリズムのパラメータを調整しながら視覚的に試せる SPA。

## 起動

```bash
npm install        # リポジトリルートで一度だけ
npm run dev -w crackle-lab
```

`http://localhost:5182/` が自動で開きます。

## ビルド

```bash
npm run build -w crackle-lab
```

## 構成

```
crackle-lab/
├── index.html      # マークアップのみ
├── vite.config.js
├── package.json
└── src/
    ├── main.js     # ロジック（style.css を import）
    └── style.css   # スタイル
```
