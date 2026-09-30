#!/usr/bin/env python3
"""Validate a Retro Diffusion key, then expose it to newly launched macOS apps.

Only calls the read-only balance endpoint; never creates images or spends credits.
Keys are entered with getpass and are not written to the repository or shell history.
launchctl's environment lasts for the current macOS login session.
"""

import argparse
from getpass import getpass
import json
import os
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


BALANCE_URL = "https://api.retrodiffusion.ai/v2/inferences/credits"


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward an API key to a redirect destination.
        return None


def valid_format(key):
    return (
        key.startswith("rdpk-")
        and 5 < len(key) <= 512
        and key.isascii()
        and all(33 <= ord(char) <= 126 for char in key)
    )


def verify_key(key):
    request = Request(
        BALANCE_URL,
        headers={"X-RD-Token": key, "Accept": "application/json"},
        method="GET",
    )
    with build_opener(NoRedirects()).open(request, timeout=20) as response:
        payload = json.loads(response.read(65536))
    if not isinstance(payload, dict) or "credits" not in payload:
        raise ValueError("Unexpected balance response")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Retro Diffusionのキー設定・無料認証確認")
    parser.add_argument("--check", action="store_true", help="現在のRD_API_KEYを確認する（設定変更なし）")
    args = parser.parse_args(argv)
    if sys.platform != "darwin" and not args.check:
        print("この設定コマンドはmacOS用です。")
        return 2

    key = ""
    try:
        if args.check:
            key = os.environ.get("RD_API_KEY", "").strip()
            if not key:
                print("このプロセスではRD_API_KEYが未設定です。設定後はアプリを完全終了して再起動してください。")
                return 2
        else:
            if not sys.stdin.isatty():
                print("Macのターミナルでこのコマンドを実行してください。キーをチャットには貼らないでください。")
                return 2
            key = getpass("Retro Diffusion APIキー（rdpk-で始まる値／入力は表示されません）: ").strip()
        if not valid_format(key):
            print("キーの形式が違います。Developer Toolsで取得したrdpk-で始まるキーのみ入力してください。")
            return 2

        print("公式APIで認証を確認しています。画像生成・クレジット消費は行いません。")
        verify_key(key)
        print("API認証に成功しました。")
        if args.check:
            return 0

        result = subprocess.run(
            ["/bin/launchctl", "setenv", "RD_API_KEY", key],
            capture_output=True,
            check=False,
        )
        if result.returncode:
            print("認証は成功しましたが、macOSへの環境変数設定に失敗しました。")
            return 1
        print("設定しました。Codexを完全に終了し、再起動してください。")
        print("Macのログアウト・再起動後は、このコマンドで再設定してください。")
        return 0
    except HTTPError as error:
        if error.code in (401, 403):
            print("認証できませんでした。キーの有効性をDeveloper Toolsで確認してください。設定は変更していません。")
        else:
            print("公式APIからエラーが返りました（HTTP {}）。設定は変更していません。".format(error.code))
        return 1
    except (URLError, TimeoutError, OSError):
        print("公式APIへ接続できませんでした。ネットワークを確認して再実行してください。設定は変更していません。")
        return 1
    except (ValueError, json.JSONDecodeError):
        print("公式APIの応答を確認できませんでした。設定は変更していません。")
        return 1
    except (KeyboardInterrupt, EOFError):
        print("\n入力を中止しました。設定は変更していません。")
        return 2
    finally:
        key = ""


if __name__ == "__main__":
    sys.exit(main())
