import pyperclip
import pyautogui
import time
import sys

# 依赖安装提示: pip install pyperclip pyautogui pygetwindow

PREFIX = "::WX_SEND::"
# 浏览器拦截层的核心背景色 (Indigo-700: RGB 67, 56, 202)
OVERLAY_COLOR = (67, 56, 202)


def check_browser_overlay():
    """监控屏幕，如果发现出现了授权拦截页面，则模拟点击以恢复同步"""
    try:
        sw, sh = pyautogui.size()
        cx, cy = sw // 2, sh // 2

        # 多点校验，确保是我们的授权页面而不是其他蓝色背景
        check_points = [
            (cx, cy),  # 中心
            (cx - 200, cy),  # 左侧
            (cx + 200, cy),  # 右侧
            (cx, cy - 150)  # 上方
        ]

        matches = 0
        for px, py in check_points:
            if pyautogui.pixelMatchesColor(px, py, OVERLAY_COLOR, tolerance=25):
                matches += 1

        if matches >= 3:
            print(f"[{time.strftime('%H:%M:%S')}] 🛡️ 检测到浏览器授权页，执行精准激活...")
            pyautogui.click(cx, cy)
            return True
    except Exception:
        pass
    return False


def activate_wechat():
    """尝试自动寻找并激活微信窗口"""
    try:
        if sys.platform == 'win32':
            import pygetwindow as gw
            titles_to_try = ['张燕', '微信', 'WeChat']
            for title in titles_to_try:
                wins = gw.getWindowsWithTitle(title)
                if wins:
                    win = wins[0]
                    if win.isMinimized:
                        win.restore()
                    win.activate()
                    return True

            all_titles = gw.getAllTitles()
            for t in all_titles:
                if any(k in t for k in ['微信', 'WeChat', '张燕']):
                    wins = gw.getWindowsWithTitle(t)
                    if wins:
                        win = wins[0]
                        if win.isMinimized:
                            win.restore()
                        win.activate()
                        return True

        elif sys.platform == 'darwin':  # MacOS
            import os
            os.system("open -a 'WeChat'")
            return True
    except Exception as e:
        print(f"窗口激活失败: {e}")
    return False


def main():
    print("=" * 60)
    print("      WX.Agent Pro 自动化引擎 (v4.8 定时激活版)      ")
    print("=" * 60)
    print("功能：自动监听 + 窗口激活 + 每5秒自动点击屏幕激活")
    print("状态: 监控中...")

    last_content = ""
    last_timer_click = time.time()

    while True:
        try:
            current_time = time.time()

            # 每 5 秒强制点击一次屏幕中心 (用于激活浏览器授权)
            if current_time - last_timer_click >= 5:
                sw, sh = pyautogui.size()
                # 记录当前位置，点完再回来，减少对用户操作的干扰
                old_x, old_y = pyautogui.position()
                pyautogui.click(sw // 2, sh // 2)
                pyautogui.moveTo(old_x, old_y)
                print(f"[{time.strftime('%H:%M:%S')}] ⚡ 定时激活点击已执行")
                last_timer_click = current_time

            # 同时保留颜色检测逻辑作为双重保障
            check_browser_overlay()

            content = pyperclip.paste()

            if content and content.startswith(PREFIX) and content != last_content:
                msg = content[len(PREFIX):]
                print(f"[{time.strftime('%H:%M:%S')}] 🚀 捕获到新指令...")

                pyperclip.copy(msg)
                time.sleep(0.1)

                if activate_wechat():
                    print(f"[{time.strftime('%H:%M:%S')}] 🎯 微信窗口就绪")
                    time.sleep(0.4)

                cmd_key = 'command' if sys.platform == 'darwin' else 'ctrl'
                pyautogui.hotkey(cmd_key, 'v')
                time.sleep(0.3)
                pyautogui.press('enter')

                print(f"[{time.strftime('%H:%M:%S')}] ✅ 发送完成")

                pyperclip.copy("")
                last_content = ""

            time.sleep(0.5)

        except KeyboardInterrupt:
            print("\n程序退出。")
            break
        except Exception as e:
            print(f"异常: {e}")
            time.sleep(2)


if __name__ == "__main__":
    main()
