#!/usr/bin/env python3
"""Set PixelLab's bearer secret for GUI apps without echoing or storing it."""

from getpass import getpass
from subprocess import run
from sys import exit
from uuid import UUID


def main() -> None:
    entered = getpass("新しく再発行した PixelLab Secret（入力内容は表示されません）: ")
    if not entered.strip():
        print("未入力のため中止しました。")
        exit(2)

    try:
        secret = str(UUID(entered.strip()))
    except ValueError:
        print("Secretの形式が正しくありません。PixelLabのSecretだけをコピーしてください。")
        exit(2)
    entered = ""

    result = run(["launchctl", "setenv", "PIXELLAB_SECRET", secret], check=False)
    secret = ""
    if result.returncode:
        print("設定に失敗しました。")
        exit(result.returncode)

    print("設定しました。Codexを完全に終了してから再起動してください。")


if __name__ == "__main__":
    main()
