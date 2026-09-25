import argparse
import csv
import os
import sys

from apify_client import ApifyClient

ACTOR_ID = "apify/instagram-followers-following-scraper"


def main():
    parser = argparse.ArgumentParser(
        description="Extrai a lista de seguidores de perfis do Instagram (ex.: concorrentes) via Apify."
    )
    parser.add_argument("usernames", nargs="+", help="Usernames do Instagram, sem @ (ex.: concorrente1 concorrente2)")
    parser.add_argument("--limit", type=int, default=200, help="Máximo de seguidores por username (padrão: 200)")
    parser.add_argument("--out", default="scripts/data/seguidores-concorrentes.csv", help="Caminho do CSV de saída")
    args = parser.parse_args()

    token = os.environ.get("APIFY_TOKEN")
    if not token:
        sys.exit("Defina a variável de ambiente APIFY_TOKEN antes de rodar (token pessoal da Apify).")

    client = ApifyClient(token)

    run_input = {
        "usernames": args.usernames,
        "dataToScrape": "followers",
        "resultsLimit": args.limit,
    }

    print(f"Rodando {ACTOR_ID} para: {', '.join(args.usernames)} (limite {args.limit}/perfil)...")
    run = client.actor(ACTOR_ID).call(run_input=run_input)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["username", "fullName", "userId", "isVerified", "isPrivate", "sourceUsername"])
        total = 0
        for item in client.dataset(run.default_dataset_id).iterate_items():
            writer.writerow(
                [
                    item.get("username"),
                    item.get("fullName"),
                    item.get("userId"),
                    item.get("isVerified"),
                    item.get("isPrivate"),
                    item.get("sourceUsername"),
                ]
            )
            total += 1

    print(f"{total} seguidores salvos em {args.out}")


if __name__ == "__main__":
    main()
