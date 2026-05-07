import os
import json
import requests
from datetime import datetime, timezone

USERNAME = "sudanalytics_"
OUTPUT_FILE = "data/sudanalytics_posts.json"

MAX_RESULTS = 10
EXCLUDE_REPLIES = True
EXCLUDE_RETWEETS = False


def get_bearer_token():
    token = os.environ.get("X_BEARER_TOKEN", "").strip()

    if not token:
        raise RuntimeError("Falta el secret X_BEARER_TOKEN")

    return token


def x_get(url, params=None):
    token = get_bearer_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "PartidosHoySudanalyticsBot/1.0",
    }

    r = requests.get(url, headers=headers, params=params, timeout=30)

    print(f"🌐 {r.status_code} {r.url}")

    if not r.ok:
        print(r.text[:1000])
        r.raise_for_status()

    return r.json()


def obtener_user_id(username):
    url = f"https://api.x.com/2/users/by/username/{username}"

    params = {
        "user.fields": "id,name,username,profile_image_url,verified",
    }

    data = x_get(url, params=params)

    user = data.get("data") or {}

    if not user.get("id"):
        raise RuntimeError(f"No pude obtener user_id de @{username}")

    return user


def elegir_mejor_video(media):
    variants = media.get("variants") or []

    mp4s = []

    for variant in variants:
        url = variant.get("url", "")
        content_type = variant.get("content_type", "")

        if "mp4" not in content_type and ".mp4" not in url:
            continue

        bitrate = variant.get("bit_rate") or variant.get("bitrate") or 0

        mp4s.append({
            "url": url,
            "bitrate": bitrate,
        })

    if not mp4s:
        return ""

    mp4s.sort(key=lambda x: x.get("bitrate", 0), reverse=True)

    return mp4s[0]["url"]


def normalizar_media(media_items):
    media_map = {}

    for media in media_items:
        media_key = media.get("media_key")

        if not media_key:
            continue

        tipo = media.get("type", "")

        item = {
            "media_key": media_key,
            "type": tipo,
            "url": "",
            "preview": "",
            "width": media.get("width"),
            "height": media.get("height"),
        }

        if tipo == "photo":
            item["url"] = media.get("url", "")

        elif tipo in ["video", "animated_gif"]:
            item["url"] = elegir_mejor_video(media)
            item["preview"] = media.get("preview_image_url", "")

        else:
            item["url"] = media.get("url", "") or media.get("preview_image_url", "")
            item["preview"] = media.get("preview_image_url", "")

        media_map[media_key] = item

    return media_map


def obtener_posts(user_id):
    url = f"https://api.x.com/2/users/{user_id}/tweets"

    exclude = []

    if EXCLUDE_REPLIES:
        exclude.append("replies")

    if EXCLUDE_RETWEETS:
        exclude.append("retweets")

    params = {
        "max_results": MAX_RESULTS,
        "tweet.fields": "id,text,created_at,attachments,entities,public_metrics,possibly_sensitive",
        "expansions": "attachments.media_keys,author_id",
        "media.fields": "media_key,type,url,preview_image_url,width,height,duration_ms,variants,alt_text",
        "user.fields": "id,name,username,profile_image_url,verified",
    }

    if exclude:
        params["exclude"] = ",".join(exclude)

    data = x_get(url, params=params)

    tweets = data.get("data") or []
    includes = data.get("includes") or {}

    media_map = normalizar_media(includes.get("media") or [])

    posts = []

    for tweet in tweets:
        tweet_id = tweet.get("id")
        attachments = tweet.get("attachments") or {}
        media_keys = attachments.get("media_keys") or []

        media = []

        for key in media_keys:
            item = media_map.get(key)

            if item and item.get("url"):
                media.append(item)

        post = {
            "id": tweet_id,
            "texto": tweet.get("text", ""),
            "fecha": tweet.get("created_at", ""),
            "url": f"https://x.com/{USERNAME}/status/{tweet_id}",
            "media": media,
            "metricas": tweet.get("public_metrics") or {},
            "possibly_sensitive": tweet.get("possibly_sensitive", False),
        }

        posts.append(post)

    return posts


def guardar_json(posts):
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    payload = {
        "fuente": f"https://x.com/{USERNAME}",
        "username": USERNAME,
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(posts),
        "posts": posts,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE} con {len(posts)} posts")


def main():
    print(f"📡 Buscando posts de @{USERNAME}")

    user = obtener_user_id(USERNAME)
    print(f"👤 Usuario: {user.get('name')} / ID: {user.get('id')}")

    posts = obtener_posts(user["id"])

    guardar_json(posts)


if __name__ == "__main__":
    main()
