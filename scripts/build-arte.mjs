import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile, rename } from "node:fs/promises";
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const deps = [
  "express",
  "express-rate-limit",
  "helmet",
  "zod",
  "clipper-lib",
  "polygon-clipping",
  "svg-pathdata",
];
for (const folder of ["server", "api", "docs/prompts"])
  await mkdir(`dist/arte/${folder}`, { recursive: true });
for (const [entry, outfile] of [
  ["server/arte/index.ts", "server/index.mjs"],
  ["server/arte/function.ts", "api/index.mjs"],
]) {
  const result = await build({
    entryPoints: [entry],
    outfile: `dist/arte/${outfile}`,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    define: { "process.env.NODE_ENV": '"production"' },
    external: [...deps, "vite", "../../vite.arte.config"],
    metafile: true,
  });
  if (
    Object.keys(result.metafile.inputs).some(x =>
      /server[\\/](_core[\\/]auth|db[\\/])|drizzle[\\/]schema/.test(x)
    )
  )
    throw new Error(
      "O build independente não pode conter auth ou banco do Radrasys."
    );
}
await rename(
  "dist/arte/public/cpq-redesenho-vetorizacao.html",
  "dist/arte/public/index.html"
);
await copyFile(
  "client/public/cpq-vetorizador-local.js",
  "dist/arte/public/cpq-vetorizador-local.js"
);
for (const name of [
  "prompt-1-reconstrucao-visual.md",
  "prompt-1b-extracao-logo-vetorizacao.md",
])
  await copyFile(`docs/prompts/${name}`, `dist/arte/docs/prompts/${name}`);
await writeFile(
  "dist/arte/package.json",
  JSON.stringify(
    {
      name: "estudio-arte",
      private: true,
      type: "module",
      engines: { node: ">=22" },
      packageManager: rootPackage.packageManager,
      scripts: { start: "node --env-file-if-exists=.env server/index.mjs" },
      dependencies: Object.fromEntries(
        deps.map(x => [x, rootPackage.dependencies[x]])
      ),
    },
    null,
    2
  )
);
await copyFile("yarn.lock", "dist/arte/yarn.lock");
await copyFile("arte.env.example", "dist/arte/.env.example");
await copyFile("docs/estudio-arte-independente.md", "dist/arte/README.md");
await writeFile(
  "dist/arte/vercel.json",
  JSON.stringify(
    {
      version: 2,
      installCommand: "yarn install --frozen-lockfile --production",
      buildCommand: "",
      outputDirectory: "public",
      functions: {
        "api/index.mjs": { maxDuration: 300, includeFiles: "docs/prompts/**" },
      },
      rewrites: [
        { source: "/api/:path*", destination: "/api/index" },
        { source: "/login", destination: "/index.html" },
        {
          source: "/cpq-redesenho-vetorizacao.html",
          destination: "/index.html",
        },
      ],
    },
    null,
    2
  )
);
console.log(
  "Artefato independente: dist/arte (página /, API própria, sem banco/ERP). Nenhuma publicação realizada."
);
